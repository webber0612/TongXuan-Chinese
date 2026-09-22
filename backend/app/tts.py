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

# School Queue entries currently carry the source character rather than a
# caller-selected script field. These pairs are the unambiguous script
# markers used to bind source content to its locale at the TTS boundary.
_SIMPLIFIED_MARKERS = set("学国汉书说语车门马听读见习会这为来发爱头长开东云儿")
_TRADITIONAL_MARKERS = set("學國漢書說語車門馬聽讀見習會這為來發愛頭長開東雲兒")


def _source_locale(text: str) -> str | None:
    simplified = bool(set(text) & _SIMPLIFIED_MARKERS)
    traditional = bool(set(text) & _TRADITIONAL_MARKERS)
    if simplified and traditional:
        return None
    if simplified:
        return "zh-CN"
    if traditional:
        return "zh-TW"
    return None


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
            source_text = str(item["character"])
            normalized_text = text.strip()
            if normalized_text != source_text:
                raise ValueError("school_queue_text_mismatch")
            expected_locale = _source_locale(source_text)
            if expected_locale is None:
                raise ValueError("school_queue_script_unknown")
            if locale != expected_locale:
                raise ValueError("school_queue_locale_mismatch")
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
