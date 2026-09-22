"""Phase 14 deterministic, auditable adaptive queue."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from .database import connect, initialize_database
from .learning import ensure_child

WEIGHTS = {
    "overdue": 30,
    "recent_error": 25,
    "assisted": 10,
    "low_independent": 15,
    "repeated_misses": 10,
    "staleness": 5,
    "school_urgency": 20,
    "review_reason": 15,
    "novelty": 10,
}
SOURCES = ("SCHOOL_QUEUE", "REVIEW", "CURRICULUM")


def _as_of(value: str) -> tuple[datetime, str]:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("invalid_as_of") from error
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed, parsed.strftime("%Y-%m-%d %H:%M:%S")


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _state(db: Any, child_id: int, item_id: str, as_of: datetime) -> dict[str, Any]:
    attempts = [dict(row) for row in db.execute("SELECT * FROM recognition_attempts WHERE child_id=? AND item_id=? AND timestamp<=? ORDER BY timestamp,id", (child_id, item_id, as_of.strftime("%Y-%m-%d %H:%M:%S")))]
    independent_correct = sum(1 for row in attempts if row["result"] == "correct" and not row["assisted"])
    incorrect = sum(1 for row in attempts if row["result"] == "incorrect")
    assisted = sum(1 for row in attempts if row["assisted"])
    latest = _dt(attempts[-1]["timestamp"]) if attempts else None
    state_row = db.execute("SELECT * FROM recognition_states WHERE child_id=? AND item_id=?", (child_id, item_id)).fetchone()
    state = dict(state_row) if state_row and (_dt(state_row["updated_at"]) or as_of) <= as_of else {}
    return {"independent_correct": independent_correct, "incorrect": incorrect, "assisted": assisted, "latest": latest, "due_at": _dt(state.get("due_at")) if state else None}


def _candidate(*, item_id: str, child_id: int, source: str, skill: str, text: str, source_id: str, source_detail: str, state: dict[str, Any], as_of: datetime, school_due: str | None = None, school_priority: int = 0, review_reason: str = "", preference: str | None = None) -> dict[str, Any]:
    components = {key: 0 for key in WEIGHTS}
    reasons: list[str] = []
    if state["due_at"] and state["due_at"] <= as_of:
        components["overdue"] = WEIGHTS["overdue"]
        reasons.append("overdue")
    if state["latest"] and state["latest"] >= as_of - timedelta(days=7) and state["incorrect"]:
        components["recent_error"] = WEIGHTS["recent_error"]
        reasons.append("recent incorrect")
    if state["assisted"]:
        components["assisted"] = WEIGHTS["assisted"]
        reasons.append("assisted attempts")
    if state["independent_correct"] == 0:
        components["low_independent"] = WEIGHTS["low_independent"]
        reasons.append("low independent success")
    if state["incorrect"] >= 2:
        components["repeated_misses"] = min(WEIGHTS["repeated_misses"], state["incorrect"] * 5)
        reasons.append("repeated misses")
    if not state["latest"] or state["latest"] <= as_of - timedelta(days=14):
        components["staleness"] = WEIGHTS["staleness"]
        reasons.append("stale practice")
    if source == "SCHOOL_QUEUE":
        due = _dt(school_due)
        if due and due.date() <= as_of.date():
            components["school_urgency"] = WEIGHTS["school_urgency"]
            reasons.append("school assignment due")
        elif due and due <= as_of + timedelta(days=3):
            components["school_urgency"] = WEIGHTS["school_urgency"] // 2
            reasons.append("school assignment soon")
        components["school_urgency"] = min(WEIGHTS["school_urgency"], components["school_urgency"] + min(10, max(0, school_priority)))
        if school_priority:
            reasons.append("school priority")
    if source == "REVIEW":
        components["review_reason"] = WEIGHTS["review_reason"]
        reasons.append(review_reason or "review queue")
    if source == "CURRICULUM" and state["independent_correct"] == 0 and not state["latest"]:
        components["novelty"] = WEIGHTS["novelty"]
        reasons.append("new curriculum item")
    if preference == source:
        reasons.append("parent preference")
    return {"item_id": item_id, "child_id": child_id, "source": source, "source_id": source_id, "source_detail": source_detail, "skill": skill, "text": text, "priority_score": sum(components.values()), "components": components, "reasons": reasons}


def _rank(candidates: list[dict[str, Any]], limit: int, preference: str | None, adaptive: bool) -> list[dict[str, Any]]:
    if not adaptive:
        return sorted(candidates, key=lambda item: (SOURCES.index(item["source"]), item["source_id"]))[:limit]
    ordered = sorted(candidates, key=lambda item: (-(item["priority_score"] + (20 if item["source"] == preference else 0)), SOURCES.index(item["source"]), item["source_id"]))
    selected: list[dict[str, Any]] = []
    remaining = ordered[:]
    cap = max(1, (limit + 1) // 2)
    for source in SOURCES:
        match = next((item for item in remaining if item["source"] == source), None)
        if match and len(selected) < limit:
            selected.append(match); remaining.remove(match)
    counts = {source: sum(item["source"] == source for item in selected) for source in SOURCES}
    for item in remaining:
        if len(selected) >= limit:
            break
        if counts[item["source"]] < cap or not any(count < cap for count in counts.values() if count > 0):
            selected.append(item); counts[item["source"]] += 1
    return selected[:limit]


def build_adaptive_plan(*, child_id: int, as_of: str, limit: int, adaptive: bool, preference: str | None) -> dict[str, Any]:
    if not 1 <= limit <= 50:
        raise ValueError("invalid_limit")
    if preference not in {None, *SOURCES}:
        raise ValueError("invalid_preference")
    as_of_dt, as_of_text = _as_of(as_of)
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        candidates: list[dict[str, Any]] = []
        for row in db.execute("SELECT * FROM learning_items WHERE child_id=? AND created_at<=? ORDER BY id", (child_id, as_of_text)):
            state = _state(db, child_id, row["id"], as_of_dt)
            candidates.append(_candidate(item_id=row["id"], child_id=child_id, source="CURRICULUM", skill="recognition", text=row["character"], source_id=row["id"], source_detail=row["curriculum_source"], state=state, as_of=as_of_dt, preference=preference))
        for row in db.execute("SELECT * FROM school_queue_items WHERE child_id=? AND active=1 AND completed=0 AND created_at<=? ORDER BY id", (child_id, as_of_text)):
            state = _state(db, child_id, row["id"], as_of_dt) if db.execute("SELECT 1 FROM learning_items WHERE id=?", (row["id"],)).fetchone() else {"independent_correct": 0, "incorrect": 0, "assisted": 0, "latest": None, "due_at": None}
            candidates.append(_candidate(item_id=row["id"], child_id=child_id, source="SCHOOL_QUEUE", skill="recognition", text=row["character"], source_id=row["id"], source_detail=row["school_source"], state=state, as_of=as_of_dt, school_due=row["due_date"], school_priority=row["priority"], preference=preference))
        for row in db.execute("SELECT * FROM review_queue_items WHERE child_id=? AND active=1 AND created_at<=? ORDER BY id", (child_id, as_of_text)):
            state = _state(db, child_id, row["item_id"], as_of_dt)
            candidates.append(_candidate(item_id=row["id"], child_id=child_id, source="REVIEW", skill="recognition", text=row["character"], source_id=row["id"], source_detail=row["source_detail"], state=state, as_of=as_of_dt, review_reason=row["reason"], preference=preference))
        items = _rank(candidates, limit, preference, adaptive)
        if not adaptive:
            for item in items:
                item["priority_score"] = 0
                item["components"] = {key: 0 for key in WEIGHTS}
                item["reasons"] = ["adaptive ordering disabled; deterministic fallback"]
        return {"child_id": child_id, "as_of": as_of_text, "limit": limit, "adaptive": adaptive, "preference": preference, "weights": WEIGHTS, "items": items}
