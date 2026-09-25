from pathlib import Path
from urllib.parse import urlparse

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_ENV"] = "development"
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "validated-curriculum.sqlite3")
    from app.main import app
    return TestClient(app)


def child(api: TestClient, name: str = "Learner") -> int:
    return api.post("/api/children", json={"name": name}).json()["id"]


def parent_headers(child_id: int) -> dict[str, str]:
    from app.auth import issue_session
    return {"Authorization": f"Bearer {issue_session(subject='parent-review', role='parent', child_ids=[child_id])}"}


def admin_headers() -> dict[str, str]:
    from app.auth import issue_session
    return {"Authorization": f"Bearer {issue_session(subject='admin-review', role='admin')}"}


def link_lesson_item(api: TestClient, child_id: int, lesson_id: str, domain: str, item_id: str) -> None:
    response = api.post(
        f"/api/children/{child_id}/validated-curriculum/lessons/{lesson_id}/items",
        headers=admin_headers(),
        json={"skill_domain": domain, "item_id": item_id},
    )
    assert response.status_code == 200, response.text


def test_validated_slice_titles_scope_and_item_provenance(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        result = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        assert [stage["id"] for stage in result["stages"]] == ["starter", "basic", "book-1"]
        assert [node["id"] for node in result["canonicalHierarchy"]] == ["starter", "basic", *(f"book-{index}" for index in range(1, 11))]
        assert [node["contentStatus"] for node in result["canonicalHierarchy"][3:]] == ["OUT_OF_SCOPE"] * 9
        assert [lesson["official"]["title"] for lesson in result["stages"][0]["lessons"][:3]] == ["你好", "我七歲", "爸爸媽媽"]
        assert [lesson["official"]["title"] for lesson in result["stages"][1]["lessons"][:3]] == ["你好", "家人", "同學"]
        assert [lesson["official"]["title"] for lesson in result["stages"][2]["lessons"]] == ["你好", "你家有幾個人？", "你們班有幾個同學？"]
        assert len(result["stages"][0]["lessons"]) == 12
        assert len(result["stages"][1]["lessons"]) == 12
        assert result["outOfScopeBooks"] == list(range(2, 11))
        for stage in result["stages"]:
            for lesson in stage["lessons"]:
                assert lesson["official"]["source"]["kind"] == "OFFICIAL_OCAC"
                assert lesson["official"]["source"]["provenanceStatus"] == "VERIFIED_OFFICIAL_TITLE"
                assert lesson["official"]["source"]["licenseStatus"] == "PERMISSION_REQUIRED"
                assert lesson["official"]["source"]["commercialReady"] is False
                assert lesson["official"]["source"]["url"].startswith("https://www.huayuworld.org/")
                assert "domains" not in lesson and "sourceKind" not in lesson
                assert lesson["tongxuan"]["domains"]
                assert lesson["tongxuan"]["practiceTargets"]
                assert lesson["tongxuan"]["handbookSummary"]["authorship"] == "TONGXUAN_PARAPHRASE"
                handbook_host = urlparse(lesson["tongxuan"]["handbookSummary"]["sourceUrl"]).hostname
                assert handbook_host in {"www.huayuworld.org", "huayuworld.org"}
                assert "handbookSummary" not in lesson["official"]


def test_practice_assessment_and_soft_unlock_are_separate_child_scoped_states(tmp_path):
    with client(tmp_path) as api:
        alice = child(api, "Alice")
        bob = child(api, "Bob")
        progress = api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l01/progress",
            json={"status": "PRACTICED"},
        )
        assert progress.status_code == 200
        assert progress.json()["status"] == "PRACTICED"
        assert progress.json()["mastered"] is False
        forged_mastery = api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l01/progress",
            json={"status": "MASTERED"},
        )
        assert forged_mastery.status_code == 400
        assert api.get(f"/api/children/{alice}/validated-curriculum").json()["stages"][0]["lessons"][0]["tongxuan"]["state"]["status"] == "PRACTICED"
        assert api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l02/progress",
            json={"status": "IN_PROGRESS"},
        ).status_code == 409

        unauthorized = api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l02/soft-unlock",
            json={"unlocked": True},
        )
        assert unauthorized.status_code == 401
        out_of_scope_parent = api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l02/soft-unlock",
            headers=parent_headers(bob), json={"unlocked": True},
        )
        assert out_of_scope_parent.status_code == 403
        from app.auth import issue_session
        child_role = api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l02/soft-unlock",
            headers={"Authorization": f"Bearer {issue_session(subject='developer', role='developer')}"}, json={"unlocked": True},
        )
        assert child_role.status_code == 403
        soft_response = api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l02/soft-unlock",
            headers=parent_headers(alice), json={"unlocked": True},
        )
        assert soft_response.status_code == 200
        soft = soft_response.json()
        assert soft["softUnlocked"] is True
        assert soft["mastered"] is False
        from app.database import connect
        import json
        with connect() as db:
            event = db.execute("SELECT details_json FROM curriculum_lesson_events WHERE id=?", (soft["id"],)).fetchone()
        details = json.loads(event["details_json"])
        assert details["actor"] == {"subject": "parent-review", "role": "parent"}
        assert api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l02/progress",
            json={"status": "IN_PROGRESS"},
        ).json()["status"] == "IN_PROGRESS"

        bob_state = api.get(f"/api/children/{bob}/validated-curriculum").json()
        bob_l2 = bob_state["stages"][0]["lessons"][1]
        assert bob_l2["accessible"] is False
        assert bob_l2["tongxuan"]["state"]["status"] == "NOT_STARTED"
        assert bob_l2["tongxuan"]["state"]["softUnlocked"] is False


