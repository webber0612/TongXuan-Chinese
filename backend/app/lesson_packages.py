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
    """Verify that unreviewed generated content is not marked APPROVED."""
    errors: list[str] = []

    # Check native language scaffold
    scaffold = pkg.get("nativeLanguageSupport", {}).get("entries", {})
    for key, entry in scaffold.items():
        status = entry.get("reviewStatus")
        if status == "GENERATED_DRAFT" and entry.get("approved") is True:
            errors.append(f"Scaffold entry '{key}' is GENERATED_DRAFT but flagged as approved.")

    # Check vocabulary
    for vocab in pkg.get("vocabulary", []):
        status = vocab.get("reviewStatus")
        if status == "GENERATED_DRAFT" and vocab.get("approved") is True:
            errors.append(f"Vocab item '{vocab.get('id')}' is GENERATED_DRAFT but flagged as approved.")

    # Check sentence patterns
    for pattern in pkg.get("sentencePatterns", []):
        status = pattern.get("reviewStatus")
        if status == "GENERATED_DRAFT" and pattern.get("approved") is True:
            errors.append(f"Sentence pattern '{pattern.get('id')}' is GENERATED_DRAFT but flagged as approved.")

    return len(errors) == 0, errors
