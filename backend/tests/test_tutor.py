from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "tutor.sqlite3")
    from app.main import app
    return TestClient(app)


def curriculum_payload():
    source = {"source_name": "Tutor Test Curriculum", "source_url": "https://example.invalid/tutor", "license_name": "PRIVATE_OK", "provenance_status": "PRIVATE_OK", "commercial_ready": False, "commercial_action": "Review before commercial release"}
    return {"levels": [{"id": "tutor-level", "title": "Tutor Level", "sequence": 1, **source, "units": [{"id": "tutor-unit", "title": "Tutor Unit", "sequence": 1, **source, "items": [{"id": "tutor-item", "item_type": "sentence", "content": "學而時習之", "sequence": 1, **source}, {"id": "tutor-simplified", "item_type": "sentence", "content": "学习", "sequence": 2, **source}]}]}]}


def test_tutor_is_retrieval_first_allowed_modes_and_safe_boundary(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post("/api/curriculum/catalog", json=curriculum_payload())
        response = api.post(f"/api/children/{child_id}/tutor/respond", json={"mode": "sentence-hint", "prompt": "Help me begin", "source_type": "CURRICULUM_ITEM", "source_id": "tutor-item", "locale": "zh-TW", "script": "TRADITIONAL"})
        assert response.status_code == 200
        result = response.json()
        assert result["source"]["content"] == "學而時習之"
        assert result["source"]["license_name"] == "PRIVATE_OK"
        assert result["source"]["locale"] == "zh-TW" and result["source"]["script"] == "TRADITIONAL"
        assert result["safety"] == {"decides_correctness": False, "provides_answer_key": False, "scores": False, "mutates_mastery": False, "changes_adaptive_ranking": False, "exports_cloud": False}
        assert result["provider_id"] == "deterministic-local-tutor"


def test_tutor_child_isolation_and_school_provenance(tmp_path):
    with client(tmp_path) as api:
        alice = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        school = api.post("/api/school-queue", params={"child_id": alice}, json={"character": "學", "school_source": "Alice private worksheet", "private_content": True, "provenance_status": "PRIVATE_OK"}).json()
        allowed = api.post(f"/api/children/{alice}/tutor/respond", json={"mode": "explain", "prompt": "Explain this", "source_type": "SCHOOL_QUEUE", "source_id": school["id"]})
        denied = api.post(f"/api/children/{bob}/tutor/respond", json={"mode": "explain", "prompt": "Explain this", "source_type": "SCHOOL_QUEUE", "source_id": school["id"]})
        assert allowed.status_code == 200
        assert allowed.json()["source"]["private_content"] is True
        assert allowed.json()["source"]["provenance_status"] == "PRIVATE_OK"
        assert denied.status_code == 404


def test_tutor_validates_locale_script_against_authoritative_curriculum_and_school_text(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post("/api/curriculum/catalog", json=curriculum_payload())
        traditional_ok = api.post(f"/api/children/{child_id}/tutor/respond", json={"mode": "explain", "prompt": "Explain", "source_type": "CURRICULUM_ITEM", "source_id": "tutor-item", "locale": "zh-TW", "script": "TRADITIONAL"})
        traditional_bad = api.post(f"/api/children/{child_id}/tutor/respond", json={"mode": "explain", "prompt": "Explain", "source_type": "CURRICULUM_ITEM", "source_id": "tutor-item", "locale": "zh-CN", "script": "SIMPLIFIED"})
        simplified_ok = api.post(f"/api/children/{child_id}/tutor/respond", json={"mode": "explain", "prompt": "Explain", "source_type": "CURRICULUM_ITEM", "source_id": "tutor-simplified", "locale": "zh-CN", "script": "SIMPLIFIED"})
        school = api.post("/api/school-queue", params={"child_id": child_id}, json={"character": "學", "school_source": "Private worksheet"}).json()
        school_ok = api.post(f"/api/children/{child_id}/tutor/respond", json={"mode": "explain", "prompt": "Explain", "source_type": "SCHOOL_QUEUE", "source_id": school["id"], "locale": "zh-TW", "script": "TRADITIONAL"})
        school_bad = api.post(f"/api/children/{child_id}/tutor/respond", json={"mode": "explain", "prompt": "Explain", "source_type": "SCHOOL_QUEUE", "source_id": school["id"], "locale": "zh-CN", "script": "SIMPLIFIED"})
        assert traditional_ok.status_code == 200
        assert traditional_bad.status_code == 400 and traditional_bad.json()["detail"] == "source_locale_script_mismatch"
        assert simplified_ok.status_code == 200
        assert school_ok.status_code == 200
        assert school_bad.status_code == 400 and school_bad.json()["detail"] == "source_locale_script_mismatch"


def test_tutor_rejects_unsupported_modes_locale_script_and_never_mutates_state(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post("/api/curriculum/catalog", json=curriculum_payload())
        from app.database import connect

        with connect() as db:
            before = {table: [tuple(row) for row in db.execute(f"SELECT * FROM {table} ORDER BY 1").fetchall()] for table in ("recognition_states", "word_states", "school_queue_items", "curriculum_progress_events")}
        bad_mode = api.post(f"/api/children/{child_id}/tutor/respond", json={"mode": "score", "prompt": "What is correct?", "source_type": "CURRICULUM_ITEM", "source_id": "tutor-item"})
        bad_locale = api.post(f"/api/children/{child_id}/tutor/respond", json={"mode": "explain", "prompt": "Explain", "source_type": "CURRICULUM_ITEM", "source_id": "tutor-item", "locale": "zh-TW", "script": "SIMPLIFIED"})
        assert bad_mode.status_code == 400
        assert bad_locale.status_code == 400
        with connect() as db:
            after = {table: [tuple(row) for row in db.execute(f"SELECT * FROM {table} ORDER BY 1").fetchall()] for table in before}
        assert after == before


def test_tutor_deterministically_refuses_without_authoritative_context(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        response = api.post(f"/api/children/{child_id}/tutor/respond", json={"mode": "explain", "prompt": "Help me"})
        assert response.status_code == 200
        result = response.json()
        assert result["source"] is None
        assert result["response"] == "I need an authoritative curriculum or School Queue source before I can help."
