from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "sprint.sqlite3")
    from app.main import app
    return TestClient(app)


def setup_child(api: TestClient):
    child = api.post("/api/children", json={"name": "Alice"}).json()
    api.post(f"/api/children/{child['id']}/learning-items/seed", json={})
    return child["id"]


def test_recognition_correct_incorrect_assisted_and_child_isolation(tmp_path):
    with client(tmp_path) as api:
        child_id = setup_child(api)
        other = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        session = api.post(f"/api/recognition/sessions?child_id={child_id}").json()
        item = api.get(f"/api/recognition/sessions/{session['id']}/next?child_id={child_id}").json()["item"]
        assert api.post(f"/api/recognition/sessions/{session['id']}/attempts?child_id={child_id}", json={"item_id": item["id"], "result": "correct", "source_queue": "CURRICULUM"}).status_code == 200
        assert api.post(f"/api/recognition/sessions/{session['id']}/attempts?child_id={child_id}", json={"item_id": item["id"], "result": "incorrect", "source_queue": "CURRICULUM"}).status_code == 200
        assisted = api.post(f"/api/recognition/sessions/{session['id']}/attempts?child_id={child_id}", json={"item_id": item["id"], "result": "correct", "assisted": True}).json()
        assert assisted["assisted"] == 1
        assert api.get(f"/api/daily-queue?child_id={other}").json() == []
        assert api.post(f"/api/recognition/sessions/{session['id']}/complete?child_id={child_id}").json()["attempts"] == 3


