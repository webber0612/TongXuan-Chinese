"""Auditable reference-listening attempts; completion is a gate, never a score."""

from __future__ import annotations

from typing import Any

from .curriculum_evidence import record_linked_skill_gate
from .curriculum_policy import _resolve_access
from .database import connect, initialize_database
from .learning import ensure_child, now, uid


def _linked_text(db: Any, child_id: int, item_id: str) -> str:
    for table, column in (
        ("learning_items", "character"),
        ("words", "word"),
        ("sentences", "sentence"),
        ("reading_passages", "passage"),
    ):
        row = db.execute(f"SELECT {column} AS text FROM {table} WHERE id=? AND child_id=?", (item_id, child_id)).fetchone()
        if row:
            return str(row["text"])
    raise ValueError("listening_item_not_found")


def start_listening_attempt(*, child_id: int, item_id: str, lesson_id: str | None = None) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        if lesson_id is None:
            link = db.execute(
                "SELECT lesson_id FROM curriculum_item_links WHERE child_id=? AND skill_domain='listening' AND item_id=?",
                (child_id, item_id),
            ).fetchone()
            if link is None:
                raise ValueError("listening_item_not_linked_to_lesson")
            lesson_id = link["lesson_id"]
        _resolve_access(db, child_id, lesson_id)
        link = db.execute(
            "SELECT 1 FROM curriculum_item_links WHERE child_id=? AND lesson_id=? AND skill_domain='listening' AND item_id=?",
            (child_id, lesson_id, item_id),
        ).fetchone()
        if link is None:
            raise ValueError("listening_item_not_linked_to_lesson")
        text = _linked_text(db, child_id, item_id)
        attempt_id = uid("listening")
        started_at = now()
        db.execute(
            "INSERT INTO listening_attempts(id,child_id,lesson_id,item_id,text_snapshot,status,started_at) VALUES(?,?,?,?,?,'STARTED',?)",
            (attempt_id, child_id, lesson_id, item_id, text, started_at),
        )
        return {"id": attempt_id, "childId": child_id, "lessonId": lesson_id, "itemId": item_id, "text": text, "status": "STARTED", "startedAt": started_at}


def complete_listening_attempt(*, child_id: int, attempt_id: str, duration_ms: int | None = None) -> dict[str, Any]:
    if duration_ms is not None and not 0 <= duration_ms <= 3_600_000:
        raise ValueError("invalid_duration")
    initialize_database()
    with connect() as db:
        row = db.execute("SELECT * FROM listening_attempts WHERE id=? AND child_id=?", (attempt_id, child_id)).fetchone()
        if row is None:
            raise ValueError("listening_attempt_not_found")
        if row["status"] != "STARTED":
            raise ValueError("listening_attempt_already_completed")
        completed_at = now()
        db.execute(
            "UPDATE listening_attempts SET status='COMPLETED',completed_at=?,duration_ms=? WHERE id=? AND child_id=?",
            (completed_at, duration_ms, attempt_id, child_id),
        )
        gate_id = record_linked_skill_gate(
            db,
            child_id=child_id,
            skill_domain="listening",
            item_id=row["item_id"],
            lesson_id=row["lesson_id"],
            evidence_ref=attempt_id,
            evidence_type="reference_audio_completed",
        )
        return {"id": attempt_id, "status": "COMPLETED", "gateId": gate_id, "gateStatus": "ATTEMPTED_INDEPENDENTLY" if gate_id else None, "durationMs": duration_ms, "completedAt": completed_at}


def abort_listening_attempt(*, child_id: int, attempt_id: str) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        row = db.execute("SELECT status FROM listening_attempts WHERE id=? AND child_id=?", (attempt_id, child_id)).fetchone()
        if row is None:
            raise ValueError("listening_attempt_not_found")
        if row["status"] == "STARTED":
            db.execute("UPDATE listening_attempts SET status='ABORTED' WHERE id=? AND child_id=?", (attempt_id, child_id))
        return {"id": attempt_id, "status": "ABORTED" if row["status"] == "STARTED" else row["status"]}
