"""Phase 16 long-term curriculum catalog and child-scoped read model."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from .database import connect, initialize_database
from .learning import ensure_child, now, uid

STATUSES = {"NOT_STARTED", "IN_PROGRESS", "COMPLETED"}


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("invalid_as_of") from error
    return parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed


def _stamp(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S")


def _source(row: Any) -> dict[str, Any]:
    return {
        "source_name": row["source_name"],
        "source_url": row["source_url"],
        "license_name": row["license_name"],
        "provenance_status": row["provenance_status"],
        "commercial_ready": bool(row["commercial_ready"]),
        "commercial_action": row["commercial_action"],
    }


def _validate_source(source: dict[str, Any]) -> None:
    if not str(source.get("source_name", "")).strip() or not str(source.get("license_name", "")).strip():
        raise ValueError("source_and_license_required")


def seed_catalog(levels: list[dict[str, Any]]) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        for level in levels:
            _validate_source(level)
            for unit in level["units"]:
                _validate_source(unit)
                for item in unit["items"]:
                    _validate_source(item)
        for level in levels:
            level_id = level.get("id") or uid("level")
            db.execute(
                "INSERT INTO curriculum_levels (id,title,sequence,source_name,source_url,license_name,provenance_status,commercial_ready,commercial_action) VALUES (?,?,?,?,?,?,?,?,?)",
                (level_id, level["title"], level["sequence"], level["source_name"], level.get("source_url", ""), level["license_name"], level.get("provenance_status", "PRIVATE_OK"), int(level.get("commercial_ready", False)), level.get("commercial_action", "")),
            )
            for unit in level["units"]:
                unit_id = unit.get("id") or uid("unit")
                db.execute(
                    "INSERT INTO curriculum_units (id,level_id,title,sequence,source_name,source_url,license_name,provenance_status,commercial_ready,commercial_action) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (unit_id, level_id, unit["title"], unit["sequence"], unit["source_name"], unit.get("source_url", ""), unit["license_name"], unit.get("provenance_status", "PRIVATE_OK"), int(unit.get("commercial_ready", False)), unit.get("commercial_action", "")),
                )
                for item in unit["items"]:
                    item_id = item.get("id") or uid("curriculum-item")
                    db.execute(
                        "INSERT INTO curriculum_items (id,unit_id,item_type,content,sequence,source_name,source_url,license_name,provenance_status,commercial_ready,commercial_action) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                        (item_id, unit_id, item["item_type"], item["content"], item["sequence"], item["source_name"], item.get("source_url", ""), item["license_name"], item.get("provenance_status", "PRIVATE_OK"), int(item.get("commercial_ready", False)), item.get("commercial_action", "")),
                    )
    return get_curriculum(levels=None, child_id=None, as_of=None)


def get_curriculum(*, levels: list[dict[str, Any]] | None, child_id: int | None, as_of: str | None) -> dict[str, Any]:
    del levels
    initialize_database()
    # SQLite CURRENT_TIMESTAMP has second precision and the application/test
    # clock can cross a second between insert and read. Include that current
    # write boundary only for an implicit live read; explicit as_of remains exact.
    end = _parse(as_of) or datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=5)
    end_text = _stamp(end)
    with connect() as db:
        if child_id is not None:
            ensure_child(db, child_id)
        level_rows = db.execute("SELECT * FROM curriculum_levels WHERE created_at<=? ORDER BY sequence,id", (end_text,)).fetchall()
        unit_rows = db.execute("SELECT * FROM curriculum_units WHERE created_at<=? ORDER BY sequence,id", (end_text,)).fetchall()
        item_rows = db.execute("SELECT * FROM curriculum_items WHERE created_at<=? ORDER BY sequence,id", (end_text,)).fetchall()
        level_ids = {row["id"] for row in level_rows}
        units_by_level: dict[str, list[Any]] = {}
        for row in unit_rows:
            if row["level_id"] in level_ids:
                units_by_level.setdefault(row["level_id"], []).append(row)
        unit_ids = {row["id"] for rows in units_by_level.values() for row in rows}
        items_by_unit: dict[str, list[Any]] = {}
        for row in item_rows:
            if row["unit_id"] in unit_ids:
                items_by_unit.setdefault(row["unit_id"], []).append(row)
        progress: dict[str, dict[str, Any]] = {}
        if child_id is not None and items_by_unit:
            rows = db.execute("SELECT * FROM curriculum_progress_events WHERE child_id=? AND event_at<=? ORDER BY event_at,id", (child_id, end_text)).fetchall()
            valid_item_ids = {row["id"] for rows in items_by_unit.values() for row in rows}
            for row in rows:
                if row["curriculum_item_id"] in valid_item_ids:
                    progress[row["curriculum_item_id"]] = {"status": row["status"], "event_at": row["event_at"]}

        result_levels = []
        counts = {status: 0 for status in STATUSES}
        for level in level_rows:
            result_units = []
            for unit in units_by_level.get(level["id"], []):
                result_items = []
                for item in items_by_unit.get(unit["id"], []):
                    item_progress = progress.get(item["id"], {"status": "NOT_STARTED", "event_at": None})
                    counts[item_progress["status"]] += 1
                    result_items.append({"id": item["id"], "item_type": item["item_type"], "content": item["content"], "sequence": item["sequence"], **_source(item), "created_at": item["created_at"], "progress": item_progress})
                result_units.append({"id": unit["id"], "title": unit["title"], "sequence": unit["sequence"], **_source(unit), "created_at": unit["created_at"], "items": result_items})
            result_levels.append({"id": level["id"], "title": level["title"], "sequence": level["sequence"], **_source(level), "created_at": level["created_at"], "units": result_units})
        return {"as_of": end_text, "child_id": child_id, "levels": result_levels, "progress": {"total": sum(counts.values()), **{key.lower(): value for key, value in counts.items()}}}


def record_progress(*, child_id: int, item_id: str, status: str, event_at: str | None) -> dict[str, Any]:
    if status not in STATUSES:
        raise ValueError("invalid_progress_status")
    initialize_database()
    occurred = _parse(event_at) or datetime.now(timezone.utc).replace(tzinfo=None)
    with connect() as db:
        ensure_child(db, child_id)
        item = db.execute("SELECT id FROM curriculum_items WHERE id=?", (item_id,)).fetchone()
        if item is None:
            raise ValueError("curriculum_item_not_found")
        event_id = uid("curriculum-progress")
        db.execute("INSERT INTO curriculum_progress_events (id,child_id,curriculum_item_id,status,event_at,created_at) VALUES (?,?,?,?,?,?)", (event_id, child_id, item_id, status, _stamp(occurred), now()))
        return {"id": event_id, "child_id": child_id, "curriculum_item_id": item_id, "status": status, "event_at": _stamp(occurred)}
