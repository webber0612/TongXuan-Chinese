"""Lesson package loaders and validators for TongXuan Learning Path v2."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

PACKAGES_DIR = Path(__file__).resolve().parents[2] / "shared" / "lesson-packages"


@lru_cache(maxsize=16)
def get_lesson_package(lesson_id: str) -> dict[str, Any] | None:
    path = PACKAGES_DIR / f"{lesson_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def list_lesson_packages() -> list[dict[str, Any]]:
    packages: list[dict[str, Any]] = []
    if not PACKAGES_DIR.exists():
        return packages
    for file_path in sorted(PACKAGES_DIR.glob("*.json")):
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            packages.append(data)
        except Exception:
            continue
    return packages


def validate_package_review_status(pkg: dict[str, Any]) -> tuple[bool, list[str]]:
    """Verify that unreviewed generated content is not marked APPROVED and provenance is valid."""
    errors: list[str] = []
    valid_statuses = {"GENERATED_DRAFT", "REVIEWED", "APPROVED", "REJECTED"}

    # Check curriculum source provenance
    source_prov = pkg.get("curriculumSource", {}).get("provenanceStatus")
    if source_prov != "VERIFIED_OFFICIAL_TITLE":
        errors.append(f"Curriculum source provenance status must be VERIFIED_OFFICIAL_TITLE, got {source_prov}")

    # Check authorship provenance
    authorship = pkg.get("provenance", {}).get("authorship")
    if authorship != "TONGXUAN_PEDAGOGY_WRAPPER":
        errors.append(f"Provenance authorship must be TONGXUAN_PEDAGOGY_WRAPPER, got {authorship}")

    # Check native language scaffold
    scaffold = pkg.get("nativeLanguageSupport", {}).get("entries", {})
    for key, entry in scaffold.items():
        status = entry.get("reviewStatus")
        if status not in valid_statuses:
            errors.append(f"Scaffold entry '{key}' has invalid review status: {status}")
        if status == "GENERATED_DRAFT" and entry.get("approved") is True:
            errors.append(f"Scaffold entry '{key}' is GENERATED_DRAFT but flagged as approved.")

    # Check vocabulary
    for vocab in pkg.get("vocabulary", []):
        status = vocab.get("reviewStatus")
        if status not in valid_statuses:
            errors.append(f"Vocab item '{vocab.get('id')}' has invalid review status: {status}")
        if status == "GENERATED_DRAFT" and vocab.get("approved") is True:
            errors.append(f"Vocab item '{vocab.get('id')}' is GENERATED_DRAFT but flagged as approved.")

    # Check sentence patterns
    for pattern in pkg.get("sentencePatterns", []):
        status = pattern.get("reviewStatus")
        if status not in valid_statuses:
            errors.append(f"Sentence pattern '{pattern.get('id')}' has invalid review status: {status}")
        if status == "GENERATED_DRAFT" and pattern.get("approved") is True:
            errors.append(f"Sentence pattern '{pattern.get('id')}' is GENERATED_DRAFT but flagged as approved.")

    # Check cultural notes
    for note in pkg.get("culturalNotes", []):
        status = note.get("reviewStatus")
        if status not in valid_statuses:
            errors.append(f"Cultural note '{note.get('id')}' has invalid review status: {status}")
        if status == "GENERATED_DRAFT" and note.get("approved") is True:
            errors.append(f"Cultural note '{note.get('id')}' is GENERATED_DRAFT but flagged as approved.")

    return len(errors) == 0, errors

