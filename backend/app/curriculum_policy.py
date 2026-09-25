"""Validated OCAC slice, child-scoped mastery gates, and adaptive SRS policy."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from .database import connect, initialize_database

SRS_INTERVALS_MINUTES = (10, 1_440, 4_320, 10_080, 20_160, 43_200, 86_400, 172_800)
MASTERY_STATUSES = {"NOT_STARTED", "IN_PROGRESS", "PRACTICED", "READY_FOR_CHECK", "MASTERED", "NEEDS_REVIEW"}
PROGRESS_STATUSES = {"IN_PROGRESS", "PRACTICED", "READY_FOR_CHECK"}
VALID_DOMAINS = {"listening", "speaking", "recognition", "writing", "reading", "phonetics", "pronunciation", "vocabulary", "grammar"}
SRS_DOMAINS = (VALID_DOMAINS | {"word", "sentence", "idiom", "reading_aloud"}) - {"phonetics"}
DEFAULT_GATE_FLOOR = 0.75


@lru_cache(maxsize=1)
def validated_slice() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "shared" / "validated-curriculum-slice.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _ordered_lessons() -> list[dict[str, Any]]:
    lessons: list[dict[str, Any]] = []
    for stage in validated_slice()["stages"]:
        for lesson in stage["lessons"]:
            lessons.append({"stageId": stage["id"], "stageTitle": stage["title"], **lesson})
    return lessons


def _lesson_map() -> dict[str, dict[str, Any]]:
    lessons = _ordered_lessons()
    return {lesson["id"]: {**lesson, "sequence": index} for index, lesson in enumerate(lessons)}


def _source_fields(lesson: dict[str, Any]) -> dict[str, Any]:
    defaults = validated_slice()["provenanceDefaults"]
    stage = next(stage for stage in validated_slice()["stages"] if stage["id"] == lesson["stageId"])
    source = next((item for item in stage["sources"] if item["sourceBook"] == lesson["sourceBook"]), None)
    if source is None:
        source = next((item for item in stage["sources"] if item["sourceBook"].startswith(lesson["sourceBook"])), stage["sources"][0])
    return {
        "sourceKind": defaults["sourceKind"],
        "sourceName": f"{validated_slice()['series']} · {lesson['sourceBook']}",
        "sourceUrl": source["sourceUrl"],
        "sourceBook": lesson["sourceBook"],
        "sourceLesson": f"第{lesson['number']}課",
        "provenanceStatus": defaults["provenanceStatus"],
        "licenseStatus": defaults["licenseStatus"],
        "commercialReady": defaults["commercialReady"],
    }


def _state_row(db: Any, child_id: int, lesson_id: str) -> Any:
    return db.execute("SELECT * FROM curriculum_lesson_states WHERE child_id=? AND lesson_id=?", (child_id, lesson_id)).fetchone()


def _is_accessible(db: Any, child_id: int, lesson: dict[str, Any], lessons: list[dict[str, Any]]) -> bool:
    state = _state_row(db, child_id, lesson["id"])
    if state and state["soft_unlocked"]:
        return True
    index = lesson["sequence"]
    if index == 0:
        return True
    previous = _state_row(db, child_id, lessons[index - 1]["id"])
    return bool(previous and previous["status"] == "MASTERED")


def lesson_is_accessible(db: Any, child_id: int, lesson_id: str) -> bool:
    lessons_by_id = _lesson_map()
    lesson = lessons_by_id.get(lesson_id)
    return bool(lesson and _is_accessible(db, child_id, lesson, list(lessons_by_id.values())))


def get_validated_curriculum(child_id: int) -> dict[str, Any]:
    from .learning import ensure_child

    initialize_database()
    lessons = _ordered_lessons()
    indexed = _lesson_map()
    with connect() as db:
        ensure_child(db, child_id)
        stages: list[dict[str, Any]] = []
        previous_id: str | None = None
        for source_stage in validated_slice()["stages"]:
            stage_lessons = []
            for raw in source_stage["lessons"]:
                lesson = indexed[raw["id"]]
                state = _state_row(db, child_id, lesson["id"])
                required = {domain: DEFAULT_GATE_FLOOR for domain in lesson["domains"]}
                stage_lessons.append({
                    **raw,
                    **_source_fields(lesson),
                    "sourceLesson": f"第{raw['number']}課",
                    "prerequisiteLessonId": previous_id,
                    "accessible": _is_accessible(db, child_id, lesson, lessons),
                    "masteryGate": {"independentEvidenceRequired": True, "domainFloors": required},
                    "state": {
                        "status": state["status"] if state else "NOT_STARTED",
                        "softUnlocked": bool(state["soft_unlocked"]) if state else False,
                        "updatedAt": state["updated_at"] if state else None,
                    },
                })
                previous_id = lesson["id"]
            stages.append({**source_stage, "lessons": stage_lessons})
        return {
            "series": validated_slice()["series"],
            "canonicalHierarchy": validated_slice()["canonicalHierarchy"],
            "provider": validated_slice()["provider"],
            "sourceUrl": validated_slice()["sourceUrl"],
            "childId": child_id,
            "stages": stages,
            "outOfScopeBooks": validated_slice()["outOfScopeBooks"],
            "masteryStatuses": sorted(MASTERY_STATUSES),
        }


def _resolve_access(db: Any, child_id: int, lesson_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    lessons = _lesson_map()
    lesson = lessons.get(lesson_id)
    if lesson is None:
        raise ValueError("validated_lesson_not_found")
    ordered = list(lessons.values())
    if not _is_accessible(db, child_id, lesson, ordered):
        raise ValueError("prerequisite_not_mastered")
    return lesson, ordered


def record_lesson_progress(*, child_id: int, lesson_id: str, status: str) -> dict[str, Any]:
    from .learning import ensure_child, now, uid

    if status not in PROGRESS_STATUSES:
        raise ValueError("invalid_progress_status")
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        lesson, _ = _resolve_access(db, child_id, lesson_id)
        previous = _state_row(db, child_id, lesson_id)
        next_status = "MASTERED" if previous and previous["status"] == "MASTERED" else status
        updated_at = now()
        db.execute(
            "INSERT INTO curriculum_lesson_states(child_id,lesson_id,status,updated_at) VALUES(?,?,?,?) "
            "ON CONFLICT(child_id,lesson_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at",
            (child_id, lesson_id, next_status, updated_at),
        )
        event_id = uid("lesson-progress")
        db.execute(
            "INSERT INTO curriculum_lesson_events(id,child_id,lesson_id,event_type,status,details_json,created_at) VALUES(?,?,?,?,?,?,?)",
            (event_id, child_id, lesson_id, "PROGRESS", next_status, json.dumps({"requestedStatus": status}, sort_keys=True), updated_at),
        )
        return {"id": event_id, "childId": child_id, "lessonId": lesson_id, "status": next_status, "mastered": next_status == "MASTERED", "unlockedNext": False, "updatedAt": updated_at}


def set_soft_unlock(*, child_id: int, lesson_id: str, unlocked: bool) -> dict[str, Any]:
    from .learning import ensure_child, now, uid

    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        lesson = _lesson_map().get(lesson_id)
        if lesson is None:
            raise ValueError("validated_lesson_not_found")
        previous = _state_row(db, child_id, lesson_id)
        status = previous["status"] if previous else "NOT_STARTED"
        updated_at = now()
        db.execute(
            "INSERT INTO curriculum_lesson_states(child_id,lesson_id,status,soft_unlocked,updated_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(child_id,lesson_id) DO UPDATE SET soft_unlocked=excluded.soft_unlocked,updated_at=excluded.updated_at",
            (child_id, lesson_id, status, int(unlocked), updated_at),
        )
        event_id = uid("lesson-soft-unlock")
        db.execute(
            "INSERT INTO curriculum_lesson_events(id,child_id,lesson_id,event_type,status,details_json,created_at) VALUES(?,?,?,?,?,?,?)",
            (event_id, child_id, lesson_id, "SOFT_UNLOCK", status, json.dumps({"softUnlocked": bool(unlocked)}, sort_keys=True), updated_at),
        )
        return {"id": event_id, "childId": child_id, "lessonId": lesson_id, "status": status, "softUnlocked": bool(unlocked), "mastered": status == "MASTERED"}


def assess_lesson(*, child_id: int, lesson_id: str, scores: dict[str, float], assisted_domains: set[str] | None = None, script_mode: str | None = None) -> dict[str, Any]:
    from .learning import ensure_child, now, uid

    assisted_domains = assisted_domains or set()
    if set(scores) - VALID_DOMAINS or assisted_domains - VALID_DOMAINS:
        raise ValueError("invalid_assessment_domain")
    if script_mode is not None and script_mode not in {"zhuyin", "pinyin"}:
        raise ValueError("invalid_phonetic_script")
    if any(not isinstance(score, (int, float)) or not 0 <= score <= 1 for score in scores.values()):
        raise ValueError("invalid_assessment_score")
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        lesson, _ = _resolve_access(db, child_id, lesson_id)
        floors = {domain: DEFAULT_GATE_FLOOR for domain in lesson["domains"]}
        missing = sorted(set(floors) - set(scores))
        failed = sorted(domain for domain, floor in floors.items() if domain in scores and (scores[domain] < floor or domain in assisted_domains))
        mastered = not missing and not failed
        status = "MASTERED" if mastered else "NEEDS_REVIEW"
        created_at = now()
        for domain, score in scores.items():
            db.execute(
                "INSERT INTO curriculum_skill_evidence(id,child_id,lesson_id,skill_domain,script_mode,score,assisted,created_at) VALUES(?,?,?,?,?,?,?,?)",
                (uid("skill-evidence"), child_id, lesson_id, domain, script_mode, float(score), int(domain in assisted_domains), created_at),
            )
        db.execute(
            "INSERT INTO curriculum_lesson_states(child_id,lesson_id,status,updated_at) VALUES(?,?,?,?) "
            "ON CONFLICT(child_id,lesson_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at",
            (child_id, lesson_id, status, created_at),
        )
        event_id = uid("lesson-assessment")
        db.execute(
            "INSERT INTO curriculum_lesson_events(id,child_id,lesson_id,event_type,status,details_json,created_at) VALUES(?,?,?,?,?,?,?)",
            (event_id, child_id, lesson_id, "ASSESSMENT", status, json.dumps({"scores": scores, "assistedDomains": sorted(assisted_domains), "missingDomains": missing, "failedDomains": failed, "domainFloors": floors}, sort_keys=True), created_at),
        )
        return {"id": event_id, "childId": child_id, "lessonId": lesson_id, "status": status, "mastered": mastered, "missingDomains": missing, "failedDomains": failed, "domainFloors": floors, "updatedAt": created_at}


def get_phonetic_support(*, child_id: int, script_mode: str) -> dict[str, Any]:
    """Return script-specific hint visibility from independent phonetics evidence only."""
    from .learning import ensure_child

    if script_mode not in {"zhuyin", "pinyin"}:
        raise ValueError("invalid_phonetic_script")
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        row = db.execute(
            "SELECT score,created_at FROM curriculum_skill_evidence WHERE child_id=? AND skill_domain='phonetics' AND script_mode=? AND assisted=0 ORDER BY created_at DESC,id DESC LIMIT 1",
            (child_id, script_mode),
        ).fetchone()
        score = float(row["score"]) if row else None
        if score is None or score < 0.7:
            mode = "FULL"
        elif score < 0.8:
            mode = "TARGET_WORDS_ONLY"
        elif score < 0.9:
            mode = "TAP_TO_REVEAL"
        else:
            mode = "HIDDEN"
        return {"childId": child_id, "script": script_mode, "supportMode": mode, "independentScore": score, "evidenceAt": row["created_at"] if row else None}


def record_srs_review(
    db: Any,
    *,
    child_id: int,
    skill_domain: str,
    item_id: str,
    result: str,
    assisted: bool,
    occurred_at: str | None = None,
) -> dict[str, Any]:
    from .learning import now, uid

    """Record a domain-local review. Assisted success cannot move the stage forward."""
    if skill_domain not in SRS_DOMAINS:
        raise ValueError("invalid_srs_domain")
    if result not in {"correct", "incorrect"}:
        raise ValueError("result_must_be_correct_or_incorrect")
    old = db.execute("SELECT stage FROM srs_review_states WHERE child_id=? AND skill_domain=? AND item_id=?", (child_id, skill_domain, item_id)).fetchone()
    previous_stage = int(old["stage"]) if old else 0
    if result == "incorrect":
        next_stage = 0
        interval = 0
    elif assisted:
        next_stage = previous_stage
        interval = 0
    else:
        next_stage = min(len(SRS_INTERVALS_MINUTES), previous_stage + 1)
        interval = SRS_INTERVALS_MINUTES[next_stage - 1]
    stamp = occurred_at or now()
    try:
        parsed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("invalid_srs_timestamp") from error
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    due_at = (parsed + timedelta(minutes=interval)).strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        "INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?,?,?,?,?,?,?,?) "
        "ON CONFLICT(child_id,skill_domain,item_id) DO UPDATE SET stage=excluded.stage,due_at=excluded.due_at,last_result=excluded.last_result,last_assisted=excluded.last_assisted,updated_at=excluded.updated_at",
        (child_id, skill_domain, item_id, next_stage, due_at, result, int(assisted), stamp),
    )
    event_id = uid("srs-review")
    db.execute(
        "INSERT INTO srs_review_events(id,child_id,skill_domain,item_id,result,assisted,previous_stage,next_stage,interval_minutes,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (event_id, child_id, skill_domain, item_id, result, int(assisted), previous_stage, next_stage, interval, stamp),
    )
    state = db.execute("SELECT * FROM srs_review_states WHERE child_id=? AND skill_domain=? AND item_id=?", (child_id, skill_domain, item_id)).fetchone()
    return {**dict(state), "event_id": event_id, "previous_stage": previous_stage, "interval_minutes": interval}
