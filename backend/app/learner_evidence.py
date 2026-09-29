"""Versioned, child-scoped evidence facts; aggregates are not mastery judgments."""

from __future__ import annotations

import hashlib
import json
import unicodedata
from collections import defaultdict
from typing import Any

from .database import connect, initialize_database
from .learning import ensure_child, now, uid
from .placement import get_placement_profile

DIMENSIONS = {
    "HEAR", "RECALL", "READ", "INPUT", "HANDWRITING", "SPEAK",
    "ORTHOGRAPHIC_RECOGNITION", "PHONETIC_NOTATION", "PRONUNCIATION",
}
SCRIPTS = {"TRADITIONAL", "SIMPLIFIED", "SCRIPT_INDEPENDENT"}
TARGET_KINDS = {"LEXICAL_CONCEPT", "ORTHOGRAPHIC_FORM", "PHRASE", "PRONUNCIATION", "CHARACTER"}
OUTCOMES = {"CORRECT", "INCORRECT", "PARTIAL", "NOT_ASSESSED"}
ASSISTANCE = {"INDEPENDENT", "ASSISTED", "UNKNOWN"}
CUES = {"IMAGE", "CONCEPT", "NATIVE_LANGUAGE", "CONTEXT_CLOZE", "AUDIO", "CHINESE_TEXT", "NONE"}
INPUT_METHODS = {"ZHUYIN", "PINYIN", "VOICE", "OTHER_KEYBOARD", "NONE"}
TIMINGS = {"IMMEDIATE", "DELAYED", "UNKNOWN"}
ORTHOGRAPHIC_DIMENSIONS = ("ORTHOGRAPHIC_RECOGNITION", "READ", "INPUT", "HANDWRITING")
FORM_IDENTITY_DIMENSIONS = frozenset((*ORTHOGRAPHIC_DIMENSIONS, "PHONETIC_NOTATION"))
PLACEMENT_V2_DOMAINS = (
    "listening", "speaking", "traditional_recognition", "simplified_recognition",
    "traditional_writing", "simplified_writing",
)
PLACEMENT_LEVELS = {"NOT_ASSESSED", "STARTER", "BASIC", "BOOK_1"}
HANDWRITING_EXPECTATIONS = {"WRITE_CORE", "WRITE_FAMILIAR", "READ_INPUT", "EXPOSURE_ONLY"}
ORTHOGRAPHIC_SCRIPTS = {"TRADITIONAL", "SIMPLIFIED"}
ORTHOGRAPHIC_INPUT_METHODS = {"ZHUYIN", "PINYIN", "OTHER_KEYBOARD"}
PHONETIC_INPUT_METHODS = {"ZHUYIN", "PINYIN"}


def normalize_orthographic_form(form: str) -> str:
    """Apply Unicode canonical composition only; preserve all visible spacing and punctuation."""
    if not isinstance(form, str) or not form:
        raise ValueError("invalid_orthographic_form")
    return unicodedata.normalize("NFC", form)


def orthographic_form_target_id(script: str, form: str) -> str:
    """Return stable exact-form identity, without cross-script or lexical inference."""
    if script not in ORTHOGRAPHIC_SCRIPTS:
        raise ValueError("orthographic_form_requires_traditional_or_simplified_script")
    normalized = normalize_orthographic_form(form)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return f"orthographic-form:{script.lower()}:{digest}"


def validate_handwriting_expectation(value: str | None) -> str | None:
    """Validate an explicit target-authority label; None means unspecified."""
    if value is not None and value not in HANDWRITING_EXPECTATIONS:
        raise ValueError("invalid_handwriting_expectation")
    return value


