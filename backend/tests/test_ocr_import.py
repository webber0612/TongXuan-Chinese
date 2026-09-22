from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "ocr.sqlite3")
    from app.main import app
    return TestClient(app)


def test_ocr_candidate_is_metadata_only_until_confirmation(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        candidate = api.post("/api/ocr/imports/candidate", params={"child_id": child_id}, json={"image_name": "worksheet.jpg", "source_label": "School worksheet", "candidate_hint": "學"}).json()
        assert candidate["review_status"] == "CANDIDATE"
        assert api.get("/api/daily-queue", params={"child_id": child_id}).json() == []
        from app.database import connect
        assert connect().execute("SELECT COUNT(*) FROM school_queue_items WHERE child_id=?", (child_id,)).fetchone()[0] == 0


def test_ocr_confirmation_creates_private_school_queue_only(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        candidate = api.post("/api/ocr/imports/candidate", params={"child_id": child_id}, json={"image_name": "worksheet.jpg", "source_label": "School worksheet", "candidate_hint": "學"}).json()
        result = api.post(f"/api/ocr/imports/{candidate['id']}/confirm", params={"child_id": child_id}, json={"confirmed_text": "學校", "locale": "zh-TW", "script": "TRADITIONAL"})
        assert result.status_code == 200
        body = result.json()
        assert body["confirmed_text"] == "學校" and body["review_status"] == "CONFIRMED"
        school = body["school_queue_item"]
        assert school["character"] == "學校" and school["private_content"] == 1 and school["provenance_status"] == "PRIVATE_OK"
        assert body["commercial_ready"] is False and body["provenance"]["source_type"] == "OCR_IMPORT"
        from app.database import connect
        assert connect().execute("SELECT COUNT(*) FROM learning_items WHERE child_id=? AND character=?", (child_id, "學校")).fetchone()[0] == 0


def test_ocr_child_isolation_duplicate_and_validation(tmp_path):
    with client(tmp_path) as api:
        alice = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        first = api.post("/api/ocr/imports/candidate", params={"child_id": alice}, json={"image_name": "worksheet.jpg", "source_label": "Same worksheet", "candidate_hint": "學"}).json()
        assert api.post(f"/api/ocr/imports/{first['id']}/confirm", params={"child_id": bob}, json={"confirmed_text": "學", "locale": "zh-TW", "script": "TRADITIONAL"}).json()["detail"] == "ocr_import_not_found"
        assert api.post(f"/api/ocr/imports/{first['id']}/confirm", params={"child_id": alice}, json={"confirmed_text": "", "locale": "zh-TW", "script": "TRADITIONAL"}).status_code == 422
        assert api.post(f"/api/ocr/imports/{first['id']}/confirm", params={"child_id": alice}, json={"confirmed_text": "学", "locale": "zh-TW", "script": "SIMPLIFIED"}).json()["detail"] == "script_locale_mismatch"
        assert api.post(f"/api/ocr/imports/{first['id']}/confirm", params={"child_id": alice}, json={"confirmed_text": "學", "locale": "zh-TW", "script": "SIMPLIFIED"}).json()["detail"] == "script_locale_mismatch"
        api.post(f"/api/ocr/imports/{first['id']}/confirm", params={"child_id": alice}, json={"confirmed_text": "學", "locale": "zh-TW", "script": "TRADITIONAL"})
        second = api.post("/api/ocr/imports/candidate", params={"child_id": alice}, json={"image_name": "worksheet-2.jpg", "source_label": "Same worksheet", "candidate_hint": "學"}).json()
        assert api.post(f"/api/ocr/imports/{second['id']}/confirm", params={"child_id": alice}, json={"confirmed_text": "學", "locale": "zh-TW", "script": "TRADITIONAL"}).json()["detail"] == "duplicate_ocr_import"


def test_ocr_does_not_mutate_mastery_state_or_accept_unknown_provider(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]})
        from app.database import connect
        tables = ("recognition_states", "writing_states", "reading_states", "pronunciation_states", "word_states", "grammar_states", "idiom_states")
        before = {table: [tuple(row) for row in connect().execute(f"SELECT * FROM {table} ORDER BY 1,2").fetchall()] for table in tables}
        assert api.post("/api/ocr/imports/candidate", params={"child_id": child_id}, json={"image_name": "worksheet.jpg", "source_label": "Worksheet", "provider_id": "unknown"}).json()["detail"] == "ocr_provider_unavailable"
        candidate = api.post("/api/ocr/imports/candidate", params={"child_id": child_id}, json={"image_name": "worksheet.jpg", "source_label": "Worksheet", "candidate_hint": "學"}).json()
        api.post(f"/api/ocr/imports/{candidate['id']}/confirm", params={"child_id": child_id}, json={"confirmed_text": "學", "locale": "zh-TW", "script": "TRADITIONAL"})
        after = {table: [tuple(row) for row in connect().execute(f"SELECT * FROM {table} ORDER BY 1,2").fetchall()] for table in tables}
        assert before == after


def test_ocr_ambiguous_text_still_requires_fixed_locale_script_pair(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        traditional = api.post("/api/ocr/imports/candidate", params={"child_id": child_id}, json={"image_name": "people.jpg", "source_label": "People worksheet", "candidate_hint": "人"}).json()
        assert api.post(f"/api/ocr/imports/{traditional['id']}/confirm", params={"child_id": child_id}, json={"confirmed_text": "人", "locale": "zh-TW", "script": "SIMPLIFIED"}).json()["detail"] == "script_locale_mismatch"
        assert api.post(f"/api/ocr/imports/{traditional['id']}/confirm", params={"child_id": child_id}, json={"confirmed_text": "人", "locale": "zh-TW", "script": "TRADITIONAL"}).status_code == 200
        simplified = api.post("/api/ocr/imports/candidate", params={"child_id": child_id}, json={"image_name": "people-2.jpg", "source_label": "People worksheet 2", "candidate_hint": "人"}).json()
        assert api.post(f"/api/ocr/imports/{simplified['id']}/confirm", params={"child_id": child_id}, json={"confirmed_text": "人", "locale": "zh-CN", "script": "SIMPLIFIED"}).status_code == 200
