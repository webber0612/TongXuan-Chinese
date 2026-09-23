"""Phase 17 retrieval-first tutor boundary.

This module deliberately has no model SDK, network client, telemetry, media input,
or learning-state write. A future local LLM/NAS provider can implement the same
adapter protocol without entering the learning domain.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Protocol

from .database import connect
from .learning import ensure_child

MODES = {"explain", "story", "reading-guide", "sentence-hint"}
SOURCE_TYPES = {"CURRICULUM_ITEM", "SCHOOL_QUEUE"}
LOCALES = {"zh-TW", "zh-CN"}
SCRIPTS = {"TRADITIONAL", "SIMPLIFIED"}


class TutorProvider(Protocol):
    provider_id: str

    def respond(self, *, mode: str, prompt: str, source: dict[str, Any]) -> str:
        """Return grounded instructional text only."""


class DeterministicTutorAdapter:
    """Safe local fallback; replaceable by a future local LLM/NAS adapter."""

    provider_id = "deterministic-local-tutor"

    def respond(self, *, mode: str, prompt: str, source: dict[str, Any]) -> str:
        del prompt
        content = source["content"]
        if mode == "explain":
            return f"Focus on the meaning and usage of「{content}」. Use the source context and make your own answer."
        if mode == "story":
            return f"Create a short story using「{content}」; the retrieved source is your only reference."
        if mode == "reading-guide":
            return f"Read「{content}」in small phrases, notice punctuation, and reread for meaning."
        return f"For「{content}」, identify the sentence subject and action first; choose your own wording."


def get_tutor_provider() -> TutorProvider:
    return DeterministicTutorAdapter()


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("invalid_as_of") from error
    return parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed


def _retrieve(*, child_id: int, source_type: str, source_id: str, as_of: str | None) -> dict[str, Any]:
    cutoff = _parse(as_of) or datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff_text = cutoff.strftime("%Y-%m-%d %H:%M:%S")
    with connect() as db:
        ensure_child(db, child_id)
        if source_type == "CURRICULUM_ITEM":
            row = db.execute(
                """SELECT i.*, u.title AS unit_title, l.title AS level_title
                   FROM curriculum_items i
                   JOIN curriculum_units u ON u.id=i.unit_id
                   JOIN curriculum_levels l ON l.id=u.level_id
                   WHERE i.id=? AND i.created_at<=? AND u.created_at<=? AND l.created_at<=?""",
                (source_id, cutoff_text, cutoff_text, cutoff_text),
            ).fetchone()
            if row is None:
                raise ValueError("tutor_source_not_found")
            return {
                "source_type": source_type, "source_id": row["id"], "content": row["content"],
                "item_type": row["item_type"], "level_title": row["level_title"], "unit_title": row["unit_title"],
                "source_name": row["source_name"], "source_url": row["source_url"], "license_name": row["license_name"],
                "provenance_status": row["provenance_status"], "commercial_ready": bool(row["commercial_ready"]),
            }
        row = db.execute("SELECT * FROM school_queue_items WHERE id=? AND child_id=? AND created_at<=?", (source_id, child_id, cutoff_text)).fetchone()
        if row is None:
            raise ValueError("tutor_source_not_found")
        return {
            "source_type": "SCHOOL_QUEUE", "source_id": row["id"], "content": row["character"],
            "item_type": "character", "source_name": row["school_source"], "source_url": "",
            "license_name": "PRIVATE_FAMILY_SOURCE", "provenance_status": row["provenance_status"],
            "commercial_ready": False, "private_content": bool(row["private_content"]),
        }


def tutor_response(*, child_id: int, mode: str, prompt: str, source_type: str, source_id: str, locale: str | None, script: str | None, as_of: str | None) -> dict[str, Any]:
    if mode not in MODES:
        raise ValueError("unsupported_tutor_mode")
    if source_type is None or source_id is None:
        with connect() as db:
            ensure_child(db, child_id)
        return {
            "mode": mode, "child_id": child_id, "provider_id": "deterministic-local-tutor",
            "response": "I need an authoritative curriculum or School Queue source before I can help.",
            "source": None,
            "safety": {"decides_correctness": False, "provides_answer_key": False, "scores": False, "mutates_mastery": False, "changes_adaptive_ranking": False, "exports_cloud": False},
        }
    if source_type not in SOURCE_TYPES:
        raise ValueError("unsupported_tutor_source")
    if not prompt.strip():
        raise ValueError("tutor_prompt_required")
    if locale is not None and locale not in LOCALES:
        raise ValueError("unsupported_locale")
    if script is not None and script not in SCRIPTS:
        raise ValueError("unsupported_script")
    if locale == "zh-TW" and script == "SIMPLIFIED" or locale == "zh-CN" and script == "TRADITIONAL":
        raise ValueError("locale_script_mismatch")
    source = _retrieve(child_id=child_id, source_type=source_type, source_id=source_id, as_of=as_of)
    provider = get_tutor_provider()
    response = provider.respond(mode=mode, prompt=prompt, source=source)
    return {
        "mode": mode, "child_id": child_id, "provider_id": provider.provider_id,
        "response": response, "source": {**source, "locale": locale, "script": script},
        "safety": {"decides_correctness": False, "provides_answer_key": False, "scores": False, "mutates_mastery": False, "changes_adaptive_ranking": False, "exports_cloud": False},
    }
