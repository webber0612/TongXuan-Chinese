from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "validated-curriculum.sqlite3")
    from app.main import app
    return TestClient(app)


def child(api: TestClient, name: str = "Learner") -> int:
    return api.post("/api/children", json={"name": name}).json()["id"]


def test_validated_slice_titles_scope_and_item_provenance(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        result = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        assert [stage["id"] for stage in result["stages"]] == ["starter", "basic", "book-1"]
        assert [node["id"] for node in result["canonicalHierarchy"]] == ["starter", "basic", *(f"book-{index}" for index in range(1, 11))]
        assert [node["contentStatus"] for node in result["canonicalHierarchy"][3:]] == ["OUT_OF_SCOPE"] * 9
        assert [lesson["title"] for lesson in result["stages"][0]["lessons"][:3]] == ["你好", "我七歲", "爸爸媽媽"]
        assert [lesson["title"] for lesson in result["stages"][1]["lessons"][:3]] == ["你好", "家人", "同學"]
        assert [lesson["title"] for lesson in result["stages"][2]["lessons"]] == ["你好", "你家有幾個人？", "你們班有幾個同學？"]
        assert len(result["stages"][0]["lessons"]) == 12
        assert len(result["stages"][1]["lessons"]) == 12
        assert result["outOfScopeBooks"] == list(range(2, 11))
        for stage in result["stages"]:
            for lesson in stage["lessons"]:
                assert lesson["sourceKind"] == "OFFICIAL_OCAC"
                assert lesson["provenanceStatus"] == "VERIFIED_OFFICIAL_TITLE"
                assert lesson["licenseStatus"] == "PERMISSION_REQUIRED"
                assert lesson["commercialReady"] is False
                assert lesson["sourceUrl"].startswith("https://www.huayuworld.org/")


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
        assert api.get(f"/api/children/{alice}/validated-curriculum").json()["stages"][0]["lessons"][0]["state"]["status"] == "PRACTICED"
        assert api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l02/progress",
            json={"status": "IN_PROGRESS"},
        ).status_code == 409

        soft = api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l02/soft-unlock",
            json={"unlocked": True},
        ).json()
        assert soft["softUnlocked"] is True
        assert soft["mastered"] is False
        assert api.post(
            f"/api/children/{alice}/validated-curriculum/lessons/starter-l02/progress",
            json={"status": "IN_PROGRESS"},
        ).json()["status"] == "IN_PROGRESS"

        bob_state = api.get(f"/api/children/{bob}/validated-curriculum").json()
        bob_l2 = bob_state["stages"][0]["lessons"][1]
        assert bob_l2["accessible"] is False
        assert bob_l2["state"]["status"] == "NOT_STARTED"
        assert bob_l2["state"]["softUnlocked"] is False


def test_mastery_requires_independent_per_domain_floors_and_unlocks_next(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        path = f"/api/children/{child_id}/validated-curriculum/lessons/starter-l01/assessment"
        assisted = api.post(path, json={"scores": {"listening": 0.9, "speaking": 0.9, "phonetics": 0.9}, "assisted_domains": ["speaking"]}).json()
        assert assisted["status"] == "NEEDS_REVIEW"
        assert assisted["failedDomains"] == ["speaking"]
        assert api.get(f"/api/children/{child_id}/validated-curriculum").json()["stages"][0]["lessons"][1]["accessible"] is False

        passed = api.post(path, json={"scores": {"listening": 0.8, "speaking": 0.8, "phonetics": 0.8}}).json()
        assert passed["status"] == "MASTERED"
        assert passed["mastered"] is True
        after = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        assert after["stages"][0]["lessons"][1]["accessible"] is True

        low = api.post(
            f"/api/children/{child_id}/validated-curriculum/lessons/starter-l02/assessment",
            json={"scores": {"listening": 0.99, "speaking": 0.99, "phonetics": 0.99, "vocabulary": 0.7}},
        ).json()
        assert low["status"] == "NEEDS_REVIEW"
        assert low["failedDomains"] == ["vocabulary"]


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
        for script, score in (("zhuyin", 0.95), ("pinyin", 0.85)):
            result = api.post(
                f"{base}/validated-curriculum/lessons/starter-l01/assessment",
                json={"scores": {"phonetics": score}, "script_mode": script},
            ).json()
            assert result["mastered"] is False

        before = api.get(f"{base}/validated-curriculum").json()["stages"][0]["lessons"][0]["state"]["status"]
        zhuyin = api.get(f"{base}/phonetic-support", params={"script": "zhuyin"}).json()
        pinyin = api.get(f"{base}/phonetic-support", params={"script": "pinyin"}).json()
        after = api.get(f"{base}/validated-curriculum").json()["stages"][0]["lessons"][0]["state"]["status"]
        assert zhuyin["supportMode"] == "HIDDEN"
        assert pinyin["supportMode"] == "TAP_TO_REVEAL"
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
        api.post(f"/api/children/{child_id}/validated-curriculum/lessons/basic-l01/soft-unlock", json={"unlocked": True})
        after = api.post(f"/api/adaptive/plan?child_id={child_id}", json=request).json()
        assert item_id in {entry["source_id"] for entry in after["items"]}


def test_weekly_assessment_keeps_domains_separate_and_does_not_award_mastery(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        assert api.post(f"/api/sprint-b/seed?child_id={child_id}").status_code == 200
        test = api.post(f"/api/weekly-tests?child_id={child_id}", json={}).json()
        skills = {item["skill"] for item in test["items"]}
        assert {"word", "sentence", "writing", "pronunciation", "grammar", "idiom", "reading"} <= skills
        assert all("expectedAnswer" not in item for item in test["items"])
        result = api.post(f"/api/weekly-tests/{test['id']}/submit?child_id={child_id}", json={"answers": {}}).json()
        assert result["domain_scores"].keys() >= skills
        assert result["overall_score_is_mastery"] is False
        assert api.get(f"/api/children/{child_id}/validated-curriculum").json()["stages"][0]["lessons"][0]["state"]["status"] == "NOT_STARTED"
