from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "tts.sqlite3")
    from app.main import app
    return TestClient(app)


def test_tts_routes_locale_payload_kinds_and_rate(tmp_path):
    with client(tmp_path) as api:
        for locale in ("zh-TW", "zh-CN"):
            for text_kind, text in (("character", "學"), ("word", "學校"), ("sentence", "我在學校。"), ("passage", "我每天到學校學習。")):
                result = api.post("/api/tts/speak", json={"locale": locale, "text_kind": text_kind, "text": text, "rate": 0.8}).json()
                assert result == {
                    "provider": "browser-speech-synthesis",
                    "locale": locale,
                    "voice_locale": locale,
                    "text": text,
                    "text_kind": text_kind,
                    "rate": 0.8,
                    "playback_only": True,
                    "persisted": False,
                    "provenance": None,
                }


def test_tts_rejects_unsupported_locale_invalid_kind_and_input(tmp_path):
    with client(tmp_path) as api:
        assert api.post("/api/tts/speak", json={"locale": "en-US", "text_kind": "word", "text": "學校"}).json()["detail"] == "unsupported_locale"
        assert api.post("/api/tts/speak", json={"locale": "zh-TW", "text_kind": "audio", "text": "學校"}).json()["detail"] == "unsupported_text_kind"
        assert api.post("/api/tts/speak", json={"locale": "zh-TW", "text_kind": "word", "text": "   "}).json()["detail"] == "text_required"
        assert api.post("/api/tts/speak", json={"locale": "zh-TW", "text_kind": "word", "text": "學校", "rate": 3}).status_code == 422


def test_tts_does_not_change_any_learning_state(tmp_path):
    with client(tmp_path) as api:
        child = api.post("/api/children", json={"name": "Alice"}).json()
        child_id = child["id"]
        assert api.post(f"/api/children/{child_id}/learning-items/seed", json={"characters": ["學"]}).status_code == 200
        assert api.post("/api/sprint-b/seed", params={"child_id": child_id}).status_code == 200
        from app.database import connect
        tables = ("recognition_states", "writing_states", "reading_states", "pronunciation_states", "word_states", "grammar_states", "idiom_states")
        before = {table: [tuple(row) for row in connect().execute(f"SELECT * FROM {table} ORDER BY 1,2").fetchall()] for table in tables}
        result = api.post("/api/tts/speak", json={"locale": "zh-TW", "text_kind": "sentence", "text": "我在學校。", "child_id": child_id}).json()
        after = {table: [tuple(row) for row in connect().execute(f"SELECT * FROM {table} ORDER BY 1,2").fetchall()] for table in tables}
        assert result["playback_only"] is True and result["persisted"] is False
        assert before == after


def test_tts_preserves_school_queue_private_provenance_and_child_boundary(tmp_path):
    with client(tmp_path) as api:
        alice = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        school = api.post("/api/school-queue", params={"child_id": alice}, json={"character": "学", "school_source": "Private worksheet", "private_content": True, "provenance_status": "PRIVATE_OK"}).json()
        result = api.post("/api/tts/speak", json={"locale": "zh-CN", "text_kind": "character", "text": "学", "child_id": alice, "school_queue_item_id": school["id"]}).json()
        assert result["provenance"] == {"source_type": "SCHOOL_QUEUE_PRIVATE", "source_id": school["id"], "status": "PRIVATE_OK", "private_content": True}
        assert api.post("/api/tts/speak", json={"locale": "zh-CN", "text_kind": "character", "text": "学", "child_id": bob, "school_queue_item_id": school["id"]}).json()["detail"] == "school_queue_item_not_found"
        assert api.get("/api/daily-queue", params={"child_id": alice}).json()[0]["id"] == school["id"]
        assert api.get("/api/daily-queue", params={"child_id": bob}).json() == []
