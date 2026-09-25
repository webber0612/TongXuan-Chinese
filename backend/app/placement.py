"""Versioned, deterministic placement profile contract for the validated slice."""

from __future__ import annotations

import json
from typing import Any

from .database import connect, initialize_database
from .learning import ensure_child, now

PROFILE_VERSION = 1
PLACEMENT_DOMAINS = (
    "listening", "speaking", "pronunciation", "recognition", "writing", "reading",
    "zhuyin", "pinyin", "vocabulary", "grammar",
)
PLACEMENT_LEVELS = ("NOT_ASSESSED", "STARTER", "BASIC", "BOOK_1")
CORE_PLACEMENT_DOMAINS = ("recognition", "reading", "vocabulary", "grammar")
LEVEL_RANK = {"STARTER": 0, "BASIC": 1, "BOOK_1": 2}


def derive_main_curriculum_start(domain_levels: dict[str, str]) -> str:
    """Use the lowest assessed core domain; never use age or specialist domains."""
    assessed = [domain_levels[domain] for domain in CORE_PLACEMENT_DOMAINS if domain_levels.get(domain) in LEVEL_RANK]
    if not assessed:
        return "STARTER"
    return min(assessed, key=LEVEL_RANK.__getitem__)


def _profile_payload(child_id: int, domain_levels: dict[str, str], assessment_method: str, updated_at: str | None, age_hint_years: int | None = None) -> dict[str, Any]:
    return {
        "profileVersion": PROFILE_VERSION,
        "childId": child_id,
        "domains": {domain: {"level": domain_levels[domain]} for domain in PLACEMENT_DOMAINS},
        "mainCurriculumStart": derive_main_curriculum_start(domain_levels),
        "assessmentMethod": assessment_method,
        "ageHintYears": age_hint_years,
        "placementContract": {
            "mainStartRule": "LOWEST_ASSESSED_CORE_DOMAIN",
            "coreDomains": list(CORE_PLACEMENT_DOMAINS),
            "ageUsedForPlacement": False,
        },
        "updatedAt": updated_at,
    }


def get_placement_profile(child_id: int) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        row = db.execute("SELECT * FROM placement_profiles WHERE child_id=?", (child_id,)).fetchone()
        if row is None:
            levels = {domain: "NOT_ASSESSED" for domain in PLACEMENT_DOMAINS}
            return _profile_payload(child_id, levels, "NOT_ASSESSED", None)
        levels = json.loads(row["domains_json"])
        return _profile_payload(child_id, levels, row["assessment_method"], row["updated_at"], row["age_hint_years"])


def save_placement_profile(*, child_id: int, domain_levels: dict[str, str], assessment_method: str, assessed_by: str, age_hint_years: int | None = None) -> dict[str, Any]:
    if assessment_method not in {"PARENT_OBSERVATION", "DIAGNOSTIC"}:
        raise ValueError("invalid_assessment_method")
    if not isinstance(domain_levels, dict) or set(domain_levels) - set(PLACEMENT_DOMAINS):
        raise ValueError("invalid_placement_domain")
    if any(level not in PLACEMENT_LEVELS for level in domain_levels.values()):
        raise ValueError("invalid_placement_level")
    levels = {domain: domain_levels.get(domain, "NOT_ASSESSED") for domain in PLACEMENT_DOMAINS}
    main_start = derive_main_curriculum_start(levels)
    stamp = now()
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        db.execute(
            """INSERT INTO placement_profiles(child_id,profile_version,main_curriculum_start,domains_json,age_hint_years,assessment_method,assessed_by,updated_at)
               VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(child_id) DO UPDATE SET
               profile_version=excluded.profile_version,main_curriculum_start=excluded.main_curriculum_start,
               domains_json=excluded.domains_json,age_hint_years=excluded.age_hint_years,assessment_method=excluded.assessment_method,
               assessed_by=excluded.assessed_by,updated_at=excluded.updated_at""",
            (child_id, PROFILE_VERSION, main_start, json.dumps(levels, sort_keys=True), age_hint_years, assessment_method, assessed_by, stamp),
        )
    return _profile_payload(child_id, levels, assessment_method, stamp, age_hint_years)
