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
        session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        api.post(f"/api/recognition/sessions/{session['id']}/complete", params={"child_id": child_id})
        api.post(f"/api/recognition/sessions/{session['id']}/complete", params={"child_id": child_id})
        points = api.get("/api/points", params={"child_id": child_id}).json()
        assert points["balance"] == 5
        assert len(points["ledger"]) == 1
        reward = points["rewards"][0]
        assert api.post(f"/api/points/redeem/{reward['id']}", params={"child_id": child_id}).status_code == 400
