"""Read-only, child-scoped parent dashboard read model."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from .adaptive import build_adaptive_plan
from .database import connect
from .lifecycle import reconstruct_lifecycle


SKILLS = (
    "recognition", "writing", "word", "sentence", "pronunciation",
    "grammar", "idiom", "reading", "reading_aloud",
)

EVENTS = {
    "recognition": ("recognition_attempts", "item_id", "timestamp", "correct", "incorrect"),
    "writing": ("writing_attempts", "character", "created_at", "trace_result='correct'", "trace_result='incorrect'"),
    "word": ("word_attempts", "word_id", "created_at", "result='correct'", "result='incorrect'"),
    "sentence": ("sentence_attempts", "sentence_id", "created_at", "correct=1", "correct=0"),
    "pronunciation": ("pronunciation_attempts", "reading_id", "created_at", "correct=1", "correct=0"),
    "grammar": ("grammar_attempts", "exercise_id", "created_at", "correct=1", "correct=0"),
    "idiom": ("idiom_attempts", "idiom_id", "created_at", "correct=1", "correct=0"),
    "reading": ("reading_attempts", "passage_id", "created_at", "score=total", "score<total"),
    "reading_aloud": ("reading_aloud_attempts", "source_id", "started_at", "status='COMPLETED'", "status='ABORTED'"),
}


def _parse(value: str | None, label: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"invalid_{label}") from error
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _stamp(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S")


def _as_of(value: str | None, end_text: str) -> str | None:
    return value if value and value <= end_text else None


def _bounds(window: str, from_at: str | None, to_at: str | None) -> tuple[datetime | None, datetime]:
    end = _parse(to_at, "to_at") or datetime.now(timezone.utc).replace(tzinfo=None)
    start = _parse(from_at, "from_at")
    if start is None and window in {"7d", "30d"}:
        start = end - timedelta(days=7 if window == "7d" else 30)
    if window not in {"7d", "30d", "all"}:
        raise ValueError("invalid_window")
    if start and start > end:
        raise ValueError("invalid_time_range")
    return start, end


def _where(timestamp: str, start: datetime | None, end: datetime) -> tuple[str, list[str]]:
    clauses = [f"{timestamp}<=?"]
    args = [_stamp(end)]
    if start:
        clauses.insert(0, f"{timestamp}>=?")
        args.insert(0, _stamp(start))
    return " AND ".join(clauses), args


def _skill_summary(db: Any, child_id: int, skill: str, start: datetime | None, end: datetime) -> dict[str, Any]:
    table, key_column, timestamp, _correct_sql, _incorrect_sql = EVENTS[skill]
    where, args = _where(timestamp, start, end)
    rows = db.execute(f"SELECT * FROM {table} WHERE child_id=? AND {where} ORDER BY {timestamp}, id", [child_id, *args]).fetchall()
    correct = 0
    independent_correct = 0
    incorrect = 0
    assisted = 0
    keys: set[str] = set()
    trend: dict[str, dict[str, int]] = {}
    lifecycle_completed = 0
    lifecycle_aborted = 0
    for row in rows:
        keys.add(str(row[key_column]))
        if skill == "reading_aloud":
            status = "COMPLETED" if _as_of(row["completed_at"], _stamp(end)) else "ABORTED" if _as_of(row["aborted_at"], _stamp(end)) else "STARTED"
            lifecycle_completed += int(status == "COMPLETED")
            lifecycle_aborted += int(status == "ABORTED")
            day = str(row[timestamp])[:10]
            bucket = trend.setdefault(day, {"attempts": 0, "correct": 0, "incorrect": 0, "assisted": 0})
            bucket["attempts"] += 1
            continue
        if skill == "recognition":
            is_correct = row["result"] == "correct"
            is_incorrect = row["result"] == "incorrect"
        elif skill in {"writing"}:
            is_correct = row["trace_result"] == "correct"
            is_incorrect = row["trace_result"] == "incorrect"
        elif skill in {"word"}:
            is_correct = row["result"] == "correct"
            is_incorrect = row["result"] == "incorrect"
        elif skill == "reading":
            is_correct = row["score"] == row["total"]
            is_incorrect = row["score"] < row["total"]
        elif skill == "reading_aloud":
            is_correct = row["status"] == "COMPLETED"
            is_incorrect = row["status"] == "ABORTED"
        else:
            is_correct = row["correct"] == 1
            is_incorrect = row["correct"] == 0
        if is_correct:
            correct += 1
        if is_correct and not (row["assisted"] if "assisted" in row.keys() else 0):
            independent_correct += 1
        if is_incorrect:
            incorrect += 1
        assisted += int(row["assisted"]) if "assisted" in row.keys() else 0
        day = str(row[timestamp])[:10]
        bucket = trend.setdefault(day, {"attempts": 0, "correct": 0, "incorrect": 0, "assisted": 0})
        bucket["attempts"] += 1
        bucket["correct"] += int(is_correct)
        bucket["incorrect"] += int(is_incorrect)
        bucket["assisted"] += int(row["assisted"]) if "assisted" in row.keys() else 0
    result = {
        "correct": correct,
        "independent_correct": independent_correct,
        "incorrect": incorrect,
        "assisted": assisted,
        "last_practiced": rows[-1][timestamp] if rows else None,
        "distinct_practiced_items": len(keys),
        "attempts": len(rows),
        "trend": [{"date": day, **trend[day]} for day in sorted(trend)],
    }
    if skill == "reading_aloud":
        result["completed"] = lifecycle_completed
        result["aborted"] = lifecycle_aborted
    return result


def build_dashboard(*, child_id: int, window: str = "7d", from_at: str | None = None, to_at: str | None = None, adaptive_limit: int = 5) -> dict[str, Any]:
    start, end = _bounds(window, from_at, to_at)
    end_text = _stamp(end)
    with connect() as db:
        child = db.execute("SELECT id,name FROM children WHERE id=?", (child_id,)).fetchone()
        if child is None:
            raise ValueError("child_not_found")
        skill_summary = {skill: _skill_summary(db, child_id, skill, start, end) for skill in SKILLS}
        school_where, school_args = _where("created_at", None, end)
        school_rows = db.execute(f"SELECT * FROM school_queue_items WHERE child_id=? AND {school_where} ORDER BY id", [child_id, *school_args]).fetchall()
        school = [(row, reconstruct_lifecycle(row, end)) for row in school_rows]
        school = [(row, state) for row, state in school if state["visible"]]
        active_school = [row for row, state in school if state["active"]]
        due_school = [row for row in active_school if row["due_date"] and row["due_date"] <= end_text[:10]]
        completed_school = [row for row, state in school if state["completed"]]
        review_where, review_args = _where("created_at", None, end)
        review_rows = db.execute(f"SELECT * FROM review_queue_items WHERE child_id=? AND {review_where} ORDER BY id", [child_id, *review_args]).fetchall()
        review_count = sum(reconstruct_lifecycle(row, end)["active"] for row in review_rows)
        attempt_totals = {field: sum(skill_summary[skill][field] for skill in SKILLS) for field in ("attempts", "correct", "independent_correct", "incorrect", "assisted")}
        active_ids = {row["id"] for row in active_school}
        completed_ids = {row["id"] for row in completed_school}
        due_ids = {row["id"] for row in due_school}
        school_items = [{"id": row["id"], "source": row["school_source"], "due_date": row["due_date"], "private_content": bool(row["private_content"]), "provenance_status": row["provenance_status"], "active": row["id"] in active_ids, "completed": row["id"] in completed_ids, "due": row["id"] in due_ids} for row, _ in school]
        test_where, test_args = _where("completed_at", start, end)
        tests = db.execute(f"SELECT * FROM weekly_tests WHERE child_id=? AND completed_at IS NOT NULL AND {test_where} ORDER BY completed_at,id", [child_id, *test_args]).fetchall()
        pending_clauses = ["created_at<=?", "(completed_at IS NULL OR completed_at>?)"]
        pending_args = [end_text, end_text]
        if start:
            pending_clauses.append("created_at>=?")
            pending_args.append(_stamp(start))
        pending_tests = db.execute(
            f"SELECT id,created_at,total FROM weekly_tests WHERE child_id=? AND {' AND '.join(pending_clauses)} ORDER BY created_at,id",
            [child_id, *pending_args],
        ).fetchall()
        test_history = [{"id": row["id"], "score": row["score"], "total": row["total"], "created_at": row["created_at"], "completed_at": row["completed_at"], "missed_items": [key for key, value in (json.loads(row["correctness"] or "{}").items()) if not value]} for row in tests]
        points = db.execute("SELECT * FROM points_ledger WHERE child_id=? AND timestamp<=? ORDER BY timestamp,id", (child_id, end_text)).fetchall()
        redemptions = db.execute("SELECT id,reward_id,cost,created_at FROM reward_redemptions WHERE child_id=? AND created_at<=? ORDER BY created_at,id", (child_id, end_text)).fetchall()
        ocr_where, ocr_args = _where("created_at", start, end)
        ocr_rows = db.execute(f"SELECT id,source_label,locale,script,confirmed_text,confirmed_at,school_queue_item_id,commercial_ready,review_status,created_at FROM ocr_imports WHERE child_id=? AND {ocr_where} ORDER BY created_at,id", [child_id, *ocr_args]).fetchall()
        ocr = []
        for row in ocr_rows:
            confirmed_at = _as_of(row["confirmed_at"], end_text)
            confirmed = confirmed_at is not None
            ocr.append({
                "id": row["id"], "source_label": row["source_label"],
                "locale": row["locale"] if confirmed else None,
                "script": row["script"] if confirmed else None,
                "confirmed_text": row["confirmed_text"] if confirmed else None,
                "confirmed_at": confirmed_at,
                "school_queue_item_id": row["school_queue_item_id"] if confirmed else None,
                "commercial_ready": bool(row["commercial_ready"]),
                "review_status": "CONFIRMED" if confirmed else "CANDIDATE",
                "created_at": row["created_at"],
            })
        aloud_where, aloud_args = _where("started_at", start, end)
        aloud_rows = db.execute(f"SELECT id,status,duration_ms,locale,text_kind,started_at,completed_at,aborted_at FROM reading_aloud_attempts WHERE child_id=? AND {aloud_where} ORDER BY started_at,id", [child_id, *aloud_args]).fetchall()
        aloud = []
        for row in aloud_rows:
            completed_at = _as_of(row["completed_at"], end_text)
            aborted_at = _as_of(row["aborted_at"], end_text)
            status = "COMPLETED" if completed_at else "ABORTED" if aborted_at else "STARTED"
            aloud.append({
                "id": row["id"], "status": status, "duration_ms": row["duration_ms"] if completed_at else None,
                "locale": row["locale"], "text_kind": row["text_kind"], "started_at": row["started_at"],
                "completed_at": completed_at, "aborted_at": aborted_at,
            })
    # The dashboard is a read-only endpoint.  The application lifespan owns schema
    # initialization; do not let an on-demand adaptive read run migrations/DDL.
    adaptive = build_adaptive_plan(child_id=child_id, as_of=end.isoformat() + "Z", limit=adaptive_limit, adaptive=True, preference=None, initialize=False)
    return {
        "child": dict(child), "window": {"name": window, "from": _stamp(start) if start else None, "to": end_text},
        "activity": {"attempts": attempt_totals, "active_school_queue": len(active_school), "completed_school_queue": len(completed_school), "due_school_queue": len(due_school), "review_count": review_count, "adaptive": {"as_of": adaptive["as_of"], "items": adaptive["items"]}},
        "skills": skill_summary,
        "school_queue": {"active": len(active_school), "completed": len(completed_school), "due": len(due_school), "items": school_items},
        "weekly_tests": {"recent": test_history[-1] if test_history else None, "history": test_history, "pending": [dict(row) for row in pending_tests]},
        "points_rewards": {"balance": sum(row["points_delta"] for row in points), "ledger": [dict(row) for row in points if not start or row["timestamp"] >= _stamp(start)], "redemptions": [dict(row) for row in redemptions]},
        "reading_aloud": {"attempts": len(aloud), "completed": sum(row["status"] == "COMPLETED" for row in aloud), "aborted": sum(row["status"] == "ABORTED" for row in aloud), "items": aloud},
        "ocr": {"candidates": sum(row["review_status"] == "CANDIDATE" for row in ocr), "confirmed": sum(row["review_status"] == "CONFIRMED" for row in ocr), "items": ocr},
        "read_only": True,
    }
