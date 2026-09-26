"""Deterministic child-scoped learning sessions for the validated first-lesson slice.

Session telemetry is append-only and separate from authoritative attempt, mastery,
reward, and SRS state. Microphone bytes and learner-entered answers are never stored
in telemetry.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from .curriculum_evidence import record_linked_score_evidence
from .curriculum_policy import (
    _lesson_map,
    _ordered_lessons,
    _source_fields,
    assess_lesson,
    lesson_is_accessible,
    record_lesson_progress,
    record_srs_review,
    validated_slice,
)
from .database import connect, initialize_database
from .learning import award_points, ensure_child, now, record_attempt, uid
from .sprint_b import practice_pronunciation


FLOW_LESSONS = {"starter-l01", "basic-l01", "book1-l01"}
STAGE_STARTS = {"STARTER": "starter-l01", "BASIC": "basic-l01", "BOOK_1": "book1-l01"}
STAGE_RANK = {"starter": 0, "basic": 1, "book-1": 2}
PLACEMENT_RANK = {"STARTER": 0, "BASIC": 1, "BOOK_1": 2}
PHONETICS = {"你": {"TRADITIONAL": ("ㄋㄧˇ", "nǐ"), "SIMPLIFIED": ("ㄋㄧˇ", "nǐ")}, "好": {"TRADITIONAL": ("ㄏㄠˇ", "hǎo"), "SIMPLIFIED": ("ㄏㄠˇ", "hǎo")}}
WRITING_PHASES = ("guided", "reduced_hint", "independent")
DEFAULT_TARGET_MINUTES = 18
MAX_DUE_REVIEWS = 2
MAX_FAILURES_PER_TASK = 3
MAX_SPEAKING_ABORTS = 2


def _as_of(value: str | None) -> tuple[datetime, str]:
    raw = value or datetime.now(timezone.utc).isoformat()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("invalid_as_of") from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed, parsed.strftime("%Y-%m-%d %H:%M:%S")


def _parse_stamp(value: str | datetime | None) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            for fmt in (
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M:%S.%f",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%S.%f",
                "%Y-%m-%d",
            ):
                try:
                    parsed = datetime.strptime(raw, fmt)
                    break
                except ValueError:
                    continue
            else:
                return None
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    return None


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _lesson_rows() -> dict[str, dict[str, Any]]:
    return _lesson_map()


def _lesson_for_child(db: Any, child_id: int, requested_lesson_id: str | None = None) -> tuple[dict[str, Any], str]:
    placement = db.execute("SELECT main_curriculum_start FROM placement_profiles WHERE child_id=?", (child_id,)).fetchone()
    stage_start = placement["main_curriculum_start"] if placement else "STARTER"
    lesson_id = requested_lesson_id or STAGE_STARTS.get(stage_start, "starter-l01")
    if lesson_id not in FLOW_LESSONS:
        raise ValueError("learning_flow_lesson_out_of_scope")
    lesson = _lesson_rows().get(lesson_id)
    if lesson is None:
        raise ValueError("validated_lesson_not_found")
    selected_stage = {"starter-l01": "STARTER", "basic-l01": "BASIC", "book1-l01": "BOOK_1"}[lesson_id]
    if selected_stage != stage_start:
        raise ValueError("learning_flow_lesson_not_in_placement")
    if not lesson_is_accessible(db, child_id, lesson_id):
        raise ValueError("prerequisite_not_mastered")
    return lesson, stage_start


def _characters(lesson: dict[str, Any]) -> list[str]:
    return list(dict.fromkeys(re.findall(r"[\u3400-\u9fff]", lesson["title"])))[:2]


def _item_id(child_id: int, lesson_id: str, kind: str, index: int | None = None) -> str:
    suffix = f"_{index}" if index is not None else ""
    return f"lf_{child_id}_{lesson_id}_{kind}{suffix}"


def _task(
    key: str,
    task_type: str,
    lesson_id: str,
    *,
    skill: str | None = None,
    item_id: str | None = None,
    source: str = "CURRICULUM",
    is_new: bool = True,
    required: bool = True,
    minutes: int = 1,
    evidence_type: str | None = None,
    mastery_impact: str = "NONE",
    reward_impact: str = "NONE",
    data: dict[str, Any] | None = None,
    private: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "key": key,
        "taskType": task_type,
        "sourceQueue": source,
        "lessonId": lesson_id,
        "skillDomain": skill,
        "itemId": item_id,
        "isNew": is_new,
        "required": required,
        "estimatedMinutes": minutes,
        "evidenceType": evidence_type,
        "masteryImpact": mastery_impact,
        "rewardImpact": reward_impact,
        "state": "PENDING",
        "attemptCount": 0,
        "failureCount": 0,
        "abortedAttemptCount": 0,
        "deferredReason": None,
        "evidenceRef": None,
        "startedAt": None,
        "completedAt": None,
        "elapsedSeconds": 0,
        "taskData": data or {},
        **(private or {}),
    }


def _writing_phase(db: Any, child_id: int, lesson_id: str, character: str, script_mode: str) -> tuple[str, int] | None:
    rows = db.execute(
        "SELECT phase,trace_result,assisted FROM writing_attempts WHERE child_id=? AND character=? AND script_mode=? ORDER BY created_at,id",
        (child_id, character, script_mode),
    ).fetchall()
    counts = {phase: 0 for phase in WRITING_PHASES}
    independent_failures = 0
    for row in rows:
        if row["trace_result"] == "correct" and (row["phase"] != "independent" or not row["assisted"]):
            counts[row["phase"]] = counts.get(row["phase"], 0) + 1
        if row["phase"] == "independent" and row["trace_result"] == "incorrect":
            independent_failures += 1
    if counts["guided"] < 2:
        return "guided", 2 - counts["guided"]
    if counts["reduced_hint"] < 1:
        return "reduced_hint", 1 - counts["reduced_hint"]
    independent_target = 1 + independent_failures
    if counts["independent"] < independent_target:
        return "independent", independent_target - counts["independent"]
    return None


def _recognition_is_strong(db: Any, child_id: int, item_id: str) -> bool:
    state = db.execute("SELECT correct_count,incorrect_count,assisted_count,last_result FROM recognition_states WHERE child_id=? AND item_id=?", (child_id, item_id)).fetchone()
    return bool(state and state["correct_count"] >= 2 and state["incorrect_count"] == 0 and state["assisted_count"] == 0 and state["last_result"] == "correct")


def _due_recognition(db: Any, child_id: int, as_of_text: str) -> list[dict[str, Any]]:
    rows = db.execute(
        """SELECT s.item_id,s.due_at,i.character,l.lesson_id
             FROM srs_review_states s JOIN learning_items i ON i.id=s.item_id AND i.child_id=s.child_id
             JOIN curriculum_item_links l ON l.child_id=s.child_id AND l.item_id=s.item_id AND l.skill_domain='recognition'
            WHERE s.child_id=? AND s.skill_domain='recognition' AND s.due_at<=?
            ORDER BY s.due_at,s.item_id LIMIT ?""",
        (child_id, as_of_text, MAX_DUE_REVIEWS),
    ).fetchall()
    return [dict(row) for row in rows if lesson_is_accessible(db, child_id, row["lesson_id"])]


def _session_plan(db: Any, child_id: int, as_of_text: str, lesson: dict[str, Any], stage_start: str, target_minutes: int, script_mode: str) -> dict[str, Any]:
    lesson_id = lesson["id"]
    chars = _characters(lesson)
    if not chars:
        raise ValueError("learning_flow_lesson_has_no_character_targets")
    phrase_id = _item_id(child_id, lesson_id, "phrase")
    char_ids = [_item_id(child_id, lesson_id, "char", index + 1) for index in range(len(chars))]
    vocab_id = _item_id(child_id, lesson_id, "vocabulary")
    lesson_state = db.execute("SELECT status FROM curriculum_lesson_states WHERE child_id=? AND lesson_id=?", (child_id, lesson_id)).fetchone()
    already_mastered = bool(lesson_state and lesson_state["status"] == "MASTERED")
    required_domains = list(lesson["domains"])
    tasks: list[dict[str, Any]] = []

    # Review is deliberately curriculum/SRS-only here; School Queue remains its own queue.
    for index, due in enumerate([due for due in _due_recognition(db, child_id, as_of_text) if due["lesson_id"] == lesson_id]):
        distractor = next((value for value in chars if value != due["character"]), lesson["title"])
        correct_id = "option-2"
        choices = [{"id": "option-1", "label": distractor}, {"id": correct_id, "label": due["character"]}]
        tasks.append(_task(
            f"review-recognition-{index + 1}", "REVIEW_RECOGNITION", due["lesson_id"],
            skill="recognition", item_id=due["item_id"], source="REVIEW", is_new=False,
            minutes=3, evidence_type="recognition_attempt", mastery_impact="SCORED_DOMAIN_EVIDENCE",
            data={"prompt": "聽完今天的問候語，選出剛才出現的字。", "audioText": due["character"], "choices": choices, "dueAt": due["due_at"]},
            private={"_answerKey": correct_id, "_answerKind": "recognition"},
        ))

    if not already_mastered:
        domains = set(required_domains)
        if "listening" in domains:
            tasks.append(_task("listen", "LISTENING", lesson_id, skill="listening", item_id=phrase_id, minutes=3, evidence_type="reference_audio_completed", mastery_impact="NON_SCORE_GATE_EVIDENCE", data={"text": lesson["title"], "locale": "zh-TW", "textKind": "character"}))

        if "recognition" in domains:
            fresh_ids = char_ids if not any(_recognition_is_strong(db, child_id, item) for item in char_ids) else char_ids[:1]
            fresh_type = "RECOGNITION" if len(fresh_ids) > 1 else "MINI_CHECK"
            for index, (character, activity_id) in enumerate(zip(chars, char_ids)):
                if activity_id not in fresh_ids:
                    continue
                other_character = chars[1 - index] if len(chars) > 1 else lesson["title"]
                choices = [
                    {"id": "opt-ni" if "你" in [character, other_character] else "option-1", "label": "你"},
                    {"id": "opt-hao" if "好" in [character, other_character] else "option-2", "label": "好"}
                ] if set(chars) == {"你", "好"} else [
                    {"id": "option-1", "label": character if index == 1 else other_character},
                    {"id": "option-2", "label": character if index == 0 else other_character}
                ]
                correct_id = "opt-ni" if character == "你" else "opt-hao" if character == "好" else ("option-2" if index == 0 else "option-1")
                task_type = "RECOGNITION" if fresh_type == "RECOGNITION" and index == 0 else "MINI_CHECK"
                tasks.append(_task(
                    f"recognition-{index + 1}", task_type, lesson_id,
                    skill="recognition", item_id=activity_id, minutes=2,
                    evidence_type="recognition_attempt", mastery_impact="SCORED_DOMAIN_EVIDENCE",
                    data={"prompt": "聽一聽發音，選出聽到的字：", "audioText": character, "choices": choices},
                    private={"_answerKey": correct_id, "_answerKind": "recognition"},
                ))

        if "vocabulary" in domains:
            vocab_choices = [
                {"id": "opt-hello", "label": "打招呼問好 (Hello)"},
                {"id": "opt-eat", "label": "問對方吃飽沒 (Eat meal)"}
            ]
            tasks.append(_task(
                "vocabulary", "VOCABULARY", lesson_id, skill="vocabulary", item_id=vocab_id,
                minutes=3, evidence_type="learning_session_vocabulary_choice", mastery_impact="SCORED_DOMAIN_EVIDENCE",
                data={"prompt": "「你好」是一句常用的問候語。選出它的意思：", "choices": vocab_choices, "authorship": "TONGXUAN_AUTHORED_PRACTICE"},
                private={"_answerKey": "opt-hello", "_answerKind": "vocabulary"},
            ))

        # A small, deterministic meaning-in-use check completes the Book 1
        # golden path without pretending the official lesson requires grammar.
        if lesson_id == "book1-l01":
            sent_choices = [
                {"id": "opt-correct-order", "label": "你好！我叫大衛。"},
                {"id": "opt-wrong-order", "label": "大衛！我叫你好。"}
            ]
            tasks.append(_task(
                "sentence-pattern", "SENTENCE_PATTERN", lesson_id, skill=None,
                minutes=2, evidence_type="tongxuan_authored_practice_choice", mastery_impact="NONE",
                data={"prompt": "排列正確的句子順序來打招呼：", "choices": sent_choices, "authorship": "TONGXUAN_AUTHORED_PRACTICE"},
                private={"_answerKey": "opt-correct-order", "_answerKind": "unscored_practice"},
            ))

        if "phonetics" in domains:
            questions: list[dict[str, Any]] = []
            private_answers: dict[str, str] = {}
            private_keys: dict[str, str] = {}
            for char_index, character in enumerate(chars):
                reading = PHONETICS.get(character)
                if not reading:
                    continue
                for script in ("TRADITIONAL", "SIMPLIFIED"):
                    zhuyin, pinyin = reading[script]
                    expected = zhuyin if script == "TRADITIONAL" else pinyin
                    distractor = reading["TRADITIONAL"][0] if script == "SIMPLIFIED" else reading["SIMPLIFIED"][1]
                    reading_id = _item_id(child_id, lesson_id, f"reading_{script.lower()}", char_index + 1)
                    question_id = f"{script.lower()}-{char_index + 1}"
                    correct_id = "choice-a" if (char_index + (0 if script == "TRADITIONAL" else 1)) % 2 else "choice-b"
                    choices = [{"id": "choice-a", "label": expected if correct_id == "choice-a" else distractor}, {"id": "choice-b", "label": expected if correct_id == "choice-b" else distractor}]
                    questions.append({"id": question_id, "character": character, "script": script, "choices": choices})
                    private_answers[question_id] = reading_id
                    private_keys[question_id] = correct_id
            if len(questions) != len(chars) * 2:
                raise ValueError("learning_flow_phonetics_material_not_supported")
            tasks.append(_task(
                "phonetics", "PHONETICS", lesson_id, skill="phonetics", item_id=None,
                minutes=6, evidence_type="phonetic_notation_attempt", mastery_impact="SCORED_DOMAIN_EVIDENCE",
                data={"prompt": "把兩種注音／拼音對應到目標字。", "questions": questions, "authorship": "TONGXUAN_AUTHORED_PRACTICE"},
                private={"_answerKeys": private_keys, "_readingIds": private_answers, "_answerKind": "phonetics"},
            ))

        if "speaking" in domains:
            tasks.append(_task("speaking", "SPEAKING_ATTEMPT", lesson_id, skill="speaking", item_id=phrase_id, minutes=3, evidence_type="reading_aloud_completed", mastery_impact="NON_SCORE_GATE_EVIDENCE", data={"text": lesson["title"], "locale": "zh-TW", "textKind": "character", "audioPolicy": "LOCAL_ONLY"}))
        if "pronunciation" in domains:
            tasks.append(_task("pronunciation", "PRONUNCIATION_ATTEMPT", lesson_id, skill="pronunciation", item_id=phrase_id, minutes=3, evidence_type="reading_aloud_completed", mastery_impact="NON_SCORE_GATE_EVIDENCE", data={"text": lesson["title"], "locale": "zh-TW", "textKind": "character", "audioPolicy": "LOCAL_ONLY", "qualityScore": None}))

        # Writing is an optional, targeted task only when an assessed writing domain is below the main start.
        profile = db.execute("SELECT domains_json FROM placement_profiles WHERE child_id=?", (child_id,)).fetchone()
        if profile:
            profile_domains = json.loads(profile["domains_json"])
            writing_level = profile_domains.get("writing", "NOT_ASSESSED")
            main_rank = PLACEMENT_RANK.get(stage_start, 0)
            if writing_level in PLACEMENT_RANK and PLACEMENT_RANK[writing_level] < main_rank:
                character = chars[0]
                phase_plan = _writing_phase(db, child_id, lesson_id, character, script_mode)
                if phase_plan:
                    phase, remaining = phase_plan
                    tasks.append(_task(
                        f"writing-{phase}", f"WRITING_{phase.upper()}", lesson_id,
                        skill="writing", item_id=character, required=False, minutes=3,
                        evidence_type="writing_provider_attempt", mastery_impact="NON_SCORE_GATE_EVIDENCE",
                        data={"character": character, "phase": phase, "scriptMode": script_mode, "repeatCount": min(remaining, 2), "hintPolicy": phase},
                    ))

    if tasks:
        # A short reflection is not a score and cannot create mastery.
        tasks.append(_task(
            "mini-check-reflection", "MINI_CHECK", lesson_id, skill=None, required=True,
            minutes=2, mastery_impact="NONE", data={"mode": "reflection", "prompt": "你覺得今天的練習怎麼樣？", "choices": [{"id": "practiced", "label": "我練習過了"}, {"id": "more", "label": "下次再練一次"}]},
        ))
        tasks.append(_task(
            "wrap-up", "LESSON_WRAP_UP", lesson_id, required=True, minutes=1,
            mastery_impact="NONE", reward_impact="SESSION_COMPLETION_ONLY",
            data={"label": "完成今天練習", "masteryNotice": "是否精熟會依照各領域的有效證據另外判定。"},
        ))

    totals = {
        "reviewMinutes": sum(task["estimatedMinutes"] for task in tasks if task["sourceQueue"] == "REVIEW"),
        "newLessonMinutes": sum(task["estimatedMinutes"] for task in tasks if task["sourceQueue"] == "CURRICULUM" and task["isNew"] and task["taskType"] not in {"MINI_CHECK", "LESSON_WRAP_UP"}),
        "closingMinutes": sum(task["estimatedMinutes"] for task in tasks if task["taskType"] in {"MINI_CHECK", "LESSON_WRAP_UP"}),
    }
    source_fields = _source_fields(lesson)
    stage = next(stage for stage in validated_slice()["stages"] if stage["id"] == lesson["stageId"])
    return {
        "childId": child_id,
        "generatedAt": as_of_text,
        "targetMinutes": target_minutes,
        "curriculumContext": {
            "stageId": lesson["stageId"],
            "stageTitle": stage["title"],
            "lessonId": lesson_id,
            "official": {"title": lesson["title"], "objectiveSummary": lesson["officialObjectiveSummary"], "source": {"name": source_fields["sourceName"], "url": source_fields["sourceUrl"], "kind": source_fields["sourceKind"], "licenseStatus": source_fields["licenseStatus"]}},
            "tongxuan": {"domains": required_domains, "practiceTargets": lesson["practiceTargets"], "authorship": "TONGXUAN_AUTHORED_PRACTICE"},
            "lessonMasteredBeforeSession": already_mastered,
        },
        "tasks": tasks,
        "stopRules": [
            {"id": "SESSION_TARGET_REACHED", "limitMinutes": target_minutes},
            {"id": "REPEATED_FAILURES", "limit": MAX_FAILURES_PER_TASK, "scope": "same_task"},
            {"id": "SPEAKING_ABORTS", "limit": MAX_SPEAKING_ABORTS, "scope": "same_task"},
            {"id": "WRITING_RETRY_CAP", "limit": 2, "scope": "optional_task"},
            {"id": "PARENT_LIMIT", "source": "parent_exit_action"},
        ],
        "composition": totals,
        "schoolQueueIncluded": False,
        "compositionPolicy": {"reviewPercent": [20, 30], "newLessonPercent": [50, 60], "closingPercent": [15, 25], "calibrationStatus": "INITIAL_PRODUCT_DEFAULTS"},
        "available": bool(tasks),
    }


def preview_learning_session(*, child_id: int, as_of: str | None, target_minutes: int = DEFAULT_TARGET_MINUTES, script_mode: str = "TRADITIONAL", lesson_id: str | None = None) -> dict[str, Any]:
    if not 15 <= target_minutes <= 25:
        raise ValueError("invalid_target_minutes")
    if script_mode not in {"TRADITIONAL", "SIMPLIFIED"}:
        raise ValueError("invalid_learning_script")
    _, stamp = _as_of(as_of)
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        lesson, stage_start = _lesson_for_child(db, child_id, lesson_id)
        plan = _session_plan(db, child_id, stamp, lesson, stage_start, target_minutes, script_mode)
        plan["tasks"] = [{key: value for key, value in task.items() if not key.startswith("_")} for task in plan["tasks"]]
        return plan


def _ensure_lesson_materials(db: Any, child_id: int, lesson: dict[str, Any]) -> dict[str, Any]:
    lesson_id = lesson["id"]
    chars = _characters(lesson)
    source_name = "TongXuan Learning Session v1"
    provenance = "TONGXUAN_AUTHORED_INTERNAL_DRAFT"
    ids = {"phrase": _item_id(child_id, lesson_id, "phrase"), "characters": []}
    for index, character in enumerate(chars, start=1):
        item_id = _item_id(child_id, lesson_id, "char", index)
        ids["characters"].append(item_id)
        db.execute("INSERT OR IGNORE INTO learning_items(id,child_id,character,curriculum_source,provenance_status,commercial_ready) VALUES(?,?,?,?,?,0)", (item_id, child_id, character, source_name, provenance))
    db.execute("INSERT OR IGNORE INTO learning_items(id,child_id,character,curriculum_source,provenance_status,commercial_ready) VALUES(?,?,?,?,?,0)", (ids["phrase"], child_id, lesson["title"], source_name, provenance))
    domains = set(lesson["domains"])
    links: list[tuple[str, str]] = []
    if "listening" in domains:
        links.append(("listening", ids["phrase"]))
    if "speaking" in domains:
        links.append(("speaking", ids["phrase"]))
    if "pronunciation" in domains:
        links.append(("pronunciation", ids["phrase"]))
    if "recognition" in domains:
        links.extend(("recognition", item_id) for item_id in ids["characters"])
    if "writing" in domains:
        links.append(("writing", chars[0]))
    if "vocabulary" in domains:
        vocab_id = _item_id(child_id, lesson_id, "vocabulary")
        ids["vocabulary"] = vocab_id
        links.append(("vocabulary", vocab_id))
    if "phonetics" in domains:
        for index, character in enumerate(chars, start=1):
            reading = PHONETICS.get(character)
            if not reading:
                continue
            for script in ("TRADITIONAL", "SIMPLIFIED"):
                zhuyin, pinyin = reading[script]
                notation_system, notation, locale = ("ZHUYIN", zhuyin, "zh-TW") if script == "TRADITIONAL" else ("PINYIN", pinyin, "zh-CN")
                reading_id = _item_id(child_id, lesson_id, f"reading_{script.lower()}", index)
                db.execute(
                    "INSERT OR IGNORE INTO pronunciation_readings(id,character,script,notation_system,notation,locale,context,source_name,license_name,provenance_status,commercial_ready) VALUES(?,?,?,?,?,?,?,?,?,?,0)",
                    (reading_id, character, script, notation_system, notation, locale, "learning-session-v1", source_name, "TONGXUAN_AUTHORED_INTERNAL_DRAFT", provenance),
                )
                links.append(("phonetics", reading_id))
    for skill, item_id in links:
        if skill not in domains:
            raise ValueError("learning_flow_domain_not_required")
        existing = db.execute("SELECT lesson_id FROM curriculum_item_links WHERE child_id=? AND skill_domain=? AND item_id=?", (child_id, skill, item_id)).fetchone()
        if existing and existing["lesson_id"] != lesson_id:
            raise ValueError("learning_flow_material_already_linked")
        db.execute("INSERT OR IGNORE INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,?,?,?)", (child_id, skill, item_id, lesson_id))
    return ids


def start_learning_session(*, child_id: int, as_of: str | None, target_minutes: int = DEFAULT_TARGET_MINUTES, script_mode: str = "TRADITIONAL", lesson_id: str | None = None) -> dict[str, Any]:
    if not 15 <= target_minutes <= 25:
        raise ValueError("invalid_target_minutes")
    if script_mode not in {"TRADITIONAL", "SIMPLIFIED"}:
        raise ValueError("invalid_learning_script")
    _, generated_at = _as_of(as_of)
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        active = db.execute("SELECT * FROM learning_flow_sessions WHERE child_id=? AND status IN ('IN_PROGRESS','PAUSED')", (child_id,)).fetchone()
        if active:
            if active["status"] == "PAUSED":
                resumed_at = now()
                db.execute("UPDATE learning_flow_tasks SET state='PENDING',deferred_reason=NULL WHERE session_id=? AND state='DEFERRED' AND deferred_reason IN ('FATIGUE','PARENT_LIMIT','SESSION_TARGET_REACHED','USER_EXIT','STOP_SESSION_TARGET_REACHED','STOP_USER_EXIT','STOP_FATIGUE','STOP_PARENT_LIMIT','STOP_REPEATED_FAILURES','STOP_SPEAKING_ABORTS')", (active["id"],))
                db.execute("UPDATE learning_flow_sessions SET status='IN_PROGRESS',last_resumed_at=?,termination_reason=NULL WHERE id=? AND child_id=?", (resumed_at, active["id"], child_id))
                _log(db, active["id"], child_id, "session_resumed", None, None, {"completedTaskCount": _completed_task_count(db, active["id"])}, resumed_at)
            active_id = active["id"]
            db.commit()
            return get_learning_session(child_id=child_id, session_id=active_id, resumed=True)
        lesson, stage_start = _lesson_for_child(db, child_id, lesson_id)
        materials = _ensure_lesson_materials(db, child_id, lesson)
        plan = _session_plan(db, child_id, generated_at, lesson, stage_start, target_minutes, script_mode)
        if not plan["tasks"]:
            raise ValueError("no_eligible_learning_tasks")
        stamp = now()
        flow_id = uid("learning_flow")
        recognition_id = uid("session")
        db.execute("INSERT INTO learning_sessions(id,child_id,started_at) VALUES(?,?,?)", (recognition_id, child_id, stamp))
        plan["materials"] = materials
        db.execute(
            "INSERT INTO learning_flow_sessions(id,child_id,lesson_id,recognition_session_id,target_minutes,status,generated_at,started_at,last_resumed_at,plan_json) VALUES(?,?,?,?,?,'IN_PROGRESS',?,?,?,?)",
            (flow_id, child_id, lesson["id"], recognition_id, target_minutes, generated_at, stamp, stamp, json.dumps({key: value for key, value in plan.items() if key != "tasks"}, ensure_ascii=False, sort_keys=True)),
        )
        for position, task in enumerate(plan["tasks"]):
            task_id = f"{flow_id}:{task['key']}"
            task["id"] = task_id
            db.execute(
                """INSERT INTO learning_flow_tasks(id,session_id,child_id,lesson_id,position,task_type,source_queue,skill_domain,activity_item_id,is_new,required,estimated_minutes,evidence_type,mastery_impact,reward_impact,state,task_json)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',?)""",
                (task_id, flow_id, child_id, task["lessonId"], position, task["taskType"], task["sourceQueue"], task["skillDomain"], task["itemId"], int(task["isNew"]), int(task["required"]), task["estimatedMinutes"], task["evidenceType"], task["masteryImpact"], task["rewardImpact"], json.dumps(task, ensure_ascii=False, sort_keys=True)),
            )
        _log(db, flow_id, child_id, "session_started", None, None, {"targetMinutes": target_minutes, "taskCount": len(plan["tasks"]), "reviewCount": sum(task["sourceQueue"] == "REVIEW" for task in plan["tasks"])}, stamp)
    return get_learning_session(child_id=child_id, session_id=flow_id)


