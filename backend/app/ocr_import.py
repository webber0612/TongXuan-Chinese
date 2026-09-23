"""Phase 13 OCR Import boundary.

OCR is a candidate-capture workflow. The backend persists only auditable import
metadata and confirmed text; image bytes never cross this boundary.
"""

import json
import sqlite3
from typing import Any, Protocol

from .database import connect, initialize_database
from .learning import ensure_child, now, uid
from .tts import _source_locale

SUPPORTED_LOCALES = {"zh-TW", "zh-CN"}
SUPPORTED_SCRIPTS = {"TRADITIONAL", "SIMPLIFIED"}


class OCRProvider(Protocol):
    provider_id: str

    def extract(self, image_name: str, candidate_hint: str) -> str:
        """Return candidate text without receiving image bytes."""


class DeterministicLocalOCRProvider:
    provider_id = "local-deterministic-ocr"

    def extract(self, image_name: str, candidate_hint: str) -> str:
        del image_name
        return candidate_hint.strip()


PROVIDERS: dict[str, OCRProvider] = {"local-deterministic-ocr": DeterministicLocalOCRProvider()}


def _metadata(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    result["private_content"] = bool(result["private_content"])
    result["commercial_ready"] = bool(result["commercial_ready"])
    result["provenance"] = json.loads(result.pop("provenance_json")) if result.get("provenance_json") else None
    return result


def create_candidate(*, child_id: int, image_name: str, source_label: str, provider_id: str, candidate_hint: str) -> dict[str, Any]:
    if not image_name.strip():
        raise ValueError("image_required")
    if not source_label.strip():
        raise ValueError("source_label_required")
    provider = PROVIDERS.get(provider_id)
    if provider is None:
        raise ValueError("ocr_provider_unavailable")
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        candidate_text = provider.extract(image_name, candidate_hint)
        import_id = uid("ocr_import")
        provenance = {"source_type": "OCR_IMPORT", "provider_id": provider.provider_id, "source_label": source_label.strip()}
        db.execute(
            """INSERT INTO ocr_imports
               (id,child_id,provider_id,source_type,source_label,candidate_text,created_at,
                private_content,provenance_status,commercial_ready,review_status,provenance_json)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (import_id, child_id, provider.provider_id, "OCR_IMPORT", source_label.strip(), candidate_text, now(), 1, "PRIVATE_OK", 0, "CANDIDATE", json.dumps(provenance, ensure_ascii=False, sort_keys=True)),
        )
        return _metadata(db.execute("SELECT * FROM ocr_imports WHERE id=?", (import_id,)).fetchone())


def confirm_candidate(*, child_id: int, import_id: str, confirmed_text: str, locale: str, script: str) -> dict[str, Any]:
    text = confirmed_text.strip()
    if not text:
        raise ValueError("confirmed_text_required")
    if locale not in SUPPORTED_LOCALES or script not in SUPPORTED_SCRIPTS:
        raise ValueError("unsupported_locale_or_script")
    expected_script = {"zh-TW": "TRADITIONAL", "zh-CN": "SIMPLIFIED"}[locale]
    if script != expected_script:
        raise ValueError("script_locale_mismatch")
    expected_locale = _source_locale(text)
    if expected_locale is not None and expected_locale != locale:
        raise ValueError("script_locale_mismatch")
    initialize_database()
    with connect() as db:
        row = db.execute("SELECT * FROM ocr_imports WHERE id=? AND child_id=?", (import_id, child_id)).fetchone()
        if row is None:
            raise ValueError("ocr_import_not_found")
        if row["review_status"] == "CONFIRMED":
            raise ValueError("ocr_import_already_confirmed")
        duplicate = db.execute(
            """SELECT id FROM ocr_imports
               WHERE child_id=? AND source_label=? AND confirmed_text=? AND review_status='CONFIRMED' AND id<>?""",
            (child_id, row["source_label"], text, import_id),
        ).fetchone()
        if duplicate is not None:
            raise ValueError("duplicate_ocr_import")
        school_id = uid("school")
        school_source = f"OCR Import: {row['source_label']}"
        db.execute(
            """INSERT INTO school_queue_items
               (id,child_id,character,school_source,private_content,provenance_status)
               VALUES (?,?,?,?,?,?)""",
            (school_id, child_id, text, school_source, 1, "PRIVATE_OK"),
        )
        db.execute(
            """UPDATE ocr_imports SET confirmed_text=?,locale=?,script=?,confirmed_at=?,review_status='CONFIRMED',school_queue_item_id=?
               WHERE id=? AND child_id=?""",
            (text, locale, script, now(), school_id, import_id, child_id),
        )
        result = _metadata(db.execute("SELECT * FROM ocr_imports WHERE id=?", (import_id,)).fetchone())
        result["school_queue_item"] = dict(db.execute("SELECT * FROM school_queue_items WHERE id=?", (school_id,)).fetchone())
        return result