def test_client_score_payload_cannot_create_curriculum_mastery(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        path = f"/api/children/{child_id}/validated-curriculum/lessons/starter-l01/assessment"
        forged = api.post(path, json={"scores": {"listening": 1, "speaking": 1, "phonetics": 1}})
        assert forged.status_code == 422
        checked = api.post(path, json={}).json()
        assert checked["status"] == "NEEDS_REVIEW"
        assert checked["mastered"] is False
        assert checked["missingDomains"] == ["listening", "phonetics", "speaking"]
        assert api.get(f"/api/children/{child_id}/validated-curriculum").json()["stages"][0]["lessons"][1]["accessible"] is False


def test_server_linked_authoritative_attempt_can_satisfy_a_supported_domain(tmp_path, monkeypatch):
    with client(tmp_path) as api:
        child_id = child(api)
        api.post(f"/api/children/{child_id}/learning-items/seed", json={})
        from app.database import connect
        from app.learning import start_session, record_attempt
        import app.curriculum_policy as policy

        lesson_id = "recognition-only-test-lesson"
        weekly = api.post(f"/api/weekly-tests?child_id={child_id}", json={}).json()
        with connect() as db:
            item_ids = [row["id"] for row in db.execute("SELECT id FROM learning_items WHERE child_id=?", (child_id,))]
            for item_id in item_ids:
                db.execute("INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,?,?,?)", (child_id, "recognition", item_id, lesson_id))
        item_id = item_ids[0]
        session_id = start_session(child_id)["id"]
        raw_attempt = record_attempt(child_id, session_id, item_id, "correct", False, "CURRICULUM")
        monkeypatch.setattr(policy, "_lesson_map", lambda: {lesson_id: {"id": lesson_id, "domains": ["recognition"], "sequence": 0}})
        raw_only = policy.assess_lesson(child_id=child_id, lesson_id=lesson_id)
        assert raw_only["status"] == "NEEDS_REVIEW"
        assert raw_only["missingDomains"] == ["recognition"]

        answers = {}
        for item in weekly["items"]:
            if item["skill"] == "recognition":
                character = item["prompt"].split("：", 1)[1]
                answers[item["id"]] = next(option["id"] for option in item["options"] if option["label"] == character)
        submitted = api.post(f"/api/weekly-tests/{weekly['id']}/submit?child_id={child_id}", json={"answers": answers}).json()
        result = policy.assess_lesson(child_id=child_id, lesson_id=lesson_id)
        assert result["status"] == "MASTERED"
        assert result["scores"] == {"recognition": 1.0}
        expected_attempt_ids = [activity["attemptId"] for activity in submitted["activity_results"] if activity["attemptType"] == "recognition_attempt"]
        assert result["evidenceRefs"]["recognition"] == expected_attempt_ids
        assert raw_attempt["id"] not in result["evidenceRefs"]["recognition"]
        with connect() as db:
            evidence = db.execute("SELECT evidence_ref,evidence_type,evidence_item_id FROM curriculum_skill_evidence WHERE child_id=? AND lesson_id=? ORDER BY rowid LIMIT 1", (child_id, lesson_id)).fetchone()
        assert evidence["evidence_ref"] == expected_attempt_ids[0]
        assert evidence["evidence_ref"] != raw_attempt["id"]
        assert evidence["evidence_type"] == "recognition_attempt"
        assert evidence["evidence_item_id"] in item_ids


def test_recognition_miss_gets_bounded_same_session_retries(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學", "國"]})
        session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        first = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": first["id"], "result": "incorrect"})

        second = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        assert second["id"] != first["id"]  # unattempted due content stays ahead of the retry
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": second["id"], "result": "correct"})

        retry_one = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        assert retry_one["id"] == first["id"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": first["id"], "result": "incorrect"})
        retry_two = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        assert retry_two["id"] == first["id"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": first["id"], "result": "correct"})
        assert api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"] is None


def test_srs_uses_adaptive_intervals_resets_on_miss_and_is_domain_local(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        from app.curriculum_policy import record_srs_review
        from app.database import connect

        intervals = []
        with connect() as db:
            for index in range(9):
                event = record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id="same-item", result="correct", assisted=False, occurred_at=f"2026-01-01T00:{index:02d}:00Z")
                intervals.append(event["interval_minutes"])
            assert intervals == [10, 1_440, 4_320, 10_080, 20_160, 43_200, 86_400, 172_800, 172_800]
            assisted = record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id="same-item", result="correct", assisted=True, occurred_at="2026-02-01T00:00:00Z")
            assert assisted["stage"] == 8
            assert assisted["interval_minutes"] == 0
            missed = record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id="same-item", result="incorrect", assisted=False, occurred_at="2026-02-01T00:01:00Z")
            assert missed["stage"] == 0
            assert missed["interval_minutes"] == 0
            record_srs_review(db, child_id=child_id, skill_domain="writing", item_id="same-item", result="correct", assisted=False, occurred_at="2026-02-01T00:02:00Z")
            recognition = db.execute("SELECT stage FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id='same-item'", (child_id,)).fetchone()
            writing = db.execute("SELECT stage FROM srs_review_states WHERE child_id=? AND skill_domain='writing' AND item_id='same-item'", (child_id,)).fetchone()
        assert recognition["stage"] == 0
        assert writing["stage"] == 1


def test_phonetic_support_fades_per_script_without_promoting_mastery(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        base = f"/api/children/{child_id}"
        assert api.post(f"/api/sprint-b/seed?child_id={child_id}", json={}).status_code == 200
        from app.database import connect
        with connect() as db:
            db.execute("INSERT INTO pronunciation_readings(id,character,script,notation_system,notation,locale,context,source_name,license_name,provenance_status,commercial_ready) VALUES(?,?,?,?,?,?,?,?,?,?,?)", ("test_reading_馬_zhuyin", "馬", "TRADITIONAL", "ZHUYIN", "ㄇㄚˇ", "zh-TW", "", "Test reading", "Test-only", "LICENSE_REVIEW_REQUIRED", 0))
            reading_ids = [row["id"] for row in db.execute("SELECT id FROM pronunciation_readings WHERE notation_system IN ('ZHUYIN','PINYIN')")]
            for reading_id in reading_ids:
                db.execute("INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,?,?,?)", (child_id, "phonetics", reading_id, "starter-l01"))
        weekly = api.post(f"/api/weekly-tests?child_id={child_id}", json={}).json()
        answers = {}
        for item in weekly["items"]:
            if item["skill"] == "writing_practice":
                continue
            if item["skill"] == "phonetics" and "ZHUYIN" in item["prompt"]:
                answers[item["id"]] = item["options"][0]["id"]
            elif item["skill"] == "phonetics":
                answers[item["id"]] = item["options"][1]["id"]
            else:
                answers[item["id"]] = item["options"][0]["id"]
        submitted = api.post(f"/api/weekly-tests/{weekly['id']}/submit?child_id={child_id}", json={"answers": answers}).json()
        phonetic_results = [entry for entry in submitted["activity_results"] if entry["attemptType"] == "phonetic_notation_attempt"]
        assert len(phonetic_results) == 2
        assert {entry["result"] for entry in phonetic_results} == {"correct", "incorrect"}
        assessment = api.post(f"{base}/validated-curriculum/lessons/starter-l01/assessment", json={}).json()
        assert assessment["mastered"] is False

        before = api.get(f"{base}/validated-curriculum").json()["stages"][0]["lessons"][0]["tongxuan"]["state"]["status"]
        zhuyin = api.get(f"{base}/phonetic-support", params={"script": "zhuyin"}).json()
        pinyin = api.get(f"{base}/phonetic-support", params={"script": "pinyin"}).json()
        after = api.get(f"{base}/validated-curriculum").json()["stages"][0]["lessons"][0]["tongxuan"]["state"]["status"]
        assert zhuyin["supportMode"] == "HIDDEN"
        assert pinyin["supportMode"] == "FULL"
        assert before == after == "NEEDS_REVIEW"
        assert api.get(f"{base}/phonetic-support", params={"script": "other"}).status_code == 400


def test_adaptive_planner_filters_linked_unready_lesson_content(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        item_id = api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["你好"]}).json()["items"][0]["id"]
        from app.database import connect

        with connect() as db:
            db.execute("INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,?,?,?)", (child_id, "recognition", item_id, "basic-l01"))
        request = {"as_of": "2099-01-01T00:00:00Z", "limit": 50}
        before = api.post(f"/api/adaptive/plan?child_id={child_id}", json=request).json()
        assert item_id not in {entry["source_id"] for entry in before["items"]}
        api.post(f"/api/children/{child_id}/validated-curriculum/lessons/basic-l01/soft-unlock", headers=admin_headers(), json={"unlocked": True})
        after = api.post(f"/api/adaptive/plan?child_id={child_id}", json=request).json()
        assert item_id in {entry["source_id"] for entry in after["items"]}


def test_weekly_practice_uses_activity_scorers_and_does_not_claim_multidomain_ability(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        assert api.post(f"/api/children/{child_id}/learning-items/seed", json={}).status_code == 200
        assert api.post(f"/api/sprint-b/seed?child_id={child_id}").status_code == 200
        test = api.post(f"/api/weekly-tests?child_id={child_id}", json={}).json()
        skills = {item["skill"] for item in test["items"]}
        assert skills == {"recognition", "vocabulary", "sentence", "writing_practice", "phonetics", "grammar", "idiom_practice", "reading"}
        assert test["assessment_blueprint"]["id"] == "guided-practice-review-v2"
        assert test["assessment_blueprint"]["assessmentType"] == "PRACTICE_REVIEW_NOT_ABILITY_ASSESSMENT"
        assert all(not ({"expectedAnswer", "correctChoice", "answerByChoice", "targetId"} & item.keys()) for item in test["items"])
        word_task = next(item for item in test["items"] if item["skill"] == "vocabulary")
        sentence_task = next(item for item in test["items"] if item["skill"] == "sentence")
        phonetics_task = next(item for item in test["items"] if item["skill"] == "phonetics")
        idiom_task = next(item for item in test["items"] if item["skill"] == "idiom_practice")
        assert "□" in word_task["prompt"]
        assert "□" in sentence_task["prompt"] and sentence_task["taskType"] == "sentence_cloze"
        assert "記音" in phonetics_task["prompt"] and "pronunciation" not in phonetics_task["prompt"].lower()
        assert idiom_task["taskType"] == "context_choice" and "百聞不如一見" in idiom_task["prompt"]
        answers = {}
        for item in test["items"]:
            if item["skill"] == "writing_practice":
                continue
            if item["skill"] == "recognition":
                character = item["prompt"].split("：", 1)[1]
                answers[item["id"]] = next(option["id"] for option in item["options"] if option["label"] == character)
            else:
                answers[item["id"]] = item["options"][0]["id"]
        result = api.post(f"/api/weekly-tests/{test['id']}/submit?child_id={child_id}", json={"answers": answers}).json()
        assert result["practice_points"] == result["total"] - 1
        assert "domain_scores" not in result
        assert result["practice_only"] is True
        assert result["overall_score_is_mastery"] is False
        assert {activity["attemptType"] for activity in result["activity_results"]} == {item["attemptType"] for item in test["items"]}
        trace = next(activity for activity in result["activity_results"] if activity["attemptType"] == "writing_provider_event")
        assert trace["provider"] == "HANZI_WRITER" and trace["traceEvent"] == "unverified"
        assert trace["attemptId"] is None and trace["result"] == "unverified"
        from app.database import connect
        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM writing_attempts WHERE child_id=? AND provider='HANZI_WRITER'", (child_id,)).fetchone()[0] == 0
            assert db.execute("SELECT COUNT(*) FROM sentence_attempts WHERE child_id=? AND correct=1", (child_id,)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM idiom_attempts WHERE child_id=? AND correct=1 AND answer='firsthand'", (child_id,)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM srs_review_states WHERE child_id=? AND skill_domain='pronunciation'", (child_id,)).fetchone()[0] == 0
            assert db.execute("SELECT COUNT(*) FROM srs_review_states WHERE child_id=? AND skill_domain='writing'", (child_id,)).fetchone()[0] == 0
        assert api.get(f"/api/children/{child_id}/validated-curriculum").json()["stages"][0]["lessons"][0]["tongxuan"]["state"]["status"] == "NOT_STARTED"


def test_weekly_writing_rejects_forged_trace_string_without_any_writing_side_effect(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        api.post(f"/api/children/{child_id}/learning-items/seed", json={})
        api.post(f"/api/sprint-b/seed?child_id={child_id}")
        test = api.post(f"/api/weekly-tests?child_id={child_id}", json={}).json()
        writing_item = next(item for item in test["items"] if item["skill"] == "writing_practice")
        response = api.post(
            f"/api/weekly-tests/{test['id']}/submit?child_id={child_id}",
            json={"answers": {writing_item["id"]: "trace_complete"}},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "writing_provider_event_required"
        from app.database import connect
        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM writing_attempts WHERE child_id=?", (child_id,)).fetchone()[0] == 0
            assert db.execute("SELECT COUNT(*) FROM srs_review_events WHERE child_id=? AND skill_domain='writing'", (child_id,)).fetchone()[0] == 0


def test_weekly_writing_accepts_only_an_existing_attempt_from_writing_flow(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        api.post(f"/api/children/{child_id}/learning-items/seed", json={})
        api.post(f"/api/sprint-b/seed?child_id={child_id}")
        test = api.post(f"/api/weekly-tests?child_id={child_id}", json={}).json()
        from app.database import connect
        import json
        with connect() as db:
            internal_items = json.loads(db.execute("SELECT item_ids FROM weekly_tests WHERE id=?", (test["id"],)).fetchone()["item_ids"])
        writing_item = next(item for item in internal_items if item["skill"] == "writing_practice")
        trace = api.post(
            f"/api/sprint-b/writing/attempts?child_id={child_id}&character={writing_item['targetId']}",
            json={"trace_result": "correct", "provider": "HANZI_WRITER"},
        ).json()
        submitted = api.post(
            f"/api/weekly-tests/{test['id']}/submit?child_id={child_id}",
            json={"answers": {writing_item["id"]: trace["attempt_id"]}},
        )
        assert submitted.status_code == 200
        writing_result = next(item for item in submitted.json()["activity_results"] if item["attemptType"] == "writing_provider_event")
        assert writing_result["attemptId"] == trace["attempt_id"]
        assert writing_result["result"] == "correct"
        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM writing_attempts WHERE child_id=?", (child_id,)).fetchone()[0] == 1
            assert db.execute("SELECT stage FROM srs_review_states WHERE child_id=? AND skill_domain='writing' AND item_id=?", (child_id, writing_item["targetId"])).fetchone()[0] == 1


def test_starter_lesson_01_can_master_and_unlock_lesson_02_without_soft_unlock(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        character_item = api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]}).json()["items"][0]
        sprint_b = api.post(f"/api/sprint-b/seed?child_id={child_id}").json()
        link_lesson_item(api, child_id, "starter-l01", "listening", character_item["id"])
        link_lesson_item(api, child_id, "starter-l01", "speaking", character_item["id"])
        phonetic = next(item for item in sprint_b["readings"] if item["character"] == "學" and item["notation_system"] == "ZHUYIN")
        link_lesson_item(api, child_id, "starter-l01", "phonetics", phonetic["id"])

        listening = api.post(
            f"/api/children/{child_id}/validated-curriculum/lessons/starter-l01/listening-attempts",
            json={"item_id": character_item["id"]},
        ).json()
        completed_listen = api.post(f"/api/children/{child_id}/listening-attempts/{listening['id']}/complete", json={"duration_ms": 900})
        assert completed_listen.status_code == 200
        assert completed_listen.json()["gateStatus"] == "ATTEMPTED_INDEPENDENTLY"

        read_aloud = api.post(
            f"/api/reading-aloud/attempts/start?child_id={child_id}",
            json={"text": "學", "text_kind": "character", "locale": "zh-TW", "source_type": "CURRICULUM", "source_id": character_item["id"], "activity_domain": "speaking"},
        ).json()
        completed_speaking = api.post(f"/api/reading-aloud/attempts/{read_aloud['id']}/complete?child_id={child_id}", json={"duration_ms": 1200})
        assert completed_speaking.status_code == 200
        scored_phonetics = api.post(
            f"/api/sprint-b/pronunciation/{phonetic['id']}/attempts?child_id={child_id}",
            json={"answer": phonetic["notation"]},
        )
        assert scored_phonetics.status_code == 200 and scored_phonetics.json()["correct"] is True

        assessment = api.post(f"/api/children/{child_id}/validated-curriculum/lessons/starter-l01/assessment", json={}).json()
        assert assessment["mastered"] is True
        assert assessment["scores"] == {"phonetics": 1.0}
        assert assessment["gateStatuses"] == {"listening": "ATTEMPTED_INDEPENDENTLY", "speaking": "ATTEMPTED_INDEPENDENTLY"}
        curriculum = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        starter_lessons = curriculum["stages"][0]["lessons"]
        assert starter_lessons[0]["tongxuan"]["state"]["softUnlocked"] is False
        assert starter_lessons[1]["accessible"] is True


def test_book1_placement_and_pronunciation_gate_allow_a_later_lesson_to_master(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        character_item = api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]}).json()["items"][0]
        api.post(f"/api/sprint-b/seed?child_id={child_id}")
        profile = api.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers(child_id),
            json={"age_hint_years": 7, "assessment_method": "DIAGNOSTIC", "domain_levels": {"recognition": "BOOK_1", "reading": "BOOK_1", "listening": "STARTER", "speaking": "BASIC", "pronunciation": "STARTER"}},
        )
        assert profile.status_code == 200 and profile.json()["mainCurriculumStart"] == "BOOK_1"
        link_lesson_item(api, child_id, "book1-l01", "listening", character_item["id"])
        link_lesson_item(api, child_id, "book1-l01", "speaking", character_item["id"])
        link_lesson_item(api, child_id, "book1-l01", "pronunciation", character_item["id"])

        weekly = api.post(f"/api/weekly-tests?child_id={child_id}", json={}).json()
        from app.database import connect
        import json
        with connect() as db:
            internal_items = json.loads(db.execute("SELECT item_ids FROM weekly_tests WHERE id=?", (weekly["id"],)).fetchone()["item_ids"])
        recognition_items = [item for item in internal_items if item["skill"] == "recognition"]
        answers = {}
        for item in recognition_items:
            link_lesson_item(api, child_id, "book1-l01", "recognition", item["targetId"])
            answers[item["id"]] = item["correctChoice"]
        scored = api.post(f"/api/weekly-tests/{weekly['id']}/submit?child_id={child_id}", json={"answers": answers})
        assert scored.status_code == 200

        listening = api.post(f"/api/children/{child_id}/validated-curriculum/lessons/book1-l01/listening-attempts", json={"item_id": character_item["id"]}).json()
        api.post(f"/api/children/{child_id}/listening-attempts/{listening['id']}/complete", json={})
        for domain in ("speaking", "pronunciation"):
            read_aloud = api.post(
                f"/api/reading-aloud/attempts/start?child_id={child_id}",
                json={"text": "學", "text_kind": "character", "locale": "zh-TW", "source_type": "CURRICULUM", "source_id": character_item["id"], "activity_domain": domain},
            ).json()
            api.post(f"/api/reading-aloud/attempts/{read_aloud['id']}/complete?child_id={child_id}", json={"duration_ms": 1000})
        assessment = api.post(f"/api/children/{child_id}/validated-curriculum/lessons/book1-l01/assessment", json={}).json()
        assert assessment["mastered"] is True
        assert assessment["scores"]["recognition"] == 1.0
        assert assessment["gateStatuses"] == {"listening": "ATTEMPTED_INDEPENDENTLY", "pronunciation": "ATTEMPTED_INDEPENDENTLY", "speaking": "ATTEMPTED_INDEPENDENTLY"}
        curriculum = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        book1 = curriculum["stages"][2]["lessons"]
        assert book1[0]["accessible"] is True
        assert book1[1]["accessible"] is True


def test_real_writing_provider_attempt_is_a_non_score_gate_not_a_fabricated_percentage(tmp_path, monkeypatch):
    with client(tmp_path) as api:
        child_id = child(api)
        api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]})
        from app.database import connect
        import app.curriculum_policy as policy
        with connect() as db:
            db.execute("INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,?,?,?)", (child_id, "writing", "學", "writing-gate-test"))
        monkeypatch.setattr(policy, "_lesson_map", lambda: {"writing-gate-test": {"id": "writing-gate-test", "stageId": "test", "number": 1, "domains": ["writing"], "sequence": 0}})
        written = api.post("/api/sprint-b/writing/attempts?child_id={}&character=學".format(child_id), json={"trace_result": "correct", "provider": "HANZI_WRITER"})
        assert written.status_code == 200
        evidence = policy.assess_lesson(child_id=child_id, lesson_id="writing-gate-test")
        assert evidence["mastered"] is True
        assert evidence["scores"] == {}
        assert evidence["gateStatuses"] == {"writing": "ATTEMPTED_INDEPENDENTLY"}
        assert evidence["gateEvidenceRefs"]["writing"] == [written.json()["attempt_id"]]