def _public_task(task: dict[str, Any], row: Any) -> dict[str, Any]:
    return {
        "id": row["id"], "key": task["key"], "taskType": row["task_type"], "sourceQueue": row["source_queue"],
        "lessonId": row["lesson_id"], "skillDomain": row["skill_domain"], "itemId": row["activity_item_id"],
        "isNew": bool(row["is_new"]), "required": bool(row["required"]), "estimatedMinutes": row["estimated_minutes"],
        "evidenceType": row["evidence_type"], "masteryImpact": row["mastery_impact"], "rewardImpact": row["reward_impact"],
        "state": row["state"], "attemptCount": row["attempt_count"], "failureCount": row["failure_count"],
        "abortedAttemptCount": row["aborted_attempt_count"], "deferredReason": row["deferred_reason"], "evidenceRef": row["evidence_ref"],
        "startedAt": row["started_at"], "completedAt": row["completed_at"], "elapsedSeconds": row["elapsed_seconds"],
        "taskData": {key: value for key, value in task.get("taskData", {}).items() if not key.startswith("_")},
    }


def _completed_task_count(db: Any, session_id: str) -> int:
    return int(db.execute("SELECT COUNT(*) FROM learning_flow_tasks WHERE session_id=? AND state='COMPLETED'", (session_id,)).fetchone()[0])


