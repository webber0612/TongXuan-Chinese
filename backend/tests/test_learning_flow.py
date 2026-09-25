import json
from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_ENV"] = "development"
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "learning-flow.sqlite3")
    from app.main import app
    return TestClient(app)


def child(api: TestClient, name: str = "Learner") -> int:
    response = api.post("/api/children", json={"name": name})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def place(child_id: int, start: str, writing: str | None = None, age: int = 7) -> None:
    from app.placement import save_placement_profile
    domains = {key: start for key in ("recognition", "reading", "vocabulary", "grammar")}
    if writing:
        domains["writing"] = writing
    save_placement_profile(child_id=child_id, domain_levels=domains, assessment_method="PARENT_OBSERVATION", assessed_by="flow-test", age_hint_years=age)


def ensure_lesson_materials(child_id: int, lesson_id: str = "starter-l01") -> None:
    from app.curriculum_policy import _lesson_map
    from app.database import connect
    from app.learning_flow import _ensure_lesson_materials
    with connect() as db:
        _ensure_lesson_materials(db, child_id, _lesson_map()[lesson_id])


def session(api: TestClient, child_id: int) -> dict:
    response = api.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-20T08:00:00Z"})
    assert response.status_code == 200, response.text
    return response.json()


def start_task(api: TestClient, child_id: int, current: dict, task: dict) -> dict:
    response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/start")
    assert response.status_code == 200, response.text
    return response.json()


def answer_task(api: TestClient, child_id: int, current: dict, task: dict, option: str, assisted: bool = False) -> dict:
    response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/answer", json={"selected_option_id": option, "assisted": assisted})
    assert response.status_code == 200, response.text
    return response.json()


def complete_session(api: TestClient, child_id: int, current: dict, assisted_scores: bool = False, skip_writing: bool = False) -> dict:
    from app.database import connect

    for task in current["tasks"]:
        if task["taskType"] == "LESSON_WRAP_UP" or task["state"] in {"COMPLETED", "DEFERRED"}:
            continue
        if task["taskType"].startswith("WRITING_") and (skip_writing or not task["required"]):
            result = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/skip", json={})
            assert result.status_code == 200, result.text
            continue
        current = start_task(api, child_id, current, task)
        if task["taskType"] == "LISTENING":
            attempt = api.post(f"/api/children/{child_id}/listening-attempts", json={"item_id": task["itemId"]}).json()
            complete = api.post(f"/api/children/{child_id}/listening-attempts/{attempt['id']}/complete", json={"duration_ms": 500})
            assert complete.status_code == 200, complete.text
            response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json={"evidence_ref": attempt["id"]})
            assert response.status_code == 200, response.text
        elif task["taskType"] in {"SPEAKING_ATTEMPT", "PRONUNCIATION_ATTEMPT"}:
            domain = "pronunciation" if task["taskType"] == "PRONUNCIATION_ATTEMPT" else "speaking"
            attempt = api.post("/api/reading-aloud/attempts/start?child_id=" + str(child_id), json={"text": task["taskData"]["text"], "text_kind": "character", "locale": "zh-TW", "source_type": "CURRICULUM", "source_id": task["itemId"], "activity_domain": domain})
            assert attempt.status_code == 200, attempt.text
            attempt_id = attempt.json()["id"]
            completed = api.post(f"/api/reading-aloud/attempts/{attempt_id}/complete?child_id={child_id}", json={"duration_ms": 500})
            assert completed.status_code == 200, completed.text
            response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json={"evidence_ref": attempt_id})
            assert response.status_code == 200, response.text
        elif task["taskType"] in {"RECOGNITION", "REVIEW_RECOGNITION", "MINI_CHECK", "VOCABULARY", "SENTENCE_PATTERN"}:
            if task["taskData"].get("mode") == "reflection":
                selected = "practiced"
            elif task["taskType"] == "VOCABULARY":
                selected = next(option["id"] for option in task["taskData"]["choices"] if option["label"] == "打招呼")
            elif task["taskType"] == "SENTENCE_PATTERN":
                selected = next(option["id"] for option in task["taskData"]["choices"] if option["id"] == "greeting")
            else:
                if task["taskType"] == "REVIEW_RECOGNITION":
                    expected = task["taskData"]["audioText"]
                else:
                    with connect() as db:
                        expected = db.execute("SELECT character FROM learning_items WHERE child_id=? AND id=?", (child_id, task["itemId"])).fetchone()[0]
                selected = next(option["id"] for option in task["taskData"]["choices"] if option["label"] == expected)
            current = answer_task(api, child_id, current, task, selected, assisted_scores and task["taskType"] in {"RECOGNITION", "REVIEW_RECOGNITION", "VOCABULARY", "MINI_CHECK"})
        elif task["taskType"] == "PHONETICS":
            answers = {}
            with connect() as db:
                for question in task["taskData"]["questions"]:
                    row = db.execute("SELECT notation FROM pronunciation_readings WHERE character=? AND script=? ORDER BY id LIMIT 1", (question["character"], question["script"])).fetchone()
                    answers[question["id"]] = next(option["id"] for option in question["choices"] if option["label"] == row["notation"])
            response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/answer", json={"answers": answers, "assisted": assisted_scores})
            assert response.status_code == 200, response.text
            current = response.json()
        else:
            raise AssertionError(f"Unhandled task type: {task['taskType']}")
        current = api.get(f"/api/children/{child_id}/learning-sessions/{current['id']}").json()
    completed = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/complete", json={})
    assert completed.status_code == 200, completed.text
    return completed.json()


