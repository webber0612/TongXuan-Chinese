"""Deterministic, auditable Phase 14 adaptive queue."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from .database import connect, initialize_database
from .learning import ensure_child

WEIGHTS = {"overdue": 30, "recent_error": 25, "assisted": 10, "low_independent": 15, "repeated_misses": 10, "staleness": 5, "school_urgency": 20, "review_reason": 15, "novelty": 10, "preference": 20, "source_balance": 8, "skill_balance": 12}
SOURCES = ("SCHOOL_QUEUE", "REVIEW", "CURRICULUM")
SKILLS = ("recognition", "writing", "word", "sentence", "pronunciation", "grammar", "idiom", "reading", "reading_aloud")


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


def _row_state(db: Any, child_id: int, state_table: str, key_column: str, key: str, as_of: datetime) -> dict[str, Any]:
    row = db.execute(f"SELECT * FROM {state_table} WHERE child_id=? AND {key_column}=?", (child_id, key)).fetchone()
    if row is None or (_dt(row["updated_at"]) and _dt(row["updated_at"]) > as_of):
        return {"independent_correct": 0, "incorrect": 0, "assisted": 0, "latest": None, "due_at": None}
    data = dict(row)
    return {"independent_correct": data.get("correct_count", data.get("independent_success_count", 0)), "incorrect": data.get("incorrect_count", 0), "assisted": data.get("assisted_count", 0), "latest": _dt(data.get("updated_at")), "due_at": _dt(data.get("due_at"))}


def _recent_incorrect(db: Any, table: str, key_column: str, key: str, timestamp_column: str, incorrect_sql: str, child_id: int, as_of: datetime) -> tuple[int, datetime | None]:
    start = (as_of - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
    end = as_of.strftime("%Y-%m-%d %H:%M:%S")
    rows = db.execute(f"SELECT {timestamp_column} AS event_at FROM {table} WHERE child_id=? AND {key_column}=? AND {timestamp_column}>=? AND {timestamp_column}<=? AND {incorrect_sql} ORDER BY {timestamp_column}", (child_id, key, start, end)).fetchall()
    return len(rows), (_dt(rows[-1]["event_at"]) if rows else None)


def _candidate(*, item_id: str, child_id: int, source: str, skill: str, text: str, source_id: str, source_detail: str, state: dict[str, Any], as_of: datetime, preference: str | None = None, school_due: str | None = None, school_priority: int = 0, review_reason: str = "", recent: tuple[int, datetime | None] = (0, None), item_created: str | None = None) -> dict[str, Any]:
    components = {key: 0 for key in WEIGHTS}
    reasons: list[str] = []
    recent_count, recent_latest = recent
    latest = recent_latest or state["latest"] or _dt(item_created)
    if state["due_at"] and state["due_at"] <= as_of: components["overdue"] = WEIGHTS["overdue"]; reasons.append("overdue")
    if recent_count: components["recent_error"] = WEIGHTS["recent_error"]; reasons.append("recent incorrect")
    if state["assisted"]: components["assisted"] = WEIGHTS["assisted"]; reasons.append("assisted attempts")
    if state["independent_correct"] == 0: components["low_independent"] = WEIGHTS["low_independent"]; reasons.append("low independent success")
    if state["incorrect"] >= 2: components["repeated_misses"] = min(WEIGHTS["repeated_misses"], state["incorrect"] * 5); reasons.append("repeated misses")
    if not latest or latest <= as_of - timedelta(days=14): components["staleness"] = WEIGHTS["staleness"]; reasons.append("stale practice")
    if source == "SCHOOL_QUEUE":
        due = _dt(school_due)
        if due and due.date() <= as_of.date(): components["school_urgency"] = WEIGHTS["school_urgency"]; reasons.append("school assignment due")
        elif due and due <= as_of + timedelta(days=3): components["school_urgency"] = WEIGHTS["school_urgency"] // 2; reasons.append("school assignment soon")
        if school_priority: components["school_urgency"] = min(WEIGHTS["school_urgency"], components["school_urgency"] + min(10, max(0, school_priority))); reasons.append("school priority")
    if source == "REVIEW": components["review_reason"] = WEIGHTS["review_reason"]; reasons.append(review_reason or "review queue")
    if source == "CURRICULUM" and state["independent_correct"] == 0 and not state["latest"]: components["novelty"] = WEIGHTS["novelty"]; reasons.append("new curriculum item")
    if preference == source: components["preference"] = WEIGHTS["preference"]; reasons.append("parent preference")
    score = sum(components.values())
    return {"item_id": item_id, "child_id": child_id, "source": source, "source_id": source_id, "source_detail": source_detail, "skill": skill, "text": text, "priority_score": score, "ranking_score": score, "components": components, "reasons": reasons}


def _rank(candidates: list[dict[str, Any]], limit: int, adaptive: bool) -> list[dict[str, Any]]:
    if not adaptive:
        for item in candidates:
            item["priority_score"] = item["ranking_score"] = 0
            item["components"] = {key: 0 for key in WEIGHTS}
            item["reasons"] = ["deterministic fallback"]
        return sorted(candidates, key=lambda item: (SOURCES.index(item["source"]), SKILLS.index(item["skill"]), item["source_id"]))[:limit]
    ordered = sorted(candidates, key=lambda item: (-item["priority_score"], SOURCES.index(item["source"]), SKILLS.index(item["skill"]), item["source_id"]))
    selected: list[dict[str, Any]] = []
    used_sources: set[str] = set(); used_skills: set[str] = set()
    source_cap = max(1, (limit + 1) // 2)
    for item in ordered:
        if len(selected) >= limit: break
        if item["source"] not in used_sources or item["skill"] not in used_skills:
            new_source = item["source"] not in used_sources; new_skill = item["skill"] not in used_skills
            if new_source: item["components"]["source_balance"] = WEIGHTS["source_balance"]; item["reasons"].append("source representation")
            if new_skill: item["components"]["skill_balance"] = WEIGHTS["skill_balance"]; item["reasons"].append("skill representation")
            selected.append(item); used_sources.add(item["source"]); used_skills.add(item["skill"])
    counts = {source: sum(item["source"] == source for item in selected) for source in SOURCES}
    for item in ordered:
        if item in selected or len(selected) >= limit: continue
        if counts[item["source"]] < source_cap or all(count >= source_cap for count in counts.values() if count):
            selected.append(item); counts[item["source"]] += 1
    for item in selected:
        item["ranking_score"] = item["priority_score"] = sum(item["components"].values())
    return sorted(selected[:limit], key=lambda item: (-item["ranking_score"], SOURCES.index(item["source"]), SKILLS.index(item["skill"]), item["source_id"]))


def build_adaptive_plan(*, child_id: int, as_of: str, limit: int, adaptive: bool, preference: str | None) -> dict[str, Any]:
    if not 1 <= limit <= 50: raise ValueError("invalid_limit")
    if preference not in {None, *SOURCES}: raise ValueError("invalid_preference")
    as_of_dt, as_of_text = _as_of(as_of)
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        candidates: list[dict[str, Any]] = []
        for row in db.execute("SELECT * FROM learning_items WHERE child_id=? AND created_at<=? ORDER BY id", (child_id, as_of_text)):
            state = _row_state(db, child_id, "recognition_states", "item_id", row["id"], as_of_dt)
            recent = _recent_incorrect(db, "recognition_attempts", "item_id", row["id"], "timestamp", "result='incorrect'", child_id, as_of_dt)
            candidates.append(_candidate(item_id=row["id"], child_id=child_id, source="CURRICULUM", skill="recognition", text=row["character"], source_id=row["id"], source_detail=row["curriculum_source"], state=state, as_of=as_of_dt, preference=preference, recent=recent, item_created=row["created_at"]))
        for row in db.execute("""SELECT * FROM school_queue_items WHERE child_id=? AND created_at<=?
          AND (completed=0 OR (completed_at IS NOT NULL AND completed_at>?))
          AND (active=1 OR (deactivated_at IS NOT NULL AND deactivated_at>?)) ORDER BY id""", (child_id, as_of_text, as_of_text, as_of_text)):
            empty = {"independent_correct": 0, "incorrect": 0, "assisted": 0, "latest": None, "due_at": None}
            candidates.append(_candidate(item_id=row["id"], child_id=child_id, source="SCHOOL_QUEUE", skill="recognition", text=row["character"], source_id=row["id"], source_detail=row["school_source"], state=empty, as_of=as_of_dt, preference=preference, school_due=row["due_date"], school_priority=row["priority"], item_created=row["created_at"]))
        for row in db.execute("""SELECT * FROM review_queue_items WHERE child_id=? AND created_at<=?
          AND (active=1 OR (deactivated_at IS NOT NULL AND deactivated_at>?)) ORDER BY id""", (child_id, as_of_text, as_of_text)):
            state = _row_state(db, child_id, "recognition_states", "item_id", row["item_id"], as_of_dt)
            recent = _recent_incorrect(db, "recognition_attempts", "item_id", row["item_id"], "timestamp", "result='incorrect'", child_id, as_of_dt)
            candidates.append(_candidate(item_id=row["id"], child_id=child_id, source="REVIEW", skill="recognition", text=row["character"], source_id=row["id"], source_detail=row["source_detail"], state=state, as_of=as_of_dt, preference=preference, review_reason=row["reason"], recent=recent, item_created=row["created_at"]))

        for row in db.execute("""SELECT wc.character, wc.position, w.id AS word_id, w.source_name
          FROM word_characters wc JOIN words w ON w.id=wc.word_id WHERE w.child_id=? ORDER BY w.id, wc.position""", (child_id,)):
            state = _row_state(db, child_id, "writing_states", "character", row["character"], as_of_dt)
            recent = _recent_incorrect(db, "writing_attempts", "character", row["character"], "created_at", "trace_result='incorrect'", child_id, as_of_dt)
            source_id = f"{row['word_id']}:{row['position']}"
            candidates.append(_candidate(item_id=f"writing:{source_id}", child_id=child_id, source="CURRICULUM", skill="writing", text=row["character"], source_id=source_id, source_detail=row["source_name"], state=state, as_of=as_of_dt, preference=preference, recent=recent))

        specs = [
            ("word", "words", "word_id", "word", "word_states", "word_attempts", "word_id", "created_at", "result='incorrect'"),
            ("sentence", "sentences", "sentence_id", "sentence", "sentence_states", "sentence_attempts", "sentence_id", "created_at", "correct=0"),
            ("pronunciation", "pronunciation_readings", "reading_id", "character", "pronunciation_states", "pronunciation_attempts", "reading_id", "created_at", "correct=0"),
            ("grammar", "grammar_exercises", "exercise_id", "prompt", "grammar_states", "grammar_attempts", "exercise_id", "created_at", "correct=0"),
            ("idiom", "idioms", "idiom_id", "idiom", "idiom_states", "idiom_attempts", "idiom_id", "created_at", "correct=0"),
            ("reading", "reading_passages", "passage_id", "passage", "reading_states", "reading_attempts", "passage_id", "created_at", "score<total"),
            ("reading_aloud", "reading_passages", "passage_id", "passage", None, None, None, None, None),
        ]
        for skill, table, key_column, text_column, state_table, attempt_table, attempt_key, timestamp_column, incorrect_sql in specs:
            columns = {info[1] for info in db.execute(f"PRAGMA table_info({table})")}
            has_child = "child_id" in columns
            created_filter = "created_at<=?" if "created_at" in columns else "1=1"
            sql = f"SELECT * FROM {table} WHERE {'child_id=? AND ' if has_child else ''}{created_filter} ORDER BY id"
            args = (child_id, as_of_text) if has_child and created_filter != "1=1" else ((child_id,) if has_child else ((as_of_text,) if created_filter != "1=1" else ()))
            for row in db.execute(sql, args):
                key = row[key_column] if key_column in row.keys() else row["id"]
                state = _row_state(db, child_id, state_table, key_column, key, as_of_dt) if state_table else {"independent_correct": 0, "incorrect": 0, "assisted": 0, "latest": None, "due_at": None}
                recent = _recent_incorrect(db, attempt_table, attempt_key, key, timestamp_column, incorrect_sql, child_id, as_of_dt) if attempt_table else (0, None)
                candidates.append(_candidate(item_id=f"{skill}:{key}", child_id=child_id, source="CURRICULUM", skill=skill, text=row[text_column], source_id=key, source_detail=skill, state=state, as_of=as_of_dt, preference=preference, recent=recent, item_created=row["created_at"] if "created_at" in row.keys() else None))
        return {"child_id": child_id, "as_of": as_of_text, "limit": limit, "adaptive": adaptive, "preference": preference, "weights": WEIGHTS, "items": _rank(candidates, limit, adaptive)}
