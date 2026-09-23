from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "dashboard.sqlite3")
    from app.main import app
    return TestClient(app)


def test_dashboard_is_child_scoped_event_based_and_read_only(tmp_path):
    with client(tmp_path) as api:
        alice = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        api.post(f"/api/children/{alice}/learning-items/seed", json={"characters": ["學"]})
        session = api.post("/api/recognition/sessions", params={"child_id": alice}).json()["id"]
        item = api.get(f"/api/recognition/sessions/{session}/next", params={"child_id": alice}).json()["item"]
        api.post(f"/api/recognition/sessions/{session}/attempts", params={"child_id": alice}, json={"item_id": item["id"], "result": "correct", "assisted": False})
        api.post("/api/school-queue", params={"child_id": alice}, json={"character": "學", "school_source": "Private worksheet", "due_date": "2099-01-01"})
        before = api.get("/api/dashboard", params={"child_id": alice, "window": "all", "to_at": "2099-01-02T00:00:00Z"}).json()
        after = api.get("/api/dashboard", params={"child_id": bob, "window": "all", "to_at": "2099-01-02T00:00:00Z"}).json()
        assert before["child"]["name"] == "Alice"
        assert before["skills"]["recognition"]["independent_correct"] == 1
        assert before["skills"]["recognition"]["incorrect"] == 0
        assert before["school_queue"]["active"] == 1
        assert after["activity"]["attempts"]["attempts"] == 0
        assert after["school_queue"]["active"] == 0
        assert before["read_only"] is True


def test_dashboard_windows_and_skills_remain_separate(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post(f"/api/sprint-b/seed", params={"child_id": child_id})
        dashboard = api.get("/api/dashboard", params={"child_id": child_id, "window": "30d"}).json()
        assert set(dashboard["skills"]) == {"recognition", "writing", "word", "sentence", "pronunciation", "grammar", "idiom", "reading", "reading_aloud"}
        assert dashboard["window"]["name"] == "30d"
        assert "balance" in dashboard["points_rewards"]
        assert {"candidates", "confirmed", "items"} <= set(dashboard["ocr"])
        assert {"attempts", "completed", "aborted", "items"} <= set(dashboard["reading_aloud"])


def test_dashboard_rejects_invalid_window_and_unknown_child(tmp_path):
    with client(tmp_path) as api:
        assert api.get("/api/dashboard", params={"child_id": 999, "window": "7d"}).json()["detail"] == "child_not_found"
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        assert api.get("/api/dashboard", params={"child_id": child_id, "window": "bad"}).json()["detail"] == "invalid_window"