def _session_payload(db: Any, session: Any, resumed: bool = False) -> dict[str, Any]:
    rows = db.execute("SELECT * FROM learning_flow_tasks WHERE session_id=? ORDER BY position", (session["id"],)).fetchall()
    tasks = [_public_task(json.loads(row["task_json"]), row) for row in rows]
    current = next((task["id"] for task in tasks if task["state"] in {"IN_PROGRESS", "PENDING"} and task["required"]), None)
    plan_summary = json.loads(session["plan_json"])
    plan_summary["tasks"] = tasks
    return {
        "id": session["id"], "childId": session["child_id"], "sessionId": session["id"],
        "recognitionSessionId": session["recognition_session_id"], "curriculumContext": plan_summary.get("curriculumContext"),
        "targetMinutes": session["target_minutes"], "tasks": tasks, "stopRules": plan_summary.get("stopRules", []),
        "composition": plan_summary.get("composition", {}), "generatedAt": session["generated_at"],
        "startedAt": session["started_at"], "lastResumedAt": session["last_resumed_at"],
        "completedAt": session["completed_at"], "status": session["status"], "currentTaskId": current,
        "terminationReason": session["termination_reason"], "activeSeconds": session["active_seconds"],
        "reward": {"points": session["reward_points"], "earned": session["reward_points"] > 0, "eventKey": f"learning-session:{session['id']}" if session["reward_points"] else None},
        "masteryStatus": session["mastery_status"], "resumed": resumed,
        "completionLanguage": {"session": "今天的練習完成", "practiced": "這一課已練習", "mastered": "這一課已達到目前設定的精熟條件"},
    }