def test_recognition_scheduler_respects_due_boundary_and_session_attempts(tmp_path):
    with client(tmp_path) as api:
        from app.database import connect

        child_id = setup_child(api)
        session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        item = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": item["id"], "result": "correct"})
        next_item = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        assert next_item is not None and next_item["id"] != item["id"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": next_item["id"], "result": "incorrect"})
        api.post(f"/api/recognition/sessions/{session['id']}/complete", params={"child_id": child_id})
        with connect() as db:
            future = "2099-01-01 00:00:00"
            db.execute("UPDATE recognition_states SET due_at=? WHERE child_id=? AND item_id<>?", (future, child_id, next_item["id"]))
            for row in db.execute("SELECT id FROM learning_items WHERE child_id=? AND id<>?", (child_id, next_item["id"])).fetchall():
                db.execute("INSERT OR IGNORE INTO recognition_states (child_id,item_id,due_at) VALUES (?,?,?)", (child_id, row["id"], future))
        later_session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        assert api.get(f"/api/recognition/sessions/{later_session['id']}/next", params={"child_id": child_id}).json()["item"]["id"] == next_item["id"]


def test_assisted_item_is_immediately_due_but_correct_item_is_not(tmp_path):
    with client(tmp_path) as api:
        from app.database import connect

        child_id = setup_child(api)
        session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        correct_item = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": correct_item["id"], "result": "correct"})
        assisted_item = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": assisted_item["id"], "result": "correct", "assisted": True})
        api.post(f"/api/recognition/sessions/{session['id']}/complete", params={"child_id": child_id})
        with connect() as db:
            future = "2099-01-01 00:00:00"
            db.execute("UPDATE recognition_states SET due_at=? WHERE child_id=? AND item_id<>?", (future, child_id, assisted_item["id"]))
            for row in db.execute("SELECT id FROM learning_items WHERE child_id=? AND id<>?", (child_id, assisted_item["id"])).fetchall():
                db.execute("INSERT OR IGNORE INTO recognition_states (child_id,item_id,due_at) VALUES (?,?,?)", (child_id, row["id"], future))
        later_session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        assert api.get(f"/api/recognition/sessions/{later_session['id']}/next", params={"child_id": child_id}).json()["item"]["id"] == assisted_item["id"]


def test_session_completion_validates_identity_state_and_attempts(tmp_path):
    with client(tmp_path) as api:
        child_id = setup_child(api)
        other_id = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        empty = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        assert api.post(f"/api/recognition/sessions/{empty['id']}/complete", params={"child_id": child_id}).status_code == 400
        assert api.post("/api/recognition/sessions/not-real/complete", params={"child_id": child_id}).status_code == 400
        assert api.post(f"/api/recognition/sessions/{empty['id']}/complete", params={"child_id": other_id}).status_code == 400


def test_review_queue_contains_recognition_and_weekly_misses(tmp_path):
    with client(tmp_path) as api:
        child_id = setup_child(api)
        session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        item = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": item["id"], "result": "incorrect"})
        test = api.post("/api/weekly-tests", params={"child_id": child_id}).json()
        result = api.post(f"/api/weekly-tests/{test['id']}/submit", params={"child_id": child_id}, json={"answers": {}}).json()
        queue = api.get("/api/daily-queue", params={"child_id": child_id}).json()
        assert result["missed_items"]
        assert {entry["source"] for entry in queue} >= {"REVIEW", "CURRICULUM"}


def test_weekly_test_prioritizes_known_recent_items_deterministically(tmp_path):
    with client(tmp_path) as api:
        child_id = setup_child(api)
        first = api.post("/api/weekly-tests", params={"child_id": child_id}).json()
        session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        item = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": item["id"], "result": "correct"})
        second = api.post("/api/weekly-tests", params={"child_id": child_id}).json()
        assert second["items"][0]["id"] == item["id"]
        assert [entry["id"] for entry in first["items"]] == [entry["id"] for entry in api.post("/api/weekly-tests", params={"child_id": child_id}).json()["items"]]


def test_completed_weekly_test_is_immutable(tmp_path):
    with client(tmp_path) as api:
        child_id = setup_child(api)
        test = api.post("/api/weekly-tests", params={"child_id": child_id}).json()
        first = api.post(f"/api/weekly-tests/{test['id']}/submit", params={"child_id": child_id}, json={"answers": {}}).json()
        second = api.post(f"/api/weekly-tests/{test['id']}/submit", params={"child_id": child_id}, json={"answers": {test['items'][0]['id']: test['items'][0]['character']}})
        assert second.status_code == 400
        assert first["score"] == 0


def test_school_queue_is_separate_and_deterministic(tmp_path):
    with client(tmp_path) as api:
        child_id = setup_child(api)
        result = api.post("/api/school-queue", params={"child_id": child_id}, json={"character": "考", "school_source": "Worksheet 1", "priority": 9, "private_content": True, "provenance_status": "PRIVATE_OK"})
        assert result.status_code == 200
        queue = api.get("/api/daily-queue", params={"child_id": child_id}).json()
        assert queue[0]["source"] == "SCHOOL_QUEUE"
        assert queue[0]["source_detail"] == "Worksheet 1"
        assert all(item["source"] != "SCHOOL_QUEUE" or item["source_detail"] != "PHASE_0_SAMPLE" for item in queue)


def test_weekly_test_reproducible_and_missed_items_are_reported(tmp_path):
    with client(tmp_path) as api:
        child_id = setup_child(api)
        test = api.post("/api/weekly-tests", params={"child_id": child_id}).json()
        answers = {test["items"][0]["id"]: test["items"][0]["character"]}
        result = api.post(f"/api/weekly-tests/{test['id']}/submit", params={"child_id": child_id}, json={"answers": answers}).json()
        assert result["score"] == 1
        assert result["total"] == 4
        assert len(result["missed_items"]) == 3
        again = api.post("/api/weekly-tests", params={"child_id": child_id}).json()
        assert [item["id"] for item in again["items"]] == [item["id"] for item in test["items"]]


def test_points_idempotency_balance_redemption_and_mastery_separation(tmp_path):
    with client(tmp_path) as api:
        child_id = setup_child(api)
        empty = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        assert api.post(f"/api/recognition/sessions/{empty['id']}/complete", params={"child_id": child_id}).status_code == 400
        session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        item = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": item["id"], "result": "correct"})
        api.post(f"/api/recognition/sessions/{session['id']}/complete", params={"child_id": child_id})
        assert api.post(f"/api/recognition/sessions/{session['id']}/complete", params={"child_id": child_id}).status_code == 400
        points = api.get("/api/points", params={"child_id": child_id}).json()
        assert points["balance"] == 5
        assert len(points["ledger"]) == 1
        reward = points["rewards"][0]
        assert api.post(f"/api/points/redeem/{reward['id']}", params={"child_id": child_id}).status_code == 400


def test_successful_redemption_is_auditable_and_does_not_change_mastery(tmp_path):
    with client(tmp_path) as api:
        child_id = setup_child(api)
        from app.database import connect

        for _ in range(2):
            session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
            item = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
            api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": item["id"], "result": "correct"})
            api.post(f"/api/recognition/sessions/{session['id']}/complete", params={"child_id": child_id})
        test = api.post("/api/weekly-tests", params={"child_id": child_id}).json()
        submit = {entry["id"]: entry["character"] for entry in test["items"]}
        assert api.post(f"/api/weekly-tests/{test['id']}/submit", params={"child_id": child_id}, json={"answers": submit}).status_code == 200
        with connect() as db:
            before = [dict(row) for row in db.execute("SELECT * FROM recognition_states WHERE child_id=? ORDER BY item_id", (child_id,))]
        points = api.get("/api/points", params={"child_id": child_id}).json()
        reward = points["rewards"][0]
        redemption = api.post(f"/api/points/redeem/{reward['id']}", params={"child_id": child_id})
        assert redemption.status_code == 200
        assert redemption.json()["cost"] == 20
        after_points = api.get("/api/points", params={"child_id": child_id}).json()
        assert after_points["balance"] == points["balance"] - 20
        assert any(entry["event_type"] == "REWARD_REDEMPTION" and entry["points_delta"] == -20 for entry in after_points["ledger"])
        with connect() as db:
            after = [dict(row) for row in db.execute("SELECT * FROM recognition_states WHERE child_id=? ORDER BY item_id", (child_id,))]
        assert after == before
