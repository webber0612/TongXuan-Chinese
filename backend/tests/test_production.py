import os
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient


def make_client(tmp_path: Path):
    os.environ.pop("TONGXUAN_ENV", None)
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "production.sqlite3")
    from app.main import app
    return TestClient(app)


def test_health_and_readiness_are_deterministic_and_schema_versioned(tmp_path):
    with make_client(tmp_path) as api:
        assert api.get("/api/health").json() == {"status": "ok"}
        result = api.get("/api/readiness")
        assert result.status_code == 200
        body = result.json()
        assert body["status"] == "READY"
        assert body["checks"]["config"]["status"] == "PASS"
        assert body["checks"]["database"]["status"] == "PASS"
        assert body["schema_version"] == 1
        assert body["privacy"] == {"raw_request_bodies_logged": False, "secrets_exposed": False}
        assert result.headers["x-request-id"]


def test_production_config_fails_closed_without_secrets_or_wildcard_cors(monkeypatch):
    from app.config import load_settings, validate_settings
    monkeypatch.setenv("TONGXUAN_ENV", "production")
    monkeypatch.setenv("TONGXUAN_DB_PATH", "relative.sqlite3")
    monkeypatch.delenv("TONGXUAN_BACKUP_DIR", raising=False)
    monkeypatch.delenv("TONGXUAN_AUTH_SECRET", raising=False)
    monkeypatch.setenv("TONGXUAN_ALLOWED_ORIGINS", "*")
    errors = validate_settings(load_settings())
    assert {"production_db_path_must_be_absolute", "production_backup_dir_required", "production_auth_secret_required", "production_cors_origins_required"} <= set(errors)


def test_backup_and_restore_are_non_destructive_and_integrity_checked(tmp_path):
    with make_client(tmp_path) as api:
        api.post("/api/children", json={"name": "Backup child"})
    from app.production import backup_database, restore_database
    source = tmp_path / "production.sqlite3"
    backup = tmp_path / "backups" / "snapshot.sqlite3"
    restored = tmp_path / "restored.sqlite3"
    assert backup_database(backup, source) == backup
    assert sqlite3.connect(backup).execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    assert restore_database(backup, restored) == restored
    with sqlite3.connect(restored) as db:
        assert db.execute("SELECT COUNT(*) FROM children WHERE name=?", ("Backup child",)).fetchone()[0] == 1
    try:
        backup_database(backup, source)
    except FileExistsError:
        pass
    else:
        raise AssertionError("backup must not overwrite without explicit opt-in")
