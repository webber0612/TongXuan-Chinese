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


def test_queue_membership_is_replayed_from_lifecycle_history(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        school = api.post("/api/school-queue", params={"child_id": child_id}, json={"character": "學", "school_source": "Homework"}).json()
        seeded = api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]}).json()["items"][0]
        from app.database import connect
        with connect() as db:
            db.execute("UPDATE school_queue_items SET created_at=?,completed=1,completed_at=? WHERE id=?", ("2025-01-01 00:00:00", "2026-02-01 00:00:00", school["id"]))
            db.execute("INSERT INTO review_queue_items (id,child_id,item_id,character,source_detail,reason,created_at,active,deactivated_at) VALUES (?,?,?,?,?,?,?,?,?)", ("review-history", child_id, seeded["id"], "學", "Homework", "wrong", "2025-01-01 00:00:00", 0, "2026-02-01 00:00:00"))
        before = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "2026-01-15T00:00:00Z", "limit": 10}).json()
        after = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "2026-03-01T00:00:00Z", "limit": 10}).json()
        assert school["id"] in {item["source_id"] for item in before["items"]}
        assert "review-history" in {item["source_id"] for item in before["items"]}
        assert school["id"] not in {item["source_id"] for item in after["items"]}
        assert "review-history" not in {item["source_id"] for item in after["items"]}


def test_recent_error_only_counts_recent_incorrect_events_and_preference_is_audited(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        item = api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]}).json()["items"][0]
        from app.database import connect
        with connect() as db:
            db.execute("UPDATE learning_items SET created_at=? WHERE id=?", ("2025-01-01 00:00:00", item["id"]))
            db.execute("INSERT INTO learning_sessions (id,child_id,started_at) VALUES (?,?,?)", ("history-session", child_id, "2026-01-01 00:00:00"))
            db.execute("INSERT INTO recognition_attempts (id,child_id,item_id,timestamp,result,assisted,source_queue,session_id) VALUES (?,?,?,?,?,?,?,?)", ("old-wrong", child_id, item["id"], "2025-01-01 00:00:00", "incorrect", 0, "CURRICULUM", "history-session"))
            db.execute("INSERT INTO recognition_attempts (id,child_id,item_id,timestamp,result,assisted,source_queue,session_id) VALUES (?,?,?,?,?,?,?,?)", ("recent-right", child_id, item["id"], "2026-01-09 00:00:00", "correct", 0, "CURRICULUM", "history-session"))
        plan = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "2026-01-10T00:00:00Z", "limit": 10, "preference": "CURRICULUM"}).json()
        result = next(entry for entry in plan["items"] if entry["source_id"] == item["id"])
        assert result["components"]["recent_error"] == 0
        assert result["components"]["preference"] == 20
        assert result["priority_score"] == sum(result["components"].values())


def test_adaptive_plan_represents_multiple_skill_domains_without_merging_state(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post("/api/sprint-b/seed", params={"child_id": child_id})
        plan = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "2099-01-01T00:00:00Z", "limit": 20}).json()
        skills = {item["skill"] for item in plan["items"]}
        assert {"word", "sentence", "writing", "pronunciation", "grammar", "idiom", "reading", "reading_aloud"} <= skills
        assert all(item["priority_score"] == sum(item["components"].values()) for item in plan["items"])
        assert all(item["child_id"] == child_id for item in plan["items"])


def test_non_recognition_state_replays_attempts_at_as_of_not_current_snapshot(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post("/api/sprint-b/seed", params={"child_id": child_id})
        from app.database import connect
        with connect() as db:
            db.execute("UPDATE words SET created_at=? WHERE id=?", ("2026-01-01 00:00:00", f"word_{child_id}_school"))
            db.execute("INSERT INTO word_attempts (id,child_id,word_id,result,assisted,created_at) VALUES (?,?,?,?,?,?)", ("word-t1-correct", child_id, f"word_{child_id}_school", "correct", 0, "2026-01-10 00:00:00"))
            db.execute("INSERT INTO word_attempts (id,child_id,word_id,result,assisted,created_at) VALUES (?,?,?,?,?,?)", ("word-t3-incorrect", child_id, f"word_{child_id}_school", "incorrect", 0, "2026-03-10 00:00:00"))
            db.execute("INSERT INTO word_states (child_id,word_id,correct_count,incorrect_count,assisted_count,updated_at) VALUES (?,?,?,?,?,?)", (child_id, f"word_{child_id}_school", 1, 1, 0, "2026-03-10 00:00:00"))
        plan = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "2026-02-01T00:00:00Z", "limit": 50}).json()
        word = next(item for item in plan["items"] if item["skill"] == "word" and item["source_id"] == f"word_{child_id}_school")
        assert word["components"]["low_independent"] == 0
        assert word["components"]["recent_error"] == 0
        assert word["components"]["novelty"] == 0


def test_content_created_at_is_part_of_historical_plan_membership(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        from app.database import connect
        with connect() as db:
            db.execute("INSERT INTO words (id,child_id,word,provenance_status,source_name,source_url,license_name,commercial_ready,created_at) VALUES (?,?,?,?,?,?,?,?,?)", ("word-t2", child_id, "後來", "PRIVATE_OK", "test", "", "test", 0, "2026-03-01 00:00:00"))
            db.execute("INSERT INTO word_characters (word_id,character,position) VALUES (?,?,?)", ("word-t2", "後", 0))
        t1 = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "2026-02-01T00:00:00Z", "limit": 50}).json()
        t3 = api.post("/api/adaptive/plan", params={"child_id": child_id}, json={"as_of": "2026-04-01T00:00:00Z", "limit": 50}).json()
        assert "word-t2" not in {item["source_id"] for item in t1["items"]}
        assert "word-t2" in {item["source_id"] for item in t3["items"]}
