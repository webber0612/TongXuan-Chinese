"""Deterministic Phase 20 family release-candidate smoke harness."""
from __future__ import annotations

import os
import tempfile
import gc
import shutil
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient


def _assert(response: Any, expected: int = 200) -> dict[str, Any]:
    if response.status_code != expected:
        raise AssertionError(f"{response.request.method} {response.request.url} expected {expected}, got {response.status_code}: {response.text[:300]}")
    return response.json() if response.content else {}


def _snapshot() -> dict[str, list[tuple[Any, ...]]]:
    from backend.app.database import connect
    with connect() as db:
        tables = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        return {table: [tuple(row) for row in db.execute(f"SELECT * FROM {table} ORDER BY 1").fetchall()] for table in tables}


def run_smoke(dist: Path | None = None) -> dict[str, Any]:
    from backend.app.auth import issue_session
    from backend.app.production import backup_database, restore_database
    from scripts.production_check import check_dist

    env_keys = ("TONGXUAN_ENV", "BUILD_TARGET", "TONGXUAN_DB_PATH", "TONGXUAN_BACKUP_DIR", "TONGXUAN_AUTH_SECRET", "TONGXUAN_ALLOWED_ORIGINS")
    previous = {key: os.environ.get(key) for key in env_keys}
    temporary = tempfile.mkdtemp(prefix="tongxuan-phase20-")
    try:
        root = Path(temporary)
        os.environ.update({"TONGXUAN_ENV": "production", "BUILD_TARGET": "family", "TONGXUAN_DB_PATH": str(root / "data.sqlite3"), "TONGXUAN_BACKUP_DIR": str(root / "backups"), "TONGXUAN_AUTH_SECRET": "phase20-smoke-secret-01234567890123456789", "TONGXUAN_ALLOWED_ORIGINS": "https://family.example"})
        from backend.app.main import app
        admin = {"Authorization": f"Bearer {issue_session(subject='admin', role='admin')}"}
        with TestClient(app) as api:
            _assert(api.get("/api/health"))
            readiness = _assert(api.get("/api/readiness"))
            assert readiness["status"] == "READY"
            alice = _assert(api.post("/api/children", headers=admin, json={"name": "Alice"}))
            bob = _assert(api.post("/api/children", headers=admin, json={"name": "Bob"}))
            alice_id, bob_id = alice["id"], bob["id"]
            alice_session = {"Authorization": f"Bearer {issue_session(subject='alice-parent', role='parent', child_ids=[alice_id])}"}
            bob_session = {"Authorization": f"Bearer {issue_session(subject='bob-parent', role='parent', child_ids=[bob_id])}"}
            _assert(api.post(f"/api/children/{alice_id}/learning-items/seed", headers=alice_session, json={"characters": ["學"]}))
            _assert(api.post(f"/api/children/{bob_id}/learning-items/seed", headers=bob_session, json={"characters": ["学"]}))
            _assert(api.post("/api/sprint-b/seed", headers=alice_session, params={"child_id": alice_id}))
            catalog = {"levels": [{"id": "smoke-level", "title": "Smoke Level", "sequence": 1, "source_name": "Smoke curriculum", "source_url": "https://example.invalid/smoke", "license_name": "PRIVATE_OK", "provenance_status": "PRIVATE_OK", "units": [{"id": "smoke-unit", "title": "Smoke Unit", "sequence": 1, "source_name": "Smoke curriculum", "source_url": "https://example.invalid/smoke", "license_name": "PRIVATE_OK", "items": [{"id": "smoke-item", "item_type": "character", "content": "學", "sequence": 1, "source_name": "Smoke curriculum", "source_url": "https://example.invalid/smoke", "license_name": "PRIVATE_OK"}]}]}]}
            _assert(api.post("/api/curriculum/catalog", headers=admin, json=catalog))
            school = _assert(api.post("/api/school-queue", headers=alice_session, params={"child_id": alice_id}, json={"character": "學", "school_source": "Alice private worksheet"}))
            _assert(api.post("/api/tts/speak", headers=admin, json={"text": "學", "locale": "zh-TW", "text_kind": "character", "child_id": alice_id, "school_queue_item_id": school["id"]}))
            _assert(api.post("/api/tts/speak", headers=admin, json={"text": "學", "locale": "zh-CN", "text_kind": "character", "child_id": alice_id, "school_queue_item_id": school["id"]}), 400)
            _assert(api.post("/api/reading-aloud/attempts/start", headers=alice_session, params={"child_id": alice_id}, json={"text": "學", "text_kind": "character", "locale": "zh-TW"}))
            candidate = _assert(api.post("/api/ocr/imports/candidate", headers=alice_session, params={"child_id": alice_id}, json={"image_name": "worksheet.png", "source_label": "Alice worksheet", "candidate_hint": "學"}))
            _assert(api.post(f"/api/ocr/imports/{candidate['id']}/confirm", headers=alice_session, params={"child_id": alice_id}, json={"confirmed_text": "學", "locale": "zh-TW", "script": "TRADITIONAL"}))
            _assert(api.post(f"/api/children/{alice_id}/tutor/respond", headers=alice_session, json={"mode": "explain", "prompt": "Explain", "source_type": "CURRICULUM_ITEM", "source_id": "smoke-item", "locale": "zh-TW", "script": "TRADITIONAL"}))
            _assert(api.post("/api/adaptive/plan", headers=alice_session, params={"child_id": alice_id}, json={"as_of": "2026-01-01T00:00:00Z", "limit": 5}))
            before = _snapshot()
            alice_dashboard = _assert(api.get("/api/dashboard", headers=alice_session, params={"child_id": alice_id, "window": "all"}))
            assert all(item["private_content"] for item in alice_dashboard["school_queue"]["items"])
            assert api.get("/api/dashboard", headers=alice_session, params={"child_id": bob_id, "window": "all"}).status_code == 403
            bob_dashboard = _assert(api.get("/api/dashboard", headers=bob_session, params={"child_id": bob_id, "window": "all"}))
            assert school["id"] not in {item["id"] for item in bob_dashboard["school_queue"]["items"]}
            _assert(api.get(f"/api/children/{alice_id}/curriculum", headers=alice_session))
            _assert(api.get("/api/readiness"))
            _assert(api.get("/api/admin/commercialization/readiness", headers=admin))
            after = _snapshot()
            assert before == after, "read-only smoke reads mutated durable state"
        backup = backup_database(root / "backups" / "smoke.sqlite3", root / "data.sqlite3")
        restore_database(backup, root / "restored.sqlite3")
        artifact_errors = check_dist(dist) if dist else []
        if artifact_errors:
            raise AssertionError(f"PWA artifact errors: {artifact_errors}")
        return {"status": "PASS", "domains": ["recognition", "curriculum", "school_queue", "tts", "reading_aloud", "ocr", "tutor", "adaptive", "dashboard", "commercialization"], "read_only_verified": True}
    finally:
        gc.collect()
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        shutil.rmtree(temporary, ignore_errors=True)


if __name__ == "__main__":
    print(run_smoke(Path("frontend/dist")))