def test_plan_is_deterministic_and_does_not_disclose_answer_keys(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        body = {"as_of": "2026-09-20T08:00:00Z", "target_minutes": 18, "script_mode": "TRADITIONAL"}
        first = api.post(f"/api/children/{child_id}/learning-sessions/plan", json=body).json()
        second = api.post(f"/api/children/{child_id}/learning-sessions/plan", json=body).json()
        assert first == second
        assert all(not any(key.startswith("_") for key in task) for task in first["tasks"])


def test_equal_age_children_start_from_their_assessed_placement(tmp_path):
    with client(tmp_path) as api:
        starter, basic = child(api, "Starter"), child(api, "Basic")
        place(starter, "STARTER", age=7)
        place(basic, "BASIC", age=7)
        a = api.get(f"/api/children/{starter}/learning-daily-queue").json()
        b = api.get(f"/api/children/{basic}/learning-daily-queue").json()
        assert a["newLesson"]["lessonId"] == "starter-l01"
        assert b["newLesson"]["lessonId"] == "basic-l01"
        assert a["placementStart"] != b["placementStart"]


def test_due_reviews_precede_new_lesson_tasks(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        ensure_lesson_materials(child_id, "basic-l01")
        with connect() as db:
            item_id = db.execute("SELECT id FROM learning_items WHERE child_id=? AND character='你' ORDER BY id LIMIT 1", (child_id,)).fetchone()[0]
            db.execute("INSERT OR REPLACE INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'recognition', ?, 1, '2026-09-20 07:00:00','correct',0,'2026-09-20 06:00:00')", (child_id, item_id))
        plan = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        assert plan["tasks"][0]["sourceQueue"] == "REVIEW"
        assert plan["tasks"][0]["itemId"] == item_id


def test_future_due_content_from_locked_lesson_is_excluded(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        with connect() as db:
            item_id = "future-lesson-item"
            db.execute("INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status) VALUES(?,?,?,'test','TONGXUAN_AUTHORED_INTERNAL_DRAFT')", (item_id, child_id, "我"))
            db.execute("INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,?,?,?)", (child_id, "recognition", item_id, "starter-l02"))
            db.execute("INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'recognition', ?, 1, '2026-09-20 07:00:00','correct',0,'2026-09-20 06:00:00')", (child_id, item_id))
        plan = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        assert item_id not in {task["itemId"] for task in plan["tasks"]}


def test_strong_recognition_state_reduces_fresh_recognition_tasks(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        ensure_lesson_materials(child_id, "basic-l01")
        full = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={}).json()
        with connect() as db:
            item_id = db.execute("SELECT id FROM learning_items WHERE child_id=? AND character='你' ORDER BY id LIMIT 1", (child_id,)).fetchone()[0]
            db.execute("INSERT INTO recognition_states(child_id,item_id,correct_count,incorrect_count,assisted_count,last_result) VALUES(?,?,2,0,0,'correct')", (child_id, item_id))
        adapted = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={}).json()
        assert sum(task["taskType"] in {"RECOGNITION", "MINI_CHECK"} and task["skillDomain"] == "recognition" for task in adapted["tasks"]) < sum(task["taskType"] in {"RECOGNITION", "MINI_CHECK"} and task["skillDomain"] == "recognition" for task in full["tasks"])


def test_weaker_writing_placement_adds_only_optional_targeted_writing(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1", writing="BASIC")
        plan = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={"script_mode": "SIMPLIFIED"}).json()
        writing = [task for task in plan["tasks"] if task["taskType"].startswith("WRITING_")]
        assert len(writing) == 1
        assert writing[0]["required"] is False
        assert writing[0]["taskData"]["character"] == "你"
        assert writing[0]["taskData"]["scriptMode"] == "SIMPLIFIED"


def test_three_wrong_attempts_pause_and_defer_the_blocking_task(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        task = next(task for task in current["tasks"] if task["taskType"] == "RECOGNITION")
        wrong = next(option["id"] for option in task["taskData"]["choices"] if option["label"] != "你")
        for _ in range(3):
            current = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/answer", json={"selected_option_id": wrong}).json()
        assert current["status"] == "PAUSED"
        assert next(item for item in current["tasks"] if item["id"] == task["id"])["deferredReason"] == "REPEATED_FAILURES"


def test_session_can_finish_with_assisted_answers_without_mastery(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        result = complete_session(api, child_id, current, assisted_scores=True)
        assert result["status"] == "COMPLETED"
        assert result["masteryStatus"] == "NEEDS_REVIEW"
        assert result["reward"]["earned"] is True


def test_basic_secondary_golden_path_completes_with_linked_evidence(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        result = complete_session(api, child_id, session(api, child_id))
        assert result["status"] == "COMPLETED"
        assert result["masteryStatus"] == "MASTERED"
        assert result["curriculumContext"]["lessonId"] == "basic-l01"


def test_session_practice_and_mastery_are_persisted_separately(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        with connect() as db:
            assert db.execute("SELECT status FROM curriculum_lesson_states WHERE child_id=? AND lesson_id='book1-l01'", (child_id,)).fetchone() is None
        assert current["masteryStatus"] is None
        completed = complete_session(api, child_id, current, assisted_scores=True)
        with connect() as db:
            state = db.execute("SELECT status FROM curriculum_lesson_states WHERE child_id=? AND lesson_id='book1-l01'", (child_id,)).fetchone()
        assert state["status"] == "NEEDS_REVIEW"
        assert completed["reward"]["earned"] is True


def test_speaking_and_pronunciation_are_non_score_gates(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        complete_session(api, child_id, session(api, child_id))
        with connect() as db:
            score_rows = db.execute("SELECT COUNT(*) FROM curriculum_skill_evidence WHERE child_id=? AND skill_domain IN ('speaking','pronunciation')", (child_id,)).fetchone()[0]
            gate_rows = db.execute("SELECT skill_domain FROM curriculum_skill_gates WHERE child_id=? AND lesson_id='book1-l01'", (child_id,)).fetchall()
        assert score_rows == 0
        assert {row["skill_domain"] for row in gate_rows} >= {"speaking", "pronunciation", "listening"}


def test_day_one_correct_review_schedules_short_interval(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        ensure_lesson_materials(child_id, "basic-l01")
        with connect() as db:
            item_id = db.execute("SELECT id FROM learning_items WHERE child_id=? AND character='你' ORDER BY id LIMIT 1", (child_id,)).fetchone()[0]
            db.execute("INSERT OR REPLACE INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'recognition', ?, 0, '2026-09-20 07:00:00','incorrect',0,'2026-09-20 06:00:00')", (child_id, item_id))
        review = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={"as_of": "2026-09-20T08:00:00Z"}).json()["tasks"][0]
        assert review["taskType"] == "REVIEW_RECOGNITION"
        current = api.post(f"/api/children/{child_id}/learning-sessions", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        review = current["tasks"][0]
        correct = next(option["id"] for option in review["taskData"]["choices"] if option["label"] == "你")
        answer_task(api, child_id, current, review, correct)
        with connect() as db:
            state = db.execute("SELECT stage,due_at,last_result FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id=?", (child_id, item_id)).fetchone()
        assert state["stage"] == 1
        assert state["last_result"] == "correct"
        assert state["due_at"] > "2026-09-20 08:00:00"


def test_day_zero_evidence_enters_due_queue_then_day_one_review_expands_interval(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        completed = complete_session(api, child_id, session(api, child_id))
        assert completed["masteryStatus"] == "MASTERED"
        with connect() as db:
            due = db.execute("SELECT item_id,due_at,stage FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' ORDER BY item_id LIMIT 1", (child_id,)).fetchone()
            assert due and due["stage"] == 1
            db.execute("UPDATE srs_review_states SET due_at='2026-09-20 07:00:00' WHERE child_id=? AND skill_domain='recognition' AND item_id=?", (child_id, due["item_id"]))
        queue = api.get(f"/api/children/{child_id}/learning-daily-queue", params={"as_of": "2026-09-20T08:00:00Z"}).json()
        assert any(item["id"] == due["item_id"] for item in queue["review"]["items"])
        current = api.post(f"/api/children/{child_id}/learning-sessions", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        review = next(task for task in current["tasks"] if task["sourceQueue"] == "REVIEW")
        correct = next(option["id"] for option in review["taskData"]["choices"] if option["label"] == "你")
        answer_task(api, child_id, current, review, correct)
        with connect() as db:
            advanced = db.execute("SELECT stage,last_result,due_at FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id=?", (child_id, due["item_id"])).fetchone()
        assert advanced["stage"] == 2 and advanced["last_result"] == "correct"
        assert advanced["due_at"] > "2026-09-20 08:00:00"


def test_incorrect_and_assisted_reviews_do_not_advance_srs_stage(tmp_path):
    from app.database import connect
    from app.curriculum_policy import record_srs_review
    with client(tmp_path) as api:
        child_id = child(api)
        with connect() as db:
            record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id="item-x", result="correct", assisted=False, occurred_at="2026-01-01T00:00:00Z")
            incorrect = record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id="item-x", result="incorrect", assisted=False, occurred_at="2026-01-01T01:00:00Z")
            assert incorrect["stage"] == 0
            assisted = record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id="item-x", result="correct", assisted=True, occurred_at="2026-01-01T02:00:00Z")
            assert assisted["stage"] == 0
            assert assisted["last_assisted"] == 1


def test_recognition_attempt_changes_only_recognition_srs(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        ensure_lesson_materials(child_id, "basic-l01")
        with connect() as db:
            item_id = db.execute("SELECT id FROM learning_items WHERE child_id=? AND character='你' ORDER BY id LIMIT 1", (child_id,)).fetchone()[0]
            db.execute("INSERT OR REPLACE INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'recognition', ?, 0, '2026-09-20 07:00:00','incorrect',0,'2026-09-20 06:00:00')", (child_id, item_id))
        current = api.post(f"/api/children/{child_id}/learning-sessions", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        review = current["tasks"][0]
        correct = next(option["id"] for option in review["taskData"]["choices"] if option["label"] == "你")
        answer_task(api, child_id, current, review, correct)
        with connect() as db:
            domains = {row["skill_domain"] for row in db.execute("SELECT skill_domain FROM srs_review_states WHERE child_id=?", (child_id,))}
        assert domains == {"recognition"}


def test_paused_session_resumes_without_duplicate_session_or_reward(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        original_id = current["id"]
        api.post(f"/api/children/{child_id}/learning-sessions/{original_id}/stop", json={"reason": "USER_EXIT"})
        resumed = api.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "script_mode": "TRADITIONAL"}).json()
        assert resumed["id"] == original_id and resumed["resumed"] is True
        completed = complete_session(api, child_id, resumed)
        again = api.post(f"/api/children/{child_id}/learning-sessions/{original_id}/complete", json={}).json()
        assert completed["reward"]["points"] == again["reward"]["points"] == 5
        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM learning_flow_sessions WHERE child_id=?", (child_id,)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM points_ledger WHERE child_id=? AND event_key=?", (child_id, f"learning-session:{original_id}")).fetchone()[0] == 1


def test_learning_session_is_child_scoped(tmp_path):
    with client(tmp_path) as api:
        alice, bob = child(api, "Alice"), child(api, "Bob")
        current = session(api, alice)
        response = api.get(f"/api/children/{bob}/learning-sessions/{current['id']}")
        assert response.status_code == 404
        assert api.get(f"/api/children/{bob}/learning-sessions/current").json() is None


def test_session_reward_does_not_imply_curriculum_mastery(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        result = complete_session(api, child_id, session(api, child_id), assisted_scores=True)
        assert result["reward"]["earned"] is True
        assert result["reward"]["points"] == 5
        assert result["masteryStatus"] != "MASTERED"


def test_telemetry_keeps_answers_and_audio_out_of_persisted_details(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        current = session(api, child_id)
        task = next(task for task in current["tasks"] if task["taskType"] == "PHONETICS")
        api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/answer", json={"answers": {}})
        with connect() as db:
            details = [row["details_json"] for row in db.execute("SELECT details_json FROM learning_flow_telemetry WHERE child_id=?", (child_id,))]
            tables = {row["name"] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        serialized = " ".join(details).lower()
        assert "audio" not in serialized and "blob" not in serialized
        assert "selected_option_id" not in serialized and "answer_key" not in serialized
        assert "learning_flow_telemetry" in tables


def test_optional_writing_can_be_skipped_without_becoming_a_mastery_gate(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1", writing="BASIC")
        current = session(api, child_id)
        writing = next(task for task in current["tasks"] if task["taskType"].startswith("WRITING_"))
        skipped = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{writing['id']}/skip", json={})
        assert skipped.status_code == 200
        current = complete_session(api, child_id, skipped.json(), skip_writing=True)
        with connect() as db:
            state = db.execute("SELECT state,deferred_reason FROM learning_flow_tasks WHERE id=?", (writing["id"],)).fetchone()
            writing_attempts = db.execute("SELECT COUNT(*) FROM writing_attempts WHERE child_id=?", (child_id,)).fetchone()[0]
        assert state["state"] == "DEFERRED" and state["deferred_reason"] == "OPTIONAL_SKIPPED"
        assert writing_attempts == 0
        assert current["masteryStatus"] == "MASTERED", f"missing={current.get('assessment', {}).get('missingDomains')} failed={current.get('assessment', {}).get('failedDomains')} scores={current.get('assessment', {}).get('scores')} gates={current.get('assessment', {}).get('gateStatuses')}"


def test_mastered_placement_lesson_unlocks_next_lesson_in_that_stage(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        before = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        before_lesson = next(lesson for stage in before["stages"] if stage["id"] == "book-1" for lesson in stage["lessons"] if lesson["id"] == "book1-l02")
        assert before_lesson["accessible"] is False
        complete_session(api, child_id, session(api, child_id))
        after = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        after_lesson = next(lesson for stage in after["stages"] if stage["id"] == "book-1" for lesson in stage["lessons"] if lesson["id"] == "book1-l02")
        assert after_lesson["accessible"] is True
        queue = api.get(f"/api/children/{child_id}/learning-daily-queue").json()
        assert queue["nextAccessibleLesson"]["lessonId"] == "book1-l02"


def test_parent_report_is_scoped_and_excludes_raw_audio(tmp_path):
    from app.auth import issue_session
    with client(tmp_path) as api:
        child_id, other_id = child(api, "Alice"), child(api, "Bob")
        unauthenticated = api.get(f"/api/children/{child_id}/learning-sessions/report")
        assert unauthenticated.status_code == 401
        parent = {"Authorization": f"Bearer {issue_session(subject='parent-a', role='parent', child_ids=[child_id])}"}
        forbidden = api.get(f"/api/children/{other_id}/learning-sessions/report", headers=parent)
        assert forbidden.status_code == 403
        report = api.get(f"/api/children/{child_id}/learning-sessions/report", headers=parent)
        assert report.status_code == 200, report.text
        assert report.json()["privacy"]["rawAudioStored"] is False
        assert "weakDomains" in report.json() and "deferredTasks" in report.json()
