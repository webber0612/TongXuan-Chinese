import os
import sqlite3
import logging
from pathlib import Path

from fastapi.testclient import TestClient


def make_client(tmp_path: Path):
    os.environ.pop("TONGXUAN_ENV", None)
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "production.sqlite3")
    from app.main import app
    return TestClient(app)


def make_production_client(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("TONGXUAN_ENV", "production")
    monkeypatch.setenv("TONGXUAN_DB_PATH", str(tmp_path / "production.sqlite3"))
    monkeypatch.setenv("TONGXUAN_BACKUP_DIR", str(tmp_path / "backups"))
    monkeypatch.setenv("TONGXUAN_AUTH_SECRET", "production-test-secret-0123456789012345")
    monkeypatch.setenv("TONGXUAN_ALLOWED_ORIGINS", "https://family.example")
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


def test_sqlite_connection_policy_is_explicit(tmp_path):
    with make_client(tmp_path):
        from app.database import connect
        with connect() as db:
            assert db.execute("PRAGMA foreign_keys").fetchone()[0] == 1
            assert db.execute("PRAGMA busy_timeout").fetchone()[0] == 5000
            assert db.execute("PRAGMA journal_mode").fetchone()[0].lower() == "wal"
            assert db.execute("PRAGMA synchronous").fetchone()[0] == 1


def test_production_mutations_are_server_authenticated_and_privileged_bound(tmp_path, monkeypatch):
    from app.auth import issue_session
    with make_production_client(tmp_path, monkeypatch) as api:
        parent = {"Authorization": f"Bearer {issue_session(subject='parent', role='parent', child_ids=[1])}"}
        admin = {"Authorization": f"Bearer {issue_session(subject='admin', role='admin')}"}
        assert api.post("/api/tools/convert", json={"text": "學", "direction": "t2s"}).status_code == 401
        assert api.post("/api/tools/convert", headers=parent, json={"text": "學", "direction": "t2s"}).status_code == 403
        assert api.post("/api/tools/convert", headers=admin, json={"text": "學", "direction": "t2s"}).status_code == 200
        assert api.post("/api/diagnostics/sqlite", headers=parent).status_code == 403
        assert api.post("/api/diagnostics/sqlite", headers=admin).status_code == 200
        assert api.post("/api/children", headers=parent, json={"name": "forged"}).status_code == 403
        assert api.post("/api/children", headers=admin, json={"name": "authorized"}).status_code == 200
        assert api.post("/api/curriculum/catalog", headers=parent, json={"levels": []}).status_code == 403
        assert api.post("/api/curriculum/catalog", headers=admin, json={"levels": []}).status_code == 200


def test_production_logs_are_structured_and_do_not_include_sensitive_payloads(tmp_path, monkeypatch, caplog):
    with make_production_client(tmp_path, monkeypatch) as api:
        with caplog.at_level(logging.INFO, logger="tongxuan.production"):
            response = api.get("/api/health", headers={"X-Request-ID": "safe-request-1", "Authorization": "Bearer super-secret"})
        assert response.status_code == 200
        request_records = [record for record in caplog.records if record.getMessage() == "request"]
        assert request_records
        record = request_records[-1]
        assert record.request_id == "safe-request-1"
        assert record.status == 200
        assert record.latency_ms >= 0
        assert "super-secret" not in caplog.text
        assert "學校課文" not in caplog.text
        assert "audio/webm" not in caplog.text
