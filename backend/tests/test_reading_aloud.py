from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "reading-aloud.sqlite3")
    from app.main import app
    return TestClient(app)


def test_reading_aloud_attempt_lifecycle_persists_metadata_without_audio(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        started = api.post("/api/reading-aloud/attempts/start", params={"child_id": child_id}, json={"text": "學", "text_kind": "character", "locale": "zh-TW"})
        assert started.status_code == 200
        attempt = started.json()
        assert attempt["completed_at"] is None and attempt["text_snapshot"] == "學"
        completed = api.post(f"/api/reading-aloud/attempts/{attempt['id']}/complete", params={"child_id": child_id}, json={"duration_ms": 1800})
        assert completed.status_code == 200
        result = completed.json()
        assert result["duration_ms"] == 1800 and result["completed_at"] is not None
        from app.database import connect
        columns = {row[1] for row in connect().execute("PRAGMA table_info(reading_aloud_attempts)")}
        assert "audio_blob" not in columns and "audio_base64" not in columns


def test_reading_aloud_child_and_source_ownership_and_provenance(tmp_path):
    with client(tmp_path) as api:
        alice = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        school = api.post("/api/school-queue", params={"child_id": alice}, json={"character": "学", "school_source": "Private worksheet", "private_content": True, "provenance_status": "PRIVATE_OK"}).json()
        ok = api.post("/api/reading-aloud/attempts/start", params={"child_id": alice}, json={"text": "学", "text_kind": "character", "locale": "zh-CN", "source_type": "SCHOOL_QUEUE", "source_id": school["id"]})
        assert ok.status_code == 200 and ok.json()["provenance"]["source_type"] == "SCHOOL_QUEUE_PRIVATE"
        assert api.post("/api/reading-aloud/attempts/start", params={"child_id": bob}, json={"text": "学", "text_kind": "character", "locale": "zh-CN", "source_type": "SCHOOL_QUEUE", "source_id": school["id"]}).json()["detail"] == "source_not_found"


def test_reading_aloud_rejects_source_text_locale_and_input_errors(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        school = api.post("/api/school-queue", params={"child_id": child_id}, json={"character": "学", "school_source": "Private worksheet"}).json()
        base = {"text_kind": "character", "source_type": "SCHOOL_QUEUE", "source_id": school["id"]}
        assert api.post("/api/reading-aloud/attempts/start", params={"child_id": child_id}, json={**base, "text": "別的字", "locale": "zh-CN"}).json()["detail"] == "source_text_mismatch"
        assert api.post("/api/reading-aloud/attempts/start", params={"child_id": child_id}, json={**base, "text": "学", "locale": "zh-TW"}).json()["detail"] == "source_locale_mismatch"
        assert api.post("/api/reading-aloud/attempts/start", params={"child_id": child_id}, json={"text": "", "text_kind": "character", "locale": "zh-TW"}).status_code == 422
        assert api.post("/api/reading-aloud/attempts/start", params={"child_id": child_id}, json={"text": "學", "text_kind": "audio", "locale": "zh-TW"}).json()["detail"] == "unsupported_text_kind"


def test_reading_aloud_does_not_mutate_learning_states(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]})
        api.post("/api/sprint-b/seed", params={"child_id": child_id})
        from app.database import connect
        tables = ("recognition_states", "writing_states", "reading_states", "pronunciation_states", "word_states", "grammar_states", "idiom_states")
        before = {table: [tuple(row) for row in connect().execute(f"SELECT * FROM {table} ORDER BY 1,2").fetchall()] for table in tables}
        attempt = api.post("/api/reading-aloud/attempts/start", params={"child_id": child_id}, json={"text": "學校", "text_kind": "word", "locale": "zh-TW"}).json()
        api.post(f"/api/reading-aloud/attempts/{attempt['id']}/complete", params={"child_id": child_id}, json={"duration_ms": 1000})
        after = {table: [tuple(row) for row in connect().execute(f"SELECT * FROM {table} ORDER BY 1,2").fetchall()] for table in tables}
        assert before == after