def test_placement_profile_keeps_domains_independent_and_uses_age_only_as_a_hint(tmp_path):
    with client(tmp_path) as api:
        alice = child(api, "Alice")
        bob = child(api, "Bob")
        alice_profile = api.put(
            f"/api/children/{alice}/placement-profile",
            headers=parent_headers(alice),
            json={"age_hint_years": 7, "assessment_method": "PARENT_OBSERVATION", "domain_levels": {"recognition": "BASIC", "reading": "BASIC", "writing": "STARTER", "zhuyin": "STARTER", "pinyin": "BASIC", "listening": "STARTER", "speaking": "BASIC"}},
        )
        bob_profile = api.put(
            f"/api/children/{bob}/placement-profile",
            headers=parent_headers(bob),
            json={"age_hint_years": 7, "assessment_method": "DIAGNOSTIC", "domain_levels": {"recognition": "STARTER", "reading": "STARTER", "writing": "BASIC", "zhuyin": "BASIC", "pinyin": "STARTER", "listening": "BOOK_1", "speaking": "STARTER"}},
        )
        assert alice_profile.status_code == bob_profile.status_code == 200
        alice_data, bob_data = alice_profile.json(), bob_profile.json()
        assert alice_data["mainCurriculumStart"] == "BASIC"
        assert bob_data["mainCurriculumStart"] == "STARTER"
        assert alice_data["ageHintYears"] == bob_data["ageHintYears"] == 7
        assert alice_data["placementContract"]["ageUsedForPlacement"] is False
        assert alice_data["domains"]["writing"]["level"] == "STARTER"
        assert alice_data["domains"]["zhuyin"]["level"] == "STARTER"
        assert alice_data["domains"]["pinyin"]["level"] == "BASIC"
        assert api.get(f"/api/children/{alice}/validated-curriculum").json()["stages"][1]["lessons"][0]["accessible"] is True
        assert api.get(f"/api/children/{bob}/validated-curriculum").json()["stages"][1]["lessons"][0]["accessible"] is False
        assert api.get(f"/api/children/{alice}/placement-profile").status_code == 401