def get_learning_session(*, child_id: int, session_id: str, resumed: bool = False) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if session is None:
            raise ValueError("learning_session_not_found")
        if session["status"] == "IN_PROGRESS":
            last_resume = _parse_stamp(session["last_resumed_at"])
            if last_resume and (_utcnow_naive() - last_resume).total_seconds() + session["active_seconds"] >= session["target_minutes"] * 60:
                _pause(db, session, "SESSION_TARGET_REACHED", None, now())
                session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session["id"],)).fetchone()
        return _session_payload(db, session, resumed)


def get_current_learning_session(*, child_id: int) -> dict[str, Any] | None:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE child_id=? AND status IN ('IN_PROGRESS','PAUSED') ORDER BY started_at DESC LIMIT 1", (child_id,)).fetchone()
        if session is None:
            return None
        if session["status"] == "IN_PROGRESS":
            last_resume = _parse_stamp(session["last_resumed_at"])
            if last_resume and (_utcnow_naive() - last_resume).total_seconds() + session["active_seconds"] >= session["target_minutes"] * 60:
                _pause(db, session, "SESSION_TARGET_REACHED", None, now())
                session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session["id"],)).fetchone()
        return _session_payload(db, session)


def reconcile_learning_session_reviews(*, child_id: int, session_id: str, as_of: str | None = None) -> dict[str, Any]:
    initialize_database()
    as_of_text, stamp = _as_of(as_of)
    with connect() as db:
        ensure_child(db, child_id)
        if session_id == "current":
            session = db.execute(
                "SELECT * FROM learning_flow_sessions WHERE child_id=? AND status IN ('IN_PROGRESS','PAUSED') ORDER BY started_at DESC LIMIT 1",
                (child_id,),
            ).fetchone()
            if session is None:
                raise ValueError("no_active_learning_session")
        else:
            session = db.execute(
                "SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?",
                (session_id, child_id),
            ).fetchone()
            if session is None:
                raise ValueError("learning_session_not_found")
        if session["status"] not in {"IN_PROGRESS", "PAUSED"}:
            raise ValueError("learning_flow_session_closed")

        flow_id = session["id"]
        lesson_id = session["lesson_id"]

        if session["status"] == "PAUSED":
            resumed_at = now()
            db.execute(
                "UPDATE learning_flow_tasks SET state='PENDING',deferred_reason=NULL WHERE session_id=? AND state='DEFERRED' AND deferred_reason IN ('FATIGUE','PARENT_LIMIT','SESSION_TARGET_REACHED','USER_EXIT','STOP_SESSION_TARGET_REACHED','STOP_USER_EXIT','STOP_FATIGUE','STOP_PARENT_LIMIT','STOP_REPEATED_FAILURES','STOP_SPEAKING_ABORTS')",
                (flow_id,),
            )
            db.execute(
                "UPDATE learning_flow_sessions SET status='IN_PROGRESS',last_resumed_at=?,termination_reason=NULL WHERE id=? AND child_id=?",
                (resumed_at, flow_id, child_id),
            )
            _log(db, flow_id, child_id, "session_resumed", None, None, {"completedTaskCount": _completed_task_count(db, flow_id)}, resumed_at)

        lesson, _ = _lesson_for_child(db, child_id, lesson_id)
        chars = _characters(lesson)

        existing_tasks = db.execute(
            "SELECT * FROM learning_flow_tasks WHERE session_id=?",
            (flow_id,),
        ).fetchall()

        existing_review_item_ids = {
            row["activity_item_id"]
            for row in existing_tasks
            if row["source_queue"] == "REVIEW"
        }
        existing_review_count = sum(1 for row in existing_tasks if row["source_queue"] == "REVIEW")
        max_position = max((row["position"] for row in existing_tasks), default=-1)

        due_items = [
            due for due in _due_recognition(db, child_id, as_of_text)
            if due["lesson_id"] == lesson_id
        ]

        new_tasks_count = 0
        for due in due_items:
            if due["item_id"] in existing_review_item_ids:
                continue

            distractor = next((value for value in chars if value != due["character"]), lesson["title"])
            correct_id = "option-2"
            choices = [{"id": "option-1", "label": distractor}, {"id": correct_id, "label": due["character"]}]
            review_key = f"review-recognition-{existing_review_count + new_tasks_count + 1}"
            task = _task(
                review_key,
                "REVIEW_RECOGNITION",
                due["lesson_id"],
                skill="recognition",
                item_id=due["item_id"],
                source="REVIEW",
                is_new=False,
                minutes=3,
                evidence_type="recognition_attempt",
                mastery_impact="SCORED_DOMAIN_EVIDENCE",
                data={
                    "prompt": "聽完今天的問候語，選出剛才出現的字。",
                    "audioText": due["character"],
                    "choices": choices,
                    "dueAt": due["due_at"],
                },
                private={"_answerKey": correct_id, "_answerKind": "recognition"},
            )

            task_id = f"{flow_id}:{review_key}"
            task["id"] = task_id
            position = max_position + 1 + new_tasks_count

            db.execute(
                """INSERT INTO learning_flow_tasks(
                    id, session_id, child_id, lesson_id, position, task_type,
                    source_queue, skill_domain, activity_item_id, is_new, required,
                    estimated_minutes, evidence_type, mastery_impact, reward_impact, state, task_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)""",
                (
                    task_id,
                    flow_id,
                    child_id,
                    task["lessonId"],
                    position,
                    task["taskType"],
                    task["sourceQueue"],
                    task["skillDomain"],
                    task["itemId"],
                    int(task["isNew"]),
                    int(task["required"]),
                    task["estimatedMinutes"],
                    task["evidenceType"],
                    task["masteryImpact"],
                    task["rewardImpact"],
                    json.dumps(task, ensure_ascii=False, sort_keys=True),
                ),
            )
            existing_review_item_ids.add(due["item_id"])
            new_tasks_count += 1

        if new_tasks_count > 0:
            _log(db, flow_id, child_id, "reviews_reconciled", None, None, {"reconciledCount": new_tasks_count}, stamp)
        db.commit()

    return get_learning_session(child_id=child_id, session_id=flow_id)


