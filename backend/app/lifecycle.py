"""Deterministic timestamp-based lifecycle reconstruction for read models."""
from __future__ import annotations

from datetime import datetime
from typing import Any


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed


def reconstruct_lifecycle(row: Any, as_of: datetime) -> dict[str, bool]:
    """Return lifecycle state using only created/completed/deactivated timestamps.

    Current ``active`` and ``completed`` columns are projections and are
    intentionally ignored. Malformed events and events before creation are
    invalid and therefore cannot change historical state.
    """
    created_at = _parse(row["created_at"])
    if created_at is None or created_at > as_of:
        return {"visible": False, "active": False, "completed": False, "deactivated": False}

    def valid_event(column: str) -> datetime | None:
        if column not in row.keys():
            return None
        event_at = _parse(row[column])
        return event_at if event_at is not None and event_at >= created_at else None

    completed_at = valid_event("completed_at")
    deactivated_at = valid_event("deactivated_at")
    completed = completed_at is not None and completed_at <= as_of
    deactivated = deactivated_at is not None and deactivated_at <= as_of
    return {
        "visible": True,
        "active": not completed and not deactivated,
        "completed": completed,
        "deactivated": deactivated,
    }
