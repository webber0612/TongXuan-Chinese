"""Explicit boundary for stroke/trace providers used by Sprint B writing practice."""

from dataclasses import dataclass
from typing import Protocol


class WritingTraceProvider(Protocol):
    name: str

    def validate(self, trace_result: str) -> str:
        """Return a deterministic trace result produced by this provider."""


@dataclass(frozen=True)
class DeterministicTraceProvider:
    """Adapter for a client-side Hanzi Writer/manual trace event.

    The MVP records the provider event; it does not claim handwriting-quality scoring.
    """

    name: str = "HANZI_WRITER"

    def validate(self, trace_result: str) -> str:
        if trace_result not in {"correct", "incorrect"}:
            raise ValueError("invalid_trace_result")
        return trace_result


def provider_for(name: str) -> WritingTraceProvider:
    if name not in {"HANZI_WRITER", "MANUAL_TRACE_RULE"}:
        raise ValueError("unsupported_writing_provider")
    return DeterministicTraceProvider(name=name)