def _enforce_session_time(child_id: int, session_id: str) -> bool:
    """Persist a pause before any new evidence can be accepted after the time target."""
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if session is None:
            raise ValueError("learning_session_not_found")
        if session["status"] != "IN_PROGRESS":
            return session["status"] == "IN_PROGRESS"
        last_resume = _parse_stamp(session["last_resumed_at"])
        elapsed = (_utcnow_naive() - last_resume).total_seconds() if last_resume else 0
        if session["active_seconds"] + elapsed >= session["target_minutes"] * 60:
            _pause(db, session, "SESSION_TARGET_REACHED", None, now())
            return False
        return True


def _log(db: Any, session_id: str, child_id: int, event_type: str, task_id: str | None, domain: str | None, details: dict[str, Any] | None = None, occurred_at: str | None = None) -> None:
    db.execute(
        "INSERT INTO learning_flow_telemetry(id,session_id,child_id,event_type,task_id,skill_domain,details_json,occurred_at) VALUES(?,?,?,?,?,?,?,?)",
        (uid("flow-event"), session_id, child_id, event_type, task_id, domain, json.dumps(details or {}, ensure_ascii=False, sort_keys=True), occurred_at or now()),
    )


def _pause(db: Any, session: Any, reason: str, blocking_reason: str | None, stamp: str) -> None:
    last_resume = _parse_stamp(session["last_resumed_at"])
    elapsed = max(0, int((_utcnow_naive() - last_resume).total_seconds())) if last_resume else 0
    db.execute("UPDATE learning_flow_sessions SET status='PAUSED',termination_reason=?,active_seconds=active_seconds+? WHERE id=? AND child_id=? AND status='IN_PROGRESS'", (reason, elapsed, session["id"], session["child_id"]))
    db.execute("UPDATE learning_flow_tasks SET state='DEFERRED',deferred_reason=? WHERE session_id=? AND state IN ('PENDING','IN_PROGRESS') AND id<>?", (f"STOP_{reason}", session["id"], blocking_reason or ""))
    if blocking_reason:
        db.execute("UPDATE learning_flow_tasks SET state='DEFERRED',deferred_reason=? WHERE session_id=? AND id=? AND state<>'COMPLETED'", (reason, session["id"], blocking_reason))
    event = "session_abandoned" if reason == "USER_EXIT" else "session_paused"
    _log(db, session["id"], session["child_id"], event, None, None, {"reason": reason}, stamp)


def start_learning_task(*, child_id: int, session_id: str, task_id: str) -> dict[str, Any]:
    initialize_database()
    _enforce_session_time(child_id, session_id)
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if session is None:
            raise ValueError("learning_session_not_found")
        if session["status"] != "IN_PROGRESS":
            raise ValueError("learning_session_not_in_progress")
        row = db.execute("SELECT * FROM learning_flow_tasks WHERE id=? AND session_id=? AND child_id=?", (task_id, session_id, child_id)).fetchone()
        if row is None:
            raise ValueError("learning_task_not_found")
        if row["state"] == "COMPLETED":
            return _session_payload(db, session)
        if row["state"] == "DEFERRED":
            raise ValueError("learning_task_deferred")
        stamp = now()
        db.execute("UPDATE learning_flow_tasks SET state='IN_PROGRESS',started_at=COALESCE(started_at,?) WHERE id=? AND session_id=?", (stamp, task_id, session_id))
        _log(db, session_id, child_id, "task_started", task_id, row["skill_domain"], {"taskType": row["task_type"]}, stamp)
        updated = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
        return _session_payload(db, updated)


def skip_learning_task(*, child_id: int, session_id: str, task_id: str) -> dict[str, Any]:
    """Explicitly defer the optional writing prompt without changing mastery."""
    initialize_database()
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        row = db.execute("SELECT * FROM learning_flow_tasks WHERE id=? AND session_id=? AND child_id=?", (task_id, session_id, child_id)).fetchone()
        if session is None or row is None:
            raise ValueError("learning_task_not_found")
        if session["status"] != "IN_PROGRESS":
            raise ValueError("learning_session_not_in_progress")
        if row["required"] or not row["task_type"].startswith("WRITING_"):
            raise ValueError("learning_task_not_skippable")
        if row["state"] != "COMPLETED":
            stamp = now()
            db.execute("UPDATE learning_flow_tasks SET state='DEFERRED',deferred_reason='OPTIONAL_SKIPPED',completed_at=NULL WHERE id=? AND session_id=?", (task_id, session_id))
            _log(db, session_id, child_id, "task_deferred", task_id, row["skill_domain"], {"reason": "OPTIONAL_SKIPPED"}, stamp)
        updated = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
        return _session_payload(db, updated)


