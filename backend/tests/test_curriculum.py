from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "curriculum.sqlite3")
    from app.main import app
    return TestClient(app)


def catalog():
    source = {
        "source_name": "Family Curriculum Draft",
        "source_url": "https://example.invalid/family-curriculum",
        "license_name": "PRIVATE_OK",
        "provenance_status": "PRIVATE_OK",
        "commercial_ready": False,
        "commercial_action": "Review before commercial release",
    }
    return {"levels": [
        {"id": "level-2", "title": "Level Two", "sequence": 2, **source, "units": [{"id": "unit-2b", "title": "Second Unit", "sequence": 2, **source, "items": [{"id": "item-2b", "item_type": "character", "content": "國", "sequence": 2, **source}]}]},
        {"id": "level-1", "title": "Level One", "sequence": 1, **source, "units": [{"id": "unit-1a", "title": "First Unit", "sequence": 1, **source, "items": [{"id": "item-1a", "item_type": "character", "content": "學", "sequence": 1, **source}]}]},
    ]}


def test_curriculum_orders_hierarchy_and_preserves_provenance(tmp_path):
    with client(tmp_path) as api:
        response = api.post("/api/curriculum/catalog", json=catalog())
        assert response.status_code == 200
        result = response.json()
        assert [level["id"] for level in result["levels"]] == ["level-1", "level-2"]
        item = result["levels"][0]["units"][0]["items"][0]
        assert item["content"] == "學"
        assert item["source_name"] == "Family Curriculum Draft"
        assert item["license_name"] == "PRIVATE_OK"
        assert item["commercial_ready"] is False


def test_curriculum_child_progress_isolated_and_as_of_created_at(tmp_path):
    with client(tmp_path) as api:
        alice = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        api.post("/api/curriculum/catalog", json=catalog())
        from app.database import connect

        with connect() as db:
            db.execute("UPDATE curriculum_levels SET created_at=?", ("2026-01-01 09:00:00",))
            db.execute("UPDATE curriculum_units SET created_at=?", ("2026-01-01 09:00:00",))
            db.execute("UPDATE curriculum_items SET created_at=?", ("2026-01-01 09:00:00",))
            db.execute("UPDATE curriculum_items SET created_at=? WHERE id=?", ("2026-01-03 10:00:00", "item-2b"))
            db.execute("INSERT INTO curriculum_progress_events (id,child_id,curriculum_item_id,status,event_at) VALUES (?,?,?,?,?)", ("progress-t3", alice, "item-1a", "COMPLETED", "2026-01-03 12:00:00"))

        t2 = api.get(f"/api/children/{alice}/curriculum", params={"as_of": "2026-01-02T00:00:00Z"}).json()
        t4 = api.get(f"/api/children/{alice}/curriculum", params={"as_of": "2026-01-04T00:00:00Z"}).json()
        bob_view = api.get(f"/api/children/{bob}/curriculum", params={"as_of": "2026-01-04T00:00:00Z"}).json()
        assert [item["id"] for level in t2["levels"] for unit in level["units"] for item in unit["items"]] == ["item-1a"]
        assert t2["progress"]["completed"] == 0
        assert t4["progress"]["completed"] == 1
        assert bob_view["progress"]["completed"] == 0
        assert bob_view["levels"][0]["units"][0]["items"][0]["progress"]["status"] == "NOT_STARTED"


def test_curriculum_progress_does_not_promote_to_school_queue_or_merge_skill_state(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]})
        api.post("/api/curriculum/catalog", json=catalog())
        from app.database import connect

        with connect() as db:
            before = [tuple(row) for row in db.execute("SELECT * FROM recognition_states WHERE child_id=?", (child_id,)).fetchall()]
        progress = api.post(f"/api/children/{child_id}/curriculum/items/item-1a/progress", json={"status": "COMPLETED", "event_at": "2026-01-03T12:00:00Z"})
        assert progress.status_code == 200
        with connect() as db:
            after = [tuple(row) for row in db.execute("SELECT * FROM recognition_states WHERE child_id=?", (child_id,)).fetchall()]
            school_count = db.execute("SELECT COUNT(*) FROM school_queue_items WHERE child_id=?", (child_id,)).fetchone()[0]
        assert after == before
        assert school_count == 0
