"""Fail-closed static/PWA production artifact check."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def check_dist(dist: Path) -> list[str]:
    errors: list[str] = []
    for name in ("index.html", "manifest.webmanifest", "sw.js"):
        if not (dist / name).is_file():
            errors.append(f"missing:{name}")
    manifest_path = dist / "manifest.webmanifest"
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for field in ("name", "short_name", "start_url", "display"):
                if not str(manifest.get(field, "")).strip():
                    errors.append(f"manifest_missing:{field}")
            if manifest.get("display") != "standalone":
                errors.append("manifest_not_standalone")
        except json.JSONDecodeError:
            errors.append("manifest_invalid_json")
    return errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", type=Path, default=Path("frontend/dist"))
    args = parser.parse_args()
    failures = check_dist(args.dist)
    if failures:
        raise SystemExit("production_artifact_check_failed:" + ",".join(failures))
    print("production_artifact_check: PASS")