def register_target_in_transaction(
    db: Any, *, child_id: int, target_id: str, target_kind: str,
    script: str, display_form: str | None = None, concept_id: str | None = None,
    handwriting_expectation: str | None = None,
) -> None:
    if not target_id or target_kind not in TARGET_KINDS or script not in SCRIPTS:
        raise ValueError("invalid_learner_evidence_target")
    validate_handwriting_expectation(handwriting_expectation)
    row = db.execute(
        "SELECT target_kind,concept_id,script,display_form,handwriting_expectation FROM learner_evidence_targets WHERE child_id=? AND target_id=?",
        (child_id, target_id),
    ).fetchone()
    if row:
        if row["target_kind"] != target_kind or row["script"] != script:
            raise ValueError("learner_evidence_target_identity_conflict")
        if concept_id and row["concept_id"] and row["concept_id"] != concept_id:
            raise ValueError("learner_evidence_target_identity_conflict")
        if display_form and row["display_form"] and row["display_form"] != display_form:
            raise ValueError("learner_evidence_target_identity_conflict")
        if handwriting_expectation and row["handwriting_expectation"] and row["handwriting_expectation"] != handwriting_expectation:
            raise ValueError("learner_evidence_target_identity_conflict")
        if (concept_id and not row["concept_id"]) or (display_form and not row["display_form"]) or (handwriting_expectation and not row["handwriting_expectation"]):
            db.execute(
                "UPDATE learner_evidence_targets SET concept_id=COALESCE(concept_id,?),display_form=COALESCE(display_form,?),handwriting_expectation=COALESCE(handwriting_expectation,?) WHERE child_id=? AND target_id=?",
                (concept_id, display_form, handwriting_expectation, child_id, target_id),
            )
        return
    db.execute(
        "INSERT INTO learner_evidence_targets(child_id,target_id,target_kind,concept_id,script,display_form,handwriting_expectation,created_at) VALUES(?,?,?,?,?,?,?,?)",
        (child_id, target_id, target_kind, concept_id, script, display_form, handwriting_expectation, now()),
    )


