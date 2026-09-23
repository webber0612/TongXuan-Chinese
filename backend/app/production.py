"""Readiness, safe storage contracts, and privacy-safe production checks."""
from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any

from .config import Settings, validate_settings
from .commercialization import audit_registry
from .database import SCHEMA_VERSION, connect, database_path

logger = logging.getLogger("tongxuan.production")


def _integrity(path: Path) -> tuple[bool, str]:
    if not path.is_file():
        return False, "database_missing"
    try:
        with sqlite3.connect(path) as db:
            result = db.execute("PRAGMA integrity_check").fetchone()[0]
            version = int(db.execute("PRAGMA user_version").fetchone()[0])
        if result != "ok":
            return False, "database_integrity_failed"
        if version != SCHEMA_VERSION:
            return False, "schema_version_mismatch"
        return True, "ok"
    except (OSError, sqlite3.Error, ValueError):
        return False, "database_unavailable"


def readiness(settings: Settings) -> dict[str, Any]:
    config_errors = validate_settings(settings)
    db_ok, db_detail = _integrity(database_path())
    gate = audit_registry(settings.build_target)
    checks = {
        "config": {"status": "PASS" if not config_errors else "FAIL", "errors": config_errors},
        "database": {"status": "PASS" if db_ok else "FAIL", "detail": db_detail},
        "commercialization": {"status": "PASS" if settings.build_target == "family" or gate["status"] == "PASS" else "FAIL", "gate_status": gate["status"], "blockers": gate["commercial_blockers"]},
    }
    ready = not config_errors and db_ok and (settings.build_target == "family" or gate["status"] == "PASS")
    return {"status": "READY" if ready else "NOT_READY", "checks": checks, "schema_version": SCHEMA_VERSION, "build_target": settings.build_target, "privacy": {"raw_request_bodies_logged": False, "secrets_exposed": False}}


def backup_database(destination: Path, source: Path | None = None, *, overwrite: bool = False) -> Path:
    source = source or database_path()
    destination = Path(destination)
    if source.resolve() == destination.resolve():
        raise ValueError("backup_destination_must_differ")
    if destination.exists() and not overwrite:
        raise FileExistsError("backup_exists_use_explicit_overwrite")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    if temporary.exists():
        temporary.unlink()
    source_db = sqlite3.connect(source)
    target_db = sqlite3.connect(temporary)
    try:
        source_db.backup(target_db)
        target_db.commit()
    finally:
        target_db.close()
        source_db.close()
    temporary.replace(destination)
    ok, detail = _integrity(destination)
    if not ok:
        destination.unlink(missing_ok=True)
        raise RuntimeError(detail)
    return destination


def restore_database(backup: Path, destination: Path, *, overwrite: bool = False) -> Path:
    backup = Path(backup)
    destination = Path(destination)
    if destination.exists() and not overwrite:
        raise FileExistsError("restore_destination_exists_use_explicit_overwrite")
    ok, detail = _integrity(backup)
    if not ok:
        raise ValueError(f"invalid_backup:{detail}")
    return backup_database(destination, backup, overwrite=overwrite)


def structured_error(request_id: str, code: str = "internal_error") -> dict[str, Any]:
    return {"detail": code, "error": {"code": code, "request_id": request_id}}


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "event": record.getMessage(),
            "level": record.levelname,
            "request_id": getattr(record, "request_id", None),
            "route": getattr(record, "route", None),
            "status": getattr(record, "status", None),
            "latency_ms": getattr(record, "latency_ms", None),
        }, ensure_ascii=False)
