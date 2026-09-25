"""Phase 12 Reading Aloud metadata boundary.

Raw microphone data stays in the browser session. This module persists only
auditable attempt metadata and never updates a learning mastery table.
"""

import json
import sqlite3
from typing import Any

from .database import connect, initialize_database
from .learning import ensure_child, now, uid
from .tts import SUPPORTED_LOCALES, SUPPORTED_TEXT_KINDS, _source_locale

SUPPORTED_SOURCE_TYPES = {"TRANSIENT_TEXT", "CURRICULUM", "WORD", "SENTENCE", "PASSAGE", "SCHOOL_QUEUE"}
SOURCE_TEXT_KINDS = {
    "CURRICULUM": "character",
    "SCHOOL_QUEUE": "character",
    "WORD": "word",
    "SENTENCE": "sentence",
    "PASSAGE": "passage",
}


def _provenance(row: sqlite3.Row, source_type: str, source_id: str) -> dict[str, Any]:
    return {
        "source_type": source_type,
        "source_id": source_id,
        "status": row["provenance_status"] if "provenance_status" in row.keys() else "PRIVATE_OK",
        "private_content": bool(row["private_content"]) if "private_content" in row.keys() else False,
    }


def _resolve_source(db: sqlite3.Connection, child_id: int, source_type: str, source_id: str | None, text: str, locale: str, text_kind: str) -> dict[str, Any] | None:
    if source_type == "TRANSIENT_TEXT":
        if source_id is not None:
            raise ValueError("source_id_not_allowed_for_transient_text")
        return None
    if source_type not in SUPPORTED_SOURCE_TYPES or source_id is None:
        raise ValueError("unsupported_source")
    if text_kind != SOURCE_TEXT_KINDS[source_type]:
        raise ValueError("source_text_kind_mismatch")
    queries = {
        "CURRICULUM": ("SELECT * FROM learning_items WHERE id=? AND child_id=?", "character"),
        "WORD": ("SELECT * FROM words WHERE id=? AND child_id=?", "word"),
        "SENTENCE": ("SELECT * FROM sentences WHERE id=? AND child_id=?", "sentence"),
        "PASSAGE": ("SELECT * FROM reading_passages WHERE id=? AND child_id=?", "passage"),
        "SCHOOL_QUEUE": ("SELECT * FROM school_queue_items WHERE id=? AND child_id=?", "character"),
    }
    query, text_column = queries[source_type]
    row = db.execute(query, (source_id, child_id)).fetchone()
    if row is None:
        raise ValueError("source_not_found")
    source_text = str(row[text_column])
    if text.strip() != source_text:
        raise ValueError("source_text_mismatch")
    expected_locale = _source_locale(source_text)
    if expected_locale is None:
        raise ValueError("source_script_unknown")
    if locale != expected_locale:
        raise ValueError("source_locale_mismatch")
    provenance = _provenance(row, "SCHOOL_QUEUE_PRIVATE" if source_type == "SCHOOL_QUEUE" else source_type, source_id)
    return provenance


def start_attempt(*, child_id: int, text: str, text_kind: str, locale: str, source_type: str, source_id: str | None, assisted: bool, manual_review: bool, activity_domain: str = "speaking") -> dict[str, Any]:
    if not text.strip():
        raise ValueError("text_required")
    if text_kind not in SUPPORTED_TEXT_KINDS:
        raise ValueError("unsupported_text_kind")
    if locale not in SUPPORTED_LOCALES:
        raise ValueError("unsupported_locale")
    if source_type not in SUPPORTED_SOURCE_TYPES:
        raise ValueError("unsupported_source")
    if activity_domain not in {"speaking", "pronunciation"}:
        raise ValueError("unsupported_reading_aloud_domain")
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        provenance = _resolve_source(db, child_id, source_type, source_id, text, locale, text_kind)
        attempt_id = uid("reading_aloud")
        started_at = now()
        db.execute(
            """INSERT INTO reading_aloud_attempts
               (id, child_id, source_type, source_id, text_snapshot, text_kind, locale,
               started_at, status, assisted, manual_review, provenance_json, activity_domain)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (attempt_id, child_id, source_type, source_id, text.strip(), text_kind, locale, started_at, "STARTED", int(assisted), int(manual_review), json.dumps(provenance, ensure_ascii=False, sort_keys=True) if provenance else None, activity_domain),
        )
        return _attempt(db, attempt_id, child_id)


def _attempt(db: sqlite3.Connection, attempt_id: str, child_id: int) -> dict[str, Any]:
    row = db.execute("SELECT * FROM reading_aloud_attempts WHERE id=? AND child_id=?", (attempt_id, child_id)).fetchone()
    if row is None:
        raise ValueError("reading_aloud_attempt_not_found")
    result = dict(row)
    result["assisted"] = bool(result["assisted"])
    result["manual_review"] = bool(result["manual_review"])
    result["provenance"] = json.loads(result.pop("provenance_json")) if result.get("provenance_json") else None
    return result


def complete_attempt(*, child_id: int, attempt_id: str, duration_ms: int | None) -> dict[str, Any]:
    if duration_ms is not None and not 0 <= duration_ms <= 3_600_000:
        raise ValueError("invalid_duration")
    initialize_database()
    with connect() as db:
        row = db.execute("SELECT * FROM reading_aloud_attempts WHERE id=? AND child_id=?", (attempt_id, child_id)).fetchone()
        if row is None:
            raise ValueError("reading_aloud_attempt_not_found")
        if row["completed_at"] is not None or row["aborted_at"] is not None:
            raise ValueError("reading_aloud_attempt_already_completed")
        db.execute("UPDATE reading_aloud_attempts SET completed_at=?,duration_ms=?,status='COMPLETED' WHERE id=? AND child_id=?", (now(), duration_ms, attempt_id, child_id))
        if row["source_type"] in {"CURRICULUM", "WORD", "SENTENCE", "PASSAGE"} and row["source_id"] and not row["assisted"] and not row["manual_review"]:
            from .curriculum_evidence import record_linked_skill_gate

            record_linked_skill_gate(
                db,
                child_id=child_id,
                skill_domain=row["activity_domain"],
                item_id=row["source_id"],
                evidence_ref=attempt_id,
                evidence_type="reading_aloud_completed",
            )
        return _attempt(db, attempt_id, child_id)


def abort_attempt(*, child_id: int, attempt_id: str) -> dict[str, Any]:
    """Keep an auditable row when recording never actually starts."""
    initialize_database()
    with connect() as db:
        row = db.execute("SELECT * FROM reading_aloud_attempts WHERE id=? AND child_id=?", (attempt_id, child_id)).fetchone()
        if row is None:
            raise ValueError("reading_aloud_attempt_not_found")
        if row["completed_at"] is None and row["aborted_at"] is None:
            db.execute("UPDATE reading_aloud_attempts SET aborted_at=?,status='ABORTED' WHERE id=? AND child_id=?", (now(), attempt_id, child_id))
        return _attempt(db, attempt_id, child_id)