def record_evidence_in_transaction(
    db: Any, *, child_id: int, target_id: str, target_kind: str, target_script: str,
    dimension: str, script: str, outcome: str, assistance: str, source_type: str,
    source_ref: str, occurred_at: str, display_form: str | None = None,
    handwriting_expectation: str | None = None,
    concept_id: str | None = None, score: float | None = None, scorer: str | None = None,
    scorer_version: str | None = None, cue_type: str = "NONE", answer_exposed: bool = False,
    input_method: str = "NONE", retrieval_timing: str = "UNKNOWN",
    prior_exposure_at: str | None = None, review_due_at: str | None = None,
    source_task_id: str | None = None, source_session_id: str | None = None,
    source_lesson_id: str | None = None,
) -> dict[str, Any]:
    """Append one server-derived fact inside the provider's transaction."""
    if dimension not in DIMENSIONS or script not in SCRIPTS or target_script not in SCRIPTS:
        raise ValueError("invalid_learner_evidence_dimension_or_script")
    if outcome not in OUTCOMES or assistance not in ASSISTANCE:
        raise ValueError("invalid_learner_evidence_outcome")
    if cue_type not in CUES or input_method not in INPUT_METHODS or retrieval_timing not in TIMINGS:
        raise ValueError("invalid_learner_evidence_context")
    if not source_type or not source_ref or not occurred_at:
        raise ValueError("invalid_learner_evidence_source")
    if score is not None and (not isinstance(score, (int, float)) or not 0 <= score <= 1):
        raise ValueError("invalid_learner_evidence_score")
    if outcome == "NOT_ASSESSED" and score is not None:
        raise ValueError("unassessed_evidence_cannot_have_score")
    if retrieval_timing == "DELAYED" and not prior_exposure_at:
        raise ValueError("delayed_evidence_requires_prior_exposure")
    if dimension == "RECALL" and (cue_type == "CHINESE_TEXT" or answer_exposed):
        raise ValueError("active_recall_answer_exposed")
    if dimension in {"ORTHOGRAPHIC_RECOGNITION", "READ", "INPUT", "HANDWRITING"} and script == "SCRIPT_INDEPENDENT":
        raise ValueError("orthographic_evidence_requires_script")
    if dimension == "INPUT" and input_method not in {"ZHUYIN", "PINYIN", "OTHER_KEYBOARD"}:
        raise ValueError("input_evidence_requires_input_method")
    if dimension == "PHONETIC_NOTATION" and (
        input_method not in PHONETIC_INPUT_METHODS or script not in ORTHOGRAPHIC_SCRIPTS
    ):
        raise ValueError("phonetic_notation_requires_script_and_notation_method")
    if dimension == "PRONUNCIATION" and input_method != "VOICE":
        raise ValueError("pronunciation_evidence_requires_voice_method")
    if dimension in {"ORTHOGRAPHIC_RECOGNITION", "READ", "HANDWRITING"} and input_method != "NONE":
        raise ValueError("orthographic_dimension_does_not_accept_input_method")
    if outcome != "NOT_ASSESSED" and (not scorer or not scorer_version):
        raise ValueError("scored_evidence_requires_scorer_version")
    if target_script != "SCRIPT_INDEPENDENT" and script != target_script:
        raise ValueError("learner_evidence_target_script_mismatch")
    if target_kind == "ORTHOGRAPHIC_FORM" and dimension in FORM_IDENTITY_DIMENSIONS and display_form is not None:
        display_form = normalize_orthographic_form(display_form)
        if target_id != orthographic_form_target_id(target_script, display_form):
            raise ValueError("orthographic_form_target_id_mismatch")

    ensure_child(db, child_id)
    register_target_in_transaction(
        db, child_id=child_id, target_id=target_id, target_kind=target_kind,
        script=target_script, display_form=display_form, concept_id=concept_id,
        handwriting_expectation=handwriting_expectation,
    )
    duplicate = db.execute(
        """SELECT id FROM learner_evidence_events WHERE child_id=? AND source_type=? AND source_ref=?
           AND target_id=? AND dimension=? AND script=? AND input_method=?""",
        (child_id, source_type, source_ref, target_id, dimension, script, input_method),
    ).fetchone()
    if duplicate:
        rebuild_target_profile_in_transaction(db, child_id=child_id, target_id=target_id)
        return {"id": duplicate["id"], "inserted": False}

    event_id = uid("learner-evidence")
    created_at = now()
    db.execute(
        """INSERT INTO learner_evidence_events(
            id,child_id,target_id,dimension,script,outcome,assistance,score,scorer,scorer_version,
            cue_type,answer_exposed,input_method,retrieval_timing,prior_exposure_at,review_due_at,
            source_type,source_ref,source_task_id,source_session_id,source_lesson_id,occurred_at,
            created_at,evidence_schema_version
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)""",
        (event_id, child_id, target_id, dimension, script, outcome, assistance, score, scorer,
         scorer_version, cue_type, int(answer_exposed), input_method, retrieval_timing,
         prior_exposure_at, review_due_at, source_type, source_ref, source_task_id,
         source_session_id, source_lesson_id, occurred_at, created_at),
    )
    rebuild_target_profile_in_transaction(db, child_id=child_id, target_id=target_id)
    return {"id": event_id, "inserted": True}


def _aggregate_events(rows: list[Any], rebuilt_at: str) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str, str, str], list[Any]] = defaultdict(list)
    for row in rows:
        groups[(row["target_id"], row["dimension"], row["script"], row["input_method"])].append(row)
    result = []
    for (target_id, dimension, script, input_method), events in sorted(groups.items()):
        # Stable tie-breaker makes a rebuild independent of retrieval order.
        ordered = sorted(events, key=lambda item: (item["occurred_at"], item["id"]))
        assessed = [item for item in ordered if item["outcome"] != "NOT_ASSESSED"]
        latest = ordered[-1]
        result.append({
            "target_id": target_id, "dimension": dimension, "script": script,
            "input_method": input_method, "state": "OBSERVED" if assessed else "NOT_ASSESSED",
            "latest_evidence_at": latest["occurred_at"], "latest_outcome": latest["outcome"],
            "evidence_count": len(ordered),
            "independent_correct_count": sum(item["outcome"] == "CORRECT" and item["assistance"] == "INDEPENDENT" for item in ordered),
            "assisted_count": sum(item["assistance"] == "ASSISTED" for item in ordered),
            "incorrect_count": sum(item["outcome"] == "INCORRECT" for item in ordered),
            "partial_count": sum(item["outcome"] == "PARTIAL" for item in ordered),
            "not_assessed_count": sum(item["outcome"] == "NOT_ASSESSED" for item in ordered),
            "aggregation_version": 1, "rebuilt_at": rebuilt_at,
        })
    return result


