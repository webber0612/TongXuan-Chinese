"""Phase 11 TTS boundary.

TTS creates a transient playback payload only. It never writes learning attempts,
mastery, audio files, or provider-specific state.
"""

from dataclasses import dataclass
from typing import Any, Protocol

from .database import connect
from .learning import ensure_child

SUPPORTED_LOCALES = {"zh-TW", "zh-CN"}
SUPPORTED_TEXT_KINDS = {"character", "word", "sentence", "passage"}


class TTSProvider(Protocol):
    provider_id: str
    locale: str

    def payload(self, text: str, text_kind: str, rate: float) -> dict[str, Any]:
        """Return a transient provider-neutral playback payload."""


@dataclass(frozen=True)
class BrowserSpeechSynthesisProvider:
    """Adapter metadata for the browser Web Speech API."""

    locale: str
    provider_id: str = "browser-speech-synthesis"

    def payload(self, text: str, text_kind: str, rate: float) -> dict[str, Any]:
        return {
            "provider": self.provider_id,
            "locale": self.locale,
            "voice_locale": self.locale,
            "text": text,
            "text_kind": text_kind,
            "rate": rate,
            "playback_only": True,
            "persisted": False,
        }


class TTSProviderRegistry:
    def route(self, locale: str) -> TTSProvider:
        if locale not in SUPPORTED_LOCALES:
            raise ValueError("unsupported_locale")
        return BrowserSpeechSynthesisProvider(locale)


registry = TTSProviderRegistry()


def prepare_tts(
    *,
    text: str,
    locale: str,
    text_kind: str,
    rate: float,
    child_id: int | None = None,
    school_queue_item_id: str | None = None,
    source_type: str = "TRANSIENT_TEXT",
    provenance_status: str | None = None,
) -> dict[str, Any]:
    if not text.strip():
        raise ValueError("text_required")
    if text_kind not in SUPPORTED_TEXT_KINDS:
        raise ValueError("unsupported_text_kind")
    if not 0.5 <= rate <= 2.0:
        raise ValueError("invalid_rate")
    provider = registry.route(locale)
    provenance: dict[str, Any] | None = None
    if school_queue_item_id:
        if child_id is None:
            raise ValueError("child_required_for_school_queue")
        with connect() as db:
            ensure_child(db, child_id)
            item = db.execute("SELECT * FROM school_queue_items WHERE id=? AND child_id=?", (school_queue_item_id, child_id)).fetchone()
            if item is None:
                raise ValueError("school_queue_item_not_found")
            provenance = {
                "source_type": "SCHOOL_QUEUE_PRIVATE",
                "source_id": school_queue_item_id,
                "status": item["provenance_status"],
                "private_content": bool(item["private_content"]),
            }
    payload = provider.payload(text.strip(), text_kind, rate)
    payload["provenance"] = provenance
    if provenance_status and provenance is None:
        payload["provenance"] = {"source_type": source_type, "status": provenance_status}
    return payload
