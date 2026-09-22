from __future__ import annotations

from dataclasses import dataclass

try:
    from opencc import OpenCC
except ImportError:  # pragma: no cover - exercised by deployment misconfiguration
    OpenCC = None


SUPPORTED_DIRECTIONS = {"s2t", "s2tw", "t2s"}


@dataclass
class OpenCCProvider:
    """Adapter boundary around OpenCC; the API never couples to the library."""

    def convert(self, text: str, direction: str) -> str:
        if direction not in SUPPORTED_DIRECTIONS:
            raise ValueError(f"Unsupported direction: {direction}")
        if OpenCC is None:
            raise RuntimeError("OpenCC provider is not installed")
        return OpenCC(direction).convert(text)