def rebuild_target_profile_in_transaction(db: Any, *, child_id: int, target_id: str) -> None:
    rows = db.execute(
        "SELECT * FROM learner_evidence_events WHERE child_id=? AND target_id=? ORDER BY occurred_at,id",
        (child_id, target_id),
    ).fetchall()
    db.execute("DELETE FROM learner_evidence_profiles WHERE child_id=? AND target_id=?", (child_id, target_id))
    stamp = now()
    for row in _aggregate_events(rows, stamp):
        db.execute(
            """INSERT INTO learner_evidence_profiles(
                child_id,target_id,dimension,script,input_method,state,latest_evidence_at,latest_outcome,
                evidence_count,independent_correct_count,assisted_count,incorrect_count,partial_count,
                not_assessed_count,aggregation_version,rebuilt_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (child_id, row["target_id"], row["dimension"], row["script"], row["input_method"], row["state"],
             row["latest_evidence_at"], row["latest_outcome"], row["evidence_count"],
             row["independent_correct_count"], row["assisted_count"], row["incorrect_count"],
             row["partial_count"], row["not_assessed_count"], row["aggregation_version"], row["rebuilt_at"]),
        )


def rebuild_child_profile(*, child_id: int) -> None:
    """Rebuild all facts for diagnostics/deploy recovery; no mastery thresholds."""
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        target_ids = [row[0] for row in db.execute("SELECT target_id FROM learner_evidence_targets WHERE child_id=? ORDER BY target_id", (child_id,))]
        for target_id in target_ids:
            rebuild_target_profile_in_transaction(db, child_id=child_id, target_id=target_id)


def _profile_payload(row: Any) -> dict[str, Any]:
    return {
        "state": row["state"], "latestEvidenceAt": row["latest_evidence_at"],
        "latestOutcome": row["latest_outcome"], "evidenceCount": row["evidence_count"],
        "independentCorrectCount": row["independent_correct_count"],
        "assistedCount": row["assisted_count"], "incorrectCount": row["incorrect_count"],
        "partialCount": row["partial_count"], "notAssessedCount": row["not_assessed_count"],
        "aggregationVersion": row["aggregation_version"],
    }


def get_evidence_summary(*, child_id: int) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        rows = db.execute(
            """SELECT dimension,script,state,COUNT(DISTINCT target_id) AS target_count,SUM(evidence_count) AS evidence_count,
                      SUM(independent_correct_count) AS independent_correct_count,SUM(assisted_count) AS assisted_count,
                      SUM(incorrect_count) AS incorrect_count,SUM(partial_count) AS partial_count,
                      SUM(not_assessed_count) AS not_assessed_count
               FROM learner_evidence_profiles WHERE child_id=? GROUP BY dimension,script,state
               ORDER BY dimension,script,state""", (child_id,),
        ).fetchall()
        facts = db.execute(
            """SELECT COUNT(*) AS total,
                      COALESCE(SUM(CASE WHEN dimension='RECALL' THEN 1 ELSE 0 END),0) AS active_recall,
                      COALESCE(SUM(CASE WHEN dimension='RECALL' AND retrieval_timing='DELAYED' AND outcome='CORRECT' THEN 1 ELSE 0 END),0) AS delayed_correct,
                      COALESCE(SUM(CASE WHEN dimension='RECALL' AND retrieval_timing='DELAYED' AND outcome='CORRECT' AND assistance='INDEPENDENT' THEN 1 ELSE 0 END),0) AS delayed_independent_correct,
                      COALESCE(SUM(CASE WHEN outcome IN ('INCORRECT','PARTIAL') THEN 1 ELSE 0 END),0) AS incorrect_or_partial
               FROM learner_evidence_events WHERE child_id=?""", (child_id,),
        ).fetchone()
        return {"childId": child_id, "modelVersion": 1, "isMasteryJudgment": False,
                "dimensions": [{"dimension": row["dimension"], "script": row["script"],
                                "state": row["state"], "targetCount": row["target_count"],
                                "evidenceCount": row["evidence_count"],
                                "independentCorrectCount": row["independent_correct_count"],
                                "assistedCount": row["assisted_count"], "incorrectCount": row["incorrect_count"],
                                "partialCount": row["partial_count"], "notAssessedCount": row["not_assessed_count"]} for row in rows],
                "eventFacts": {"totalEvidenceCount": facts["total"],
                               "activeRecallObservationCount": facts["active_recall"],
                               "delayedCorrectRetrievalCount": facts["delayed_correct"],
                               "delayedIndependentCorrectRetrievalCount": facts["delayed_independent_correct"],
                               "incorrectOrPartialCount": facts["incorrect_or_partial"]}}


def get_target_evidence(*, child_id: int, target_id: str) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        target = db.execute("SELECT * FROM learner_evidence_targets WHERE child_id=? AND target_id=?", (child_id, target_id)).fetchone()
        if target is None:
            raise ValueError("learner_evidence_target_not_found")
        events = db.execute(
            """SELECT id,dimension,script,outcome,assistance,score,scorer,scorer_version,cue_type,
               answer_exposed,input_method,retrieval_timing,prior_exposure_at,review_due_at,
               source_type,source_ref,source_task_id,source_session_id,source_lesson_id,occurred_at,
               evidence_schema_version FROM learner_evidence_events
               WHERE child_id=? AND target_id=? ORDER BY occurred_at,id""", (child_id, target_id),
        ).fetchall()
        profiles = db.execute("SELECT * FROM learner_evidence_profiles WHERE child_id=? AND target_id=? ORDER BY dimension,script,input_method", (child_id, target_id)).fetchall()
        return {
            "childId": child_id,
            "target": {"id": target["target_id"], "kind": target["target_kind"], "conceptId": target["concept_id"], "script": target["script"], "displayForm": target["display_form"], "handwritingExpectation": target["handwriting_expectation"]},
            "profile": [{"dimension": row["dimension"], "script": row["script"], "inputMethod": row["input_method"], **_profile_payload(row)} for row in profiles],
            "events": [{"id": row["id"], "dimension": row["dimension"], "script": row["script"],
                        "outcome": row["outcome"], "assistance": row["assistance"], "score": row["score"],
                        "scorer": row["scorer"], "scorerVersion": row["scorer_version"], "cueType": row["cue_type"],
                        "answerExposed": bool(row["answer_exposed"]), "inputMethod": row["input_method"],
                        "retrievalTiming": row["retrieval_timing"], "priorExposureAt": row["prior_exposure_at"],
                        "reviewDueAt": row["review_due_at"], "source": {"type": row["source_type"], "ref": row["source_ref"],
                        "taskId": row["source_task_id"], "sessionId": row["source_session_id"], "lessonId": row["source_lesson_id"]},
                        "occurredAt": row["occurred_at"], "evidenceSchemaVersion": row["evidence_schema_version"]} for row in events],
            "isMasteryJudgment": False,
        }


def get_orthographic_profile(*, child_id: int) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        targets = db.execute(
            """SELECT DISTINCT t.target_id,t.target_kind,t.concept_id,t.script,t.display_form,t.handwriting_expectation
               FROM learner_evidence_targets t JOIN learner_evidence_profiles p
                 ON p.child_id=t.child_id AND p.target_id=t.target_id
               WHERE t.child_id=? AND p.dimension IN ('ORTHOGRAPHIC_RECOGNITION','READ','INPUT','HANDWRITING')
               ORDER BY t.target_id""", (child_id,),
        ).fetchall()
        states = db.execute(
            """SELECT target_id,dimension,script,input_method,state,latest_evidence_at,latest_outcome,
               evidence_count,independent_correct_count,assisted_count,incorrect_count,partial_count,
               not_assessed_count,aggregation_version FROM learner_evidence_profiles
               WHERE child_id=? AND dimension IN ('ORTHOGRAPHIC_RECOGNITION','READ','INPUT','HANDWRITING')
               ORDER BY target_id,dimension,script,input_method""", (child_id,),
        ).fetchall()
        by_key = {
            (row["target_id"], row["dimension"], row["script"], row["input_method"]): _profile_payload(row)
            for row in states
        }
        dimensions = {
            "recognition": "ORTHOGRAPHIC_RECOGNITION", "reading": "READ",
            "handwriting": "HANDWRITING",
        }
        result = []
        for target in targets:
            scripts = {}
            for script in ("TRADITIONAL", "SIMPLIFIED"):
                script_facts = {name: by_key.get((target["target_id"], dim, script, "NONE"), {
                    "state": "NOT_ASSESSED", "latestEvidenceAt": None, "latestOutcome": None,
                    "evidenceCount": 0, "independentCorrectCount": 0, "assistedCount": 0,
                    "incorrectCount": 0, "partialCount": 0, "notAssessedCount": 0,
                    "aggregationVersion": 1,
                }) for name, dim in dimensions.items()}
                script_facts["inputByMethod"] = {
                    row["input_method"]: _profile_payload(row)
                    for row in states
                    if row["target_id"] == target["target_id"]
                    and row["dimension"] == "INPUT"
                    and row["script"] == script
                }
                scripts[script.lower()] = script_facts
            result.append({"target": {"id": target["target_id"], "kind": target["target_kind"],
                                      "conceptId": target["concept_id"], "script": target["script"],
                                      "displayForm": target["display_form"],
                                      "handwritingExpectation": target["handwriting_expectation"]}, **scripts})
        return {"childId": child_id, "profileVersion": 1, "items": result, "isMasteryJudgment": False}


def get_placement_profile_v2(*, child_id: int) -> dict[str, Any]:
    legacy = get_placement_profile(child_id)
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        row = db.execute("SELECT * FROM placement_profiles_v2 WHERE child_id=?", (child_id,)).fetchone()
        if row:
            domains = json.loads(row["domains_json"])
            method, assessed_by, updated_at = row["assessment_method"], row["assessed_by"], row["updated_at"]
        else:
            domains = {domain: "NOT_ASSESSED" for domain in PLACEMENT_V2_DOMAINS}
            method, assessed_by, updated_at = "NOT_ASSESSED", None, None
        return {"profileVersion": 2, "childId": child_id,
                "legacyAggregate": {"profileVersion": legacy["profileVersion"],
                                    "mainCurriculumStart": legacy["mainCurriculumStart"],
                                    "domains": legacy["domains"]},
                "domains": {domain: {"level": domains[domain]} for domain in PLACEMENT_V2_DOMAINS},
                "assessmentMethod": method, "assessedBy": assessed_by, "updatedAt": updated_at,
                "orthographicEvidence": get_orthographic_profile(child_id=child_id)}


def save_placement_profile_v2(*, child_id: int, domain_levels: dict[str, str], assessment_method: str, assessed_by: str) -> dict[str, Any]:
    if not isinstance(domain_levels, dict) or set(domain_levels) - set(PLACEMENT_V2_DOMAINS):
        raise ValueError("invalid_placement_v2_domain")
    if not domain_levels:
        raise ValueError("no_placement_v2_domains_supplied")
    if any(level not in PLACEMENT_LEVELS for level in domain_levels.values()):
        raise ValueError("invalid_placement_level")
    if assessment_method not in {"PARENT_OBSERVATION", "DIAGNOSTIC"}:
        raise ValueError("invalid_assessment_method")
    stamp = now()
    initialize_database()
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        ensure_child(db, child_id)
        existing = db.execute("SELECT domains_json FROM placement_profiles_v2 WHERE child_id=?", (child_id,)).fetchone()
        domains = (
            {domain: "NOT_ASSESSED" for domain in PLACEMENT_V2_DOMAINS}
            if existing is None else json.loads(existing["domains_json"])
        )
        domains.update(domain_levels)
        db.execute(
            """INSERT INTO placement_profiles_v2(child_id,profile_version,domains_json,assessment_method,assessed_by,updated_at)
               VALUES(?,2,?,?,?,?) ON CONFLICT(child_id) DO UPDATE SET domains_json=excluded.domains_json,
               assessment_method=excluded.assessment_method,assessed_by=excluded.assessed_by,updated_at=excluded.updated_at""",
            (child_id, json.dumps(domains, sort_keys=True), assessment_method, assessed_by, stamp),
        )
    return get_placement_profile_v2(child_id=child_id)
