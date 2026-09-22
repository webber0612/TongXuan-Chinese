from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "adaptive.sqlite3")
    from app.main import app
    return TestClient(app)


def test_adaptive_plan_is_deterministic_as_of_and_explainable(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學", "学", "國"]})
        as_of = "2099-01-01T00:00:00Z"
        first = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": as_of, "limit": 10}).json()
        second = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": as_of, "limit": 10}).json()
        assert first == second
        assert first["as_of"] == "2099-01-01 00:00:00"
        assert all(item["child_id"] == child_id and item["components"] and item["reasons"] for item in first["items"])
        assert all(item["priority_score"] == sum(item["components"].values()) for item in first["items"])


def test_adaptive_priority_and_no_lookahead(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        seeded = api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學", "学"]}).json()["items"]
        from app.database import connect
        with connect() as db:
            db.execute("INSERT INTO recognition_states (child_id,item_id,due_at,updated_at) VALUES (?,?,?,?)", (child_id, seeded[0]["id"], "2020-01-01 00:00:00", "2020-01-01 00:00:00"))
            db.execute("INSERT INTO learning_sessions (id,child_id,started_at) VALUES (?,?,?)", ("future-session", child_id, "2099-01-01 00:00:00"))
            db.execute("INSERT INTO recognition_attempts (id,child_id,item_id,timestamp,result,assisted,source_queue,session_id) VALUES (?,?,?,?,?,?,?,?)", ("future-attempt", child_id, seeded[1]["id"], "2100-01-02 00:00:00", "incorrect", 0, "CURRICULUM", "future-session"))
        before = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "2099-01-01T00:00:00Z", "limit": 10}).json()
        overdue = next(item for item in before["items"] if item["source_id"] == seeded[0]["id"])
        future = next(item for item in before["items"] if item["source_id"] == seeded[1]["id"])
        assert overdue["components"]["overdue"] > 0
        assert future["components"]["recent_error"] == 0
        assert "recent incorrect" not in future["reasons"]


def test_anti_starvation_child_isolation_and_manual_fallback(tmp_path):
    with client(tmp_path) as api:
        alice = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        items = api.post(f"/api/children/{alice}/learning-items/seed", json={"characters": ["學", "学", "國", "国"]}).json()["items"]
        api.post("/api/school-queue", params={"child_id": alice}, json={"character": "學校", "school_source": "Homework", "priority": 10, "due_date": "2020-01-01"})
        from app.database import connect
        with connect() as db:
            for index, item in enumerate(items[:2]):
                db.execute("INSERT INTO review_queue_items (id,child_id,item_id,character,source_detail,reason,priority,created_at) VALUES (?,?,?,?,?,?,?,?)", (f"review-{index}", alice, item["id"], item["character"], "Wrong Answer", "missed", 10, "2020-01-01 00:00:00"))
        plan = api.post("/api/adaptive/plan", params={"child_id": alice}, json={"as_of": "2099-01-01T00:00:00Z", "limit": 6}).json()
        assert {item["source"] for item in plan["items"]} >= {"CURRICULUM", "SCHOOL_QUEUE", "REVIEW"}
        fallback = api.post("/api/adaptive/plan", params={"child_id": alice}, json={"as_of": "2099-01-01T00:00:00Z", "limit": 6, "adaptive": False}).json()
        assert all(item["priority_score"] == 0 and item["components"]["overdue"] == 0 for item in fallback["items"])
        assert api.post("/api/adaptive/plan", params={"child_id": bob}, json={"as_of": "2099-01-01T00:00:00Z", "limit": 6}).json()["items"] == []


def test_adaptive_preference_and_invalid_as_of_do_not_mutate_state(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]})
        from app.database import connect
        before = {table: [tuple(row) for row in connect().execute(f"SELECT * FROM {table} ORDER BY 1,2").fetchall()] for table in ("recognition_states", "recognition_attempts", "points_ledger", "reward_redemptions", "school_queue_items")}
        assert api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "not-a-time"}).json()["detail"] == "invalid_as_of"
        plan = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "2099-01-01T00:00:00Z", "preference": "CURRICULUM"}).json()
        assert plan["preference"] == "CURRICULUM"
        after = {table: [tuple(row) for row in connect().execute(f"SELECT * FROM {table} ORDER BY 1,2").fetchall()] for table in ("recognition_states", "recognition_attempts", "points_ledger", "reward_redemptions", "school_queue_items")}
        assert before == after