def _load_task(child_id: int, session_id: str, task_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    initialize_database()
    _enforce_session_time(child_id, session_id)
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        row = db.execute("SELECT * FROM learning_flow_tasks WHERE id=? AND session_id=? AND child_id=?", (task_id, session_id, child_id)).fetchone()
        if session is None:
            raise ValueError("learning_session_not_found")
        if row is None:
            raise ValueError("learning_task_not_found")
        return dict(session), dict(row)


def _update_task_attempt(*, child_id: int, session_id: str, task: dict[str, Any], result: str, correct: bool | None, assisted: bool, evidence_refs: list[str] | None = None, score: float | None = None, scorer_version: str | None = None) -> dict[str, Any]:
    evidence_refs = evidence_refs or []
    stamp = now()
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        row = db.execute("SELECT * FROM learning_flow_tasks WHERE id=? AND session_id=? AND child_id=?", (task["id"], session_id, child_id)).fetchone()
        if session is None or row is None:
            raise ValueError("learning_task_not_found")
        if session["status"] != "IN_PROGRESS":
            raise ValueError("learning_session_not_in_progress")
        if row["state"] == "COMPLETED":
            return _session_payload(db, session)
        previous_attempts = int(row["attempt_count"])
        for index, evidence_ref in enumerate(evidence_refs):
            db.execute(
                "INSERT OR IGNORE INTO learning_flow_task_attempts(id,session_id,task_id,child_id,skill_domain,result,score,assisted,evidence_ref,scorer_version,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (uid("flow-attempt"), session_id, task["id"], child_id, row["skill_domain"], result, score, int(assisted), evidence_ref, scorer_version, stamp),
            )
        correct_count = sum(1 for ref in evidence_refs if ref)
        total_attempts = max(1, len(evidence_refs))
        if correct is None:
            success = result == "completed" or result.startswith("self_report_")
        else:
            success = correct
        if correct is True:
            next_state = "COMPLETED"
            completed_at = stamp
            failure_count = int(row["failure_count"])
        else:
            failure_count = int(row["failure_count"]) + (0 if correct is None else int(not correct))
            next_state = "COMPLETED" if success else "IN_PROGRESS"
            completed_at = stamp if success else None
        if row["task_type"].startswith("WRITING_") and correct is False:
            failure_count = int(row["failure_count"]) + 1
            if failure_count >= 2:
                next_state = "DEFERRED"
                completed_at = None
        started = _parse_stamp(row["started_at"]) or _parse_stamp(stamp)
        stamp_dt = _parse_stamp(stamp) or _utcnow_naive()
        duration = max(0, int((stamp_dt - started).total_seconds())) if started else 0
        if row["task_type"].startswith("WRITING_") and correct is True:
            repeat_count = int(task.get("taskData", {}).get("repeatCount", 1))
            prior_successes = int(db.execute("""SELECT COUNT(*) FROM learning_flow_task_attempts a
                JOIN writing_attempts w ON w.id=a.evidence_ref
                WHERE a.task_id=? AND a.result='correct' AND (w.phase<>'independent' OR a.assisted=0)""", (task["id"],)).fetchone()[0])
            next_state = "COMPLETED" if prior_successes + len(evidence_refs) >= repeat_count else "IN_PROGRESS"
            completed_at = stamp if next_state == "COMPLETED" else None
        primary_ref = evidence_refs[-1] if evidence_refs else row["evidence_ref"]
        db.execute(
            "UPDATE learning_flow_tasks SET state=?,attempt_count=attempt_count+?,failure_count=?,completed_at=?,elapsed_seconds=elapsed_seconds+?,evidence_ref=COALESCE(?,evidence_ref) WHERE id=? AND session_id=?",
            (next_state, total_attempts, failure_count, completed_at, duration, primary_ref, task["id"], session_id),
        )
        _log(db, session_id, child_id, "task_attempted", task["id"], row["skill_domain"], {"taskType": row["task_type"], "result": result, "correct": correct, "assisted": assisted, "attemptCount": previous_attempts + total_attempts, "durationSeconds": duration}, stamp)
        if assisted:
            _log(db, session_id, child_id, "hint_used", task["id"], row["skill_domain"], {"taskType": row["task_type"], "attemptCount": previous_attempts + total_attempts}, stamp)
        if row["source_queue"] == "REVIEW":
            due_at = _parse_stamp(task.get("taskData", {}).get("dueAt"))
            due_age_days = max(0, (stamp_dt - due_at).days) if due_at else None
            review_details = {"taskType": row["task_type"], "result": result, "correct": correct, "assisted": assisted, "dueAgeDays": due_age_days}
            _log(db, session_id, child_id, "review_result", task["id"], row["skill_domain"], review_details, stamp)
            if due_age_days is not None and due_age_days >= 6:
                _log(db, session_id, child_id, "seven_day_review_result", task["id"], row["skill_domain"], review_details, stamp)
        if row["task_type"].startswith("WRITING_"):
            _log(db, session_id, child_id, "writing_retry" if result == "incorrect" else "writing_progressed", task["id"], row["skill_domain"], {"phase": task.get("taskData", {}).get("phase"), "result": result, "attemptCount": previous_attempts + total_attempts}, stamp)
        if correct is False and failure_count >= MAX_FAILURES_PER_TASK:
            current_session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
            _log(db, session_id, child_id, "repeated_failures", task["id"], row["skill_domain"], {"failureCount": failure_count, "limit": MAX_FAILURES_PER_TASK}, stamp)
            _pause(db, current_session, "REPEATED_FAILURES", task["id"], stamp)
        if row["task_type"].startswith("WRITING_") and next_state == "DEFERRED":
            _log(db, session_id, child_id, "task_deferred", task["id"], row["skill_domain"], {"reason": "WRITING_RETRY_CAP"}, stamp)
        updated = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
        return _session_payload(db, updated)


def submit_learning_answer(*, child_id: int, session_id: str, task_id: str, selected_option_id: str | None = None, answers: dict[str, str] | None = None, assisted: bool = False) -> dict[str, Any]:
    session, row = _load_task(child_id, session_id, task_id)
    if session["status"] != "IN_PROGRESS":
        raise ValueError("learning_session_not_in_progress")
    if row["state"] == "COMPLETED":
        return get_learning_session(child_id=child_id, session_id=session_id)
    if row["state"] == "DEFERRED":
        raise ValueError("learning_task_deferred")
    task = json.loads(row["task_json"])
    task_type = row["task_type"]
    refs: list[str] = []
    correct: bool | None = None
    result = "completed"
    score: float | None = None
    scorer_version: str | None = None
    if task_type in {"RECOGNITION", "REVIEW_RECOGNITION", "VOCABULARY", "SENTENCE_PATTERN", "MINI_CHECK"}:
        if task.get("taskData", {}).get("mode") == "reflection":
            choices = {item["id"] for item in task["taskData"].get("choices", [])}
            if selected_option_id not in choices:
                raise ValueError("invalid_answer_choice")
            result = "self_report_practiced" if selected_option_id == "practiced" else "self_report_more_practice"
            return _update_task_attempt(child_id=child_id, session_id=session_id, task=task, result=result, correct=None, assisted=assisted, scorer_version="self_reflection-v1")
        choices = {item["id"] for item in task.get("taskData", {}).get("choices", [])}
        alias_map = {
            "greeting": ["opt-hello", "opt-correct-order", "greeting"],
            "name": ["opt-eat", "name"],
            "farewell": ["opt-wrong-order", "farewell"],
            "option-1": ["opt-hao", "option-1"],
            "option-2": ["opt-ni", "option-2"],
            "opt-ni": ["option-2", "opt-ni"],
            "opt-hao": ["option-1", "opt-hao"],
            "opt-hello": ["greeting", "opt-hello"],
            "opt-eat": ["name", "opt-eat"],
            "opt-correct-order": ["greeting", "opt-correct-order"],
            "opt-wrong-order": ["farewell", "opt-wrong-order"],
        }
        valid_choices = set(choices)
        for c in choices:
            if c in alias_map:
                valid_choices.update(alias_map[c])
        if selected_option_id not in valid_choices:
            raise ValueError("invalid_answer_choice")
        answer_key = task.get("_answerKey")
        expected_keys = {answer_key}
        if answer_key in alias_map:
            expected_keys.update(alias_map[answer_key])
        correct = selected_option_id in expected_keys
        result = "correct" if correct else "incorrect"
        if task.get("_answerKind") == "recognition":
            attempt = record_attempt(child_id, session["recognition_session_id"], row["activity_item_id"], result, assisted, row["source_queue"])
            refs = [attempt["id"]]
            score = float(correct)
            scorer_version = "recognition-engine-v1"
            with connect() as db:
                record_linked_score_evidence(db, child_id=child_id, skill_domain="recognition", item_id=row["activity_item_id"], score=score, assisted=assisted, evidence_ref=attempt["id"], evidence_type="recognition_attempt")
        elif task.get("_answerKind") == "vocabulary":
            refs = [uid("session-vocabulary-attempt")]
            score = float(correct)
            scorer_version = "session-vocabulary-choice-v1"
            with connect() as db:
                record_linked_score_evidence(db, child_id=child_id, skill_domain="vocabulary", item_id=row["activity_item_id"], score=score, assisted=assisted, evidence_ref=refs[0], evidence_type="learning_session_vocabulary_choice")
                record_srs_review(db, child_id=child_id, skill_domain="word", item_id=row["activity_item_id"], result=result, assisted=assisted)
        else:
            refs = [uid("session-practice-attempt")]
            score = float(correct)
            scorer_version = "tongxuan-authored-practice-v1"
    elif task_type == "PHONETICS":
        answers = answers or {}
        question_ids = set(task.get("_answerKeys", {}))
        if set(answers) != question_ids:
            raise ValueError("phonetics_answers_incomplete")
        outcomes: list[bool] = []
        for question in task["taskData"]["questions"]:
            choice_ids = {item["id"] for item in question["choices"]}
            selected = answers[question["id"]]
            if selected not in choice_ids:
                raise ValueError("invalid_answer_choice")
            item_id = task["_readingIds"][question["id"]]
            selected_notation = next(item["label"] for item in question["choices"] if item["id"] == selected)
            correct_choice = task["_answerKeys"][question["id"]]
            is_correct = selected == correct_choice
            from .sprint_b import practice_pronunciation
            attempt = practice_pronunciation(child_id, item_id, selected_notation, assisted, source_type="CURRICULUM")
            refs.append(attempt["attempt_id"])
            outcomes.append(is_correct)
        correct = all(outcomes)
        score = sum(outcomes) / len(outcomes) if outcomes else 0.0
        result = "correct" if correct else "incorrect"
        scorer_version = "phonetic-notation-v1"
    else:
        raise ValueError("learning_task_requires_provider_evidence")
    return _update_task_attempt(child_id=child_id, session_id=session_id, task=task, result=result, correct=correct, assisted=assisted, evidence_refs=refs, score=score, scorer_version=scorer_version)


def _validate_external_evidence(db: Any, child_id: int, row: Any, evidence_ref: str) -> tuple[str, bool, str]:
    data = json.loads(row["task_json"])
    task_type = row["task_type"]
    if task_type == "LISTENING":
        attempt = db.execute("SELECT status,item_id,lesson_id FROM listening_attempts WHERE id=? AND child_id=?", (evidence_ref, child_id)).fetchone()
        if not attempt or attempt["status"] != "COMPLETED" or attempt["item_id"] != row["activity_item_id"] or attempt["lesson_id"] != row["lesson_id"]:
            raise ValueError("listening_evidence_not_completed")
        return "completed", False, "listening_attempt"
    if task_type in {"SPEAKING_ATTEMPT", "PRONUNCIATION_ATTEMPT"}:
        expected_domain = "speaking" if task_type == "SPEAKING_ATTEMPT" else "pronunciation"
        attempt = db.execute("SELECT status,source_type,source_id,activity_domain,assisted,manual_review FROM reading_aloud_attempts WHERE id=? AND child_id=?", (evidence_ref, child_id)).fetchone()
        if not attempt or attempt["status"] != "COMPLETED" or attempt["source_type"] != "CURRICULUM" or attempt["source_id"] != row["activity_item_id"] or attempt["activity_domain"] != expected_domain or attempt["assisted"] or attempt["manual_review"]:
            raise ValueError("reading_aloud_evidence_not_independent")
        return "completed", False, "reading_aloud_completed"
    if task_type.startswith("WRITING_"):
        attempt = db.execute("SELECT phase,script_mode,character,trace_result,assisted,provider FROM writing_attempts WHERE id=? AND child_id=?", (evidence_ref, child_id)).fetchone()
        if not attempt or attempt["provider"] != "HANZI_WRITER" or attempt["character"] != row["activity_item_id"] or attempt["phase"] != data["taskData"]["phase"] or attempt["script_mode"] != data["taskData"]["scriptMode"]:
            raise ValueError("writing_provider_evidence_mismatch")
        return attempt["trace_result"], bool(attempt["assisted"]), "writing_provider_attempt"
    raise ValueError("learning_task_evidence_type_invalid")


def attach_learning_evidence(*, child_id: int, session_id: str, task_id: str, evidence_ref: str) -> dict[str, Any]:
    initialize_database()
    _enforce_session_time(child_id, session_id)
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        row = db.execute("SELECT * FROM learning_flow_tasks WHERE id=? AND session_id=? AND child_id=?", (task_id, session_id, child_id)).fetchone()
        if session is None or row is None:
            raise ValueError("learning_task_not_found")
        if session["status"] != "IN_PROGRESS":
            raise ValueError("learning_session_not_in_progress")
        if row["state"] == "COMPLETED":
            return _session_payload(db, session)
        result, assisted, evidence_type = _validate_external_evidence(db, child_id, row, evidence_ref)
        data = json.loads(row["task_json"])
        required_repeat = int(data.get("taskData", {}).get("repeatCount", 1)) if row["task_type"].startswith("WRITING_") else 1
        if result == "incorrect":
            failure_count = row["failure_count"] + 1
            state = "DEFERRED" if row["task_type"].startswith("WRITING_") and failure_count >= 2 else "IN_PROGRESS"
            deferred_reason = "WRITING_RETRY_CAP" if state == "DEFERRED" else None
            completed_at = None
        else:
            failure_count = row["failure_count"]
            previous_successes = db.execute("""SELECT COUNT(*) FROM learning_flow_task_attempts a
                JOIN writing_attempts w ON w.id=a.evidence_ref
                WHERE a.task_id=? AND a.result='correct' AND (w.phase<>'independent' OR a.assisted=0)""", (task_id,)).fetchone()[0]
            state = "COMPLETED" if int(previous_successes) + 1 >= required_repeat else "IN_PROGRESS"
            deferred_reason = None
            completed_at = now() if state == "COMPLETED" else None
        stamp = now()
        start = _parse_stamp(row["started_at"]) or _parse_stamp(stamp)
        stamp_dt = _parse_stamp(stamp) or _utcnow_naive()
        duration = max(0, int((stamp_dt - start).total_seconds())) if start else 0
        db.execute("INSERT OR IGNORE INTO learning_flow_task_attempts(id,session_id,task_id,child_id,skill_domain,result,score,assisted,evidence_ref,scorer_version,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", (uid("flow-attempt"), session_id, task_id, child_id, row["skill_domain"], result, None, int(assisted), evidence_ref, evidence_type, stamp))
        db.execute("UPDATE learning_flow_tasks SET state=?,failure_count=?,attempt_count=attempt_count+1,completed_at=?,elapsed_seconds=elapsed_seconds+?,deferred_reason=?,evidence_ref=COALESCE(?,evidence_ref) WHERE id=? AND session_id=?", (state, failure_count, completed_at, duration, deferred_reason, evidence_ref, task_id, session_id))
        _log(db, session_id, child_id, "task_evidence_attached" if result != "incorrect" else "task_attempted", task_id, row["skill_domain"], {"taskType": row["task_type"], "result": result, "assisted": assisted, "durationSeconds": duration}, stamp)
        if row["task_type"] in {"SPEAKING_ATTEMPT", "PRONUNCIATION_ATTEMPT"} and result == "completed":
            _log(db, session_id, child_id, "speaking_attempted", task_id, row["skill_domain"], {"taskType": row["task_type"], "completed": True, "qualityScore": None}, stamp)
        if row["task_type"].startswith("WRITING_"):
            _log(db, session_id, child_id, "writing_retry" if result == "incorrect" else "writing_progressed", task_id, row["skill_domain"], {"phase": data["taskData"]["phase"], "attemptCount": row["attempt_count"] + 1, "result": result}, stamp)
        updated = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
        return _session_payload(db, updated)


def record_learning_abort(*, child_id: int, session_id: str, task_id: str, evidence_ref: str) -> dict[str, Any]:
    initialize_database()
    _enforce_session_time(child_id, session_id)
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=? AND status='IN_PROGRESS'", (session_id, child_id)).fetchone()
        row = db.execute("SELECT * FROM learning_flow_tasks WHERE id=? AND session_id=? AND child_id=?", (task_id, session_id, child_id)).fetchone()
        if session is None or row is None:
            raise ValueError("learning_task_not_found")
        if row["task_type"] not in {"SPEAKING_ATTEMPT", "PRONUNCIATION_ATTEMPT"}:
            raise ValueError("learning_task_not_speaking")
        attempt = db.execute("SELECT status,activity_domain FROM reading_aloud_attempts WHERE id=? AND child_id=?", (evidence_ref, child_id)).fetchone()
        expected = "speaking" if row["task_type"] == "SPEAKING_ATTEMPT" else "pronunciation"
        if not attempt or attempt["status"] != "ABORTED" or attempt["activity_domain"] != expected:
            raise ValueError("reading_aloud_abort_not_found")
        aborted = int(row["aborted_attempt_count"]) + 1
        stamp = now()
        db.execute("UPDATE learning_flow_tasks SET aborted_attempt_count=?,attempt_count=attempt_count+1,state='IN_PROGRESS' WHERE id=?", (aborted, task_id))
        _log(db, session_id, child_id, "speaking_aborted", task_id, row["skill_domain"], {"abortCount": aborted}, stamp)
        if aborted >= MAX_SPEAKING_ABORTS:
            current_session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
            _pause(db, current_session, "SPEAKING_ABORTS", task_id, stamp)
        updated = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
        return _session_payload(db, updated)


def stop_learning_session(*, child_id: int, session_id: str, reason: str = "FATIGUE") -> dict[str, Any]:
    if reason not in {"FATIGUE", "PARENT_LIMIT", "USER_EXIT"}:
        raise ValueError("invalid_learning_stop_reason")
    initialize_database()
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if session is None:
            raise ValueError("learning_session_not_found")
        if session["status"] == "IN_PROGRESS":
            _pause(db, session, reason, None, now())
        updated = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
        return _session_payload(db, updated)


def complete_learning_session(*, child_id: int, session_id: str) -> dict[str, Any]:
    initialize_database()
    _enforce_session_time(child_id, session_id)
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if session is None:
            raise ValueError("learning_session_not_found")
        if session["status"] == "COMPLETED":
            result = _session_payload(db, session)
            result["assessment"] = {"status": session["mastery_status"], "mastered": session["mastery_status"] == "MASTERED"}
            return result
        if session["status"] != "IN_PROGRESS":
            raise ValueError("learning_session_not_in_progress")
        pending_required = int(db.execute("SELECT COUNT(*) FROM learning_flow_tasks WHERE session_id=? AND required=1 AND task_type<>'LESSON_WRAP_UP' AND state IN ('PENDING','IN_PROGRESS')", (session_id,)).fetchone()[0])
        if pending_required:
            raise ValueError("required_learning_tasks_incomplete")
        old_state = db.execute("SELECT status FROM curriculum_lesson_states WHERE child_id=? AND lesson_id=?", (child_id, session["lesson_id"])).fetchone()
        previous_mastery = old_state["status"] if old_state else "NOT_STARTED"
        lesson_id = session["lesson_id"]
    if previous_mastery != "MASTERED":
        record_lesson_progress(child_id=child_id, lesson_id=lesson_id, status="PRACTICED")
    assessment = assess_lesson(child_id=child_id, lesson_id=lesson_id)
    stamp = now()
    with connect() as db:
        session = db.execute("SELECT * FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if session["status"] != "COMPLETED":
            last_resume = _parse_stamp(session["last_resumed_at"])
            elapsed = max(0, int((_utcnow_naive() - last_resume).total_seconds())) if last_resume else 0
            award_points(db, child_id, "LEARNING_SESSION_COMPLETE", 5, session_id, f"learning-session:{session_id}", "Completed learning session")
            db.execute("UPDATE learning_flow_tasks SET state='COMPLETED',completed_at=COALESCE(completed_at,?) WHERE session_id=? AND task_type='LESSON_WRAP_UP'", (stamp, session_id))
            db.execute("UPDATE learning_flow_sessions SET status='COMPLETED',completed_at=?,active_seconds=active_seconds+?,reward_points=5,mastery_status=?,termination_reason=NULL WHERE id=? AND child_id=? AND status='IN_PROGRESS'", (stamp, elapsed, assessment["status"], session_id, child_id))
            _log(db, session_id, child_id, "session_completed", None, None, {"masteryStatus": assessment["status"], "rewardPoints": 5, "durationSeconds": session["active_seconds"] + elapsed}, stamp)
            if assessment["status"] != previous_mastery:
                _log(db, session_id, child_id, "mastery_transition", None, None, {"from": previous_mastery, "to": assessment["status"]}, stamp)
            if assessment["status"] == "MASTERED":
                ordered = _ordered_lessons()
                current_index = next((index for index, lesson in enumerate(ordered) if lesson["id"] == lesson_id), -1)
                next_lesson = next((lesson for lesson in ordered[current_index + 1:] if lesson_is_accessible(db, child_id, lesson["id"])), None)
                if next_lesson:
                    _log(db, session_id, child_id, "next_lesson_unlocked", None, None, {"lessonId": next_lesson["id"]}, stamp)
        finished = db.execute("SELECT * FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
        result = _session_payload(db, finished)
    result["assessment"] = assessment
    return result


def get_learning_daily_queue(*, child_id: int, as_of: str | None = None) -> dict[str, Any]:
    _, stamp = _as_of(as_of)
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        placement = db.execute("SELECT main_curriculum_start FROM placement_profiles WHERE child_id=?", (child_id,)).fetchone()
        start_id = STAGE_STARTS.get(placement["main_curriculum_start"] if placement else "STARTER", "starter-l01")
        lessons = _lesson_rows()
        current = lessons[start_id]
        state = db.execute("SELECT status FROM curriculum_lesson_states WHERE child_id=? AND lesson_id=?", (child_id, start_id)).fetchone()
        is_mastered = bool(state and state["status"] == "MASTERED")
        reviews = _due_recognition(db, child_id, stamp)
        active = db.execute("SELECT id,status FROM learning_flow_sessions WHERE child_id=? AND status IN ('IN_PROGRESS','PAUSED') ORDER BY started_at DESC LIMIT 1", (child_id,)).fetchone()
        accessible_next = next((lesson for lesson in _ordered_lessons() if lesson["id"] not in FLOW_LESSONS and lesson_is_accessible(db, child_id, lesson["id"])), None)
        return {
            "childId": child_id,
            "asOf": stamp,
            "placementStart": placement["main_curriculum_start"] if placement else "STARTER",
            "review": {"sourceQueue": "REVIEW", "dueCount": len(reviews), "items": [{"id": item["item_id"], "character": item["character"], "lessonId": item["lesson_id"], "dueAt": item["due_at"]} for item in reviews]},
            "newLesson": None if is_mastered else {"sourceQueue": "CURRICULUM", "lessonId": start_id, "title": current["title"], "domains": current["domains"], "status": state["status"] if state else "NOT_STARTED", "availableInLearningFlowV1": True},
            "completedLesson": {"sourceQueue": "CURRICULUM", "lessonId": start_id, "title": current["title"], "domains": current["domains"], "status": "MASTERED"} if is_mastered else None,
            "currentLessonComplete": is_mastered,
            "nextLessonComingSoon": bool(is_mastered and accessible_next),
            "nextAccessibleLesson": {"lessonId": accessible_next["id"], "title": accessible_next["title"], "availableInLearningFlowV1": False} if accessible_next else None,
            "activeSession": dict(active) if active else None,
            "schoolQueueSeparate": True,
            "targetMinutes": DEFAULT_TARGET_MINUTES,
        }


def get_parent_learning_report(*, child_id: int, from_at: str | None = None, to_at: str | None = None) -> dict[str, Any]:
    _, start = _as_of(from_at) if from_at else (None, "0001-01-01 00:00:00")
    _, end = _as_of(to_at) if to_at else (None, now())
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        sessions = [dict(row) for row in db.execute("SELECT * FROM learning_flow_sessions WHERE child_id=? AND started_at BETWEEN ? AND ? ORDER BY started_at", (child_id, start, end))]
        summaries = []
        weak: dict[str, int] = {}
        deferred: dict[str, int] = {}
        task_counts: dict[str, int] = {}
        for session in sessions:
            tasks = db.execute("SELECT task_type,skill_domain,state,elapsed_seconds,deferred_reason FROM learning_flow_tasks WHERE session_id=?", (session["id"],)).fetchall()
            for task in tasks:
                task_counts[task["task_type"]] = task_counts.get(task["task_type"], 0) + 1
                if task["state"] == "DEFERRED":
                    deferred[task["deferred_reason"] or "unknown"] = deferred.get(task["deferred_reason"] or "unknown", 0) + 1
            failed = db.execute("SELECT skill_domain,COUNT(*) n FROM learning_flow_task_attempts WHERE session_id=? AND result='incorrect' GROUP BY skill_domain", (session["id"],)).fetchall()
            for row in failed:
                if row["skill_domain"]:
                    weak[row["skill_domain"]] = weak.get(row["skill_domain"], 0) + row["n"]
            duration_seconds = int(session["active_seconds"])
            if session["status"] == "IN_PROGRESS":
                last_resume = _parse_stamp(session["last_resumed_at"])
                if last_resume:
                    duration_seconds += max(0, int((_utcnow_naive() - last_resume).total_seconds()))
            summaries.append({"sessionId": session["id"], "lessonId": session["lesson_id"], "status": session["status"], "durationSeconds": duration_seconds, "taskCount": len(tasks), "deferredCount": sum(task["state"] == "DEFERRED" for task in tasks), "masteryStatus": session["mastery_status"], "rewardPoints": session["reward_points"]})
        due = db.execute("SELECT skill_domain,COUNT(*) n FROM srs_review_states WHERE child_id=? AND due_at<=? GROUP BY skill_domain", (child_id, end)).fetchall()
        due_counts = {row["skill_domain"]: row["n"] for row in due}
        return {"childId": child_id, "from": start, "to": end, "sessions": summaries, "taskCounts": task_counts, "weakDomains": weak, "deferredTasks": deferred, "masteryChanges": [{"sessionId": session["id"], "status": session["mastery_status"]} for session in sessions if session["mastery_status"]], "reviewDueCounts": due_counts, "privacy": {"rawAudioStored": False, "learnerAnswersStored": False, "identifyingTelemetry": False}}
