"""Fail-closed source-evidence and public curriculum artifact gate.

The repository inventory records content-sensitive tracked paths without copying
their contents. SHA-256 digests detect unreviewed drift; they are not a rights
finding. Only explicitly rights-cleared, evidence-linked items may enter a
publishable curriculum artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Mapping, Sequence


ROOT = Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / "shared" / "content-sources" / "public-repo-audit.json"
REGISTRY_PATH = ROOT / "shared" / "content-sources" / "source-registry.json"
BACKEND_PATH = ROOT / "backend"
SCOPE_PREFIXES = (
    "shared/lesson-packages/",
    "shared/open-curriculum/packs/",
    "shared/content-sources/imports/",
    "shared/content-sources/raw/",
    "frontend/src/data/",
    "frontend/src/assets/",
    "frontend/public/",
    "data/",
)
SCOPE_FILES = {
    "shared/validated-curriculum-slice.json",
    "backend/app/curriculum.py",
    "backend/app/learning.py",
    "backend/app/sprint_b.py",
}
CLASSIFICATIONS = {
    "OWNED",
    "OPEN_LICENSED",
    "REFERENCE_ONLY",
    "RIGHTS_UNCLEAR",
    "THIRD_PARTY_RESTRICTED",
}
BLOCKED_CLASSIFICATIONS = {
    "REFERENCE_ONLY",
    "RIGHTS_UNCLEAR",
    "THIRD_PARTY_RESTRICTED",
}


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _tracked_paths() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [path for path in result.stdout.decode("utf-8").split("\0") if path]


def _is_candidate(path: str) -> bool:
    if path.endswith("/.gitkeep") or path == ".gitkeep":
        return False
    return path in SCOPE_FILES or path.startswith(SCOPE_PREFIXES)


def _content_snapshot(path: Path) -> tuple[str, int, str]:
    """Return a platform-stable digest, canonical byte count, and locked mode.

    Git checkouts may materialize text with LF or CRLF depending on platform.
    Normalize text line endings before hashing so the inventory detects content
    drift without treating checkout configuration as a rights change. Binary
    files are hashed byte-for-byte.
    """
    content = path.read_bytes()
    if b"\x00" in content:
        mode = "BINARY_RAW"
    else:
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            mode = "BINARY_RAW"
        else:
            mode = "TEXT_LF_NORMALIZED"
    if mode == "TEXT_LF_NORMALIZED":
        content = content.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    return hashlib.sha256(content).hexdigest(), len(content), mode


def seed_inventory_template() -> dict[str, Any]:
    """Create a blocked-by-default inventory template for human classification."""
    entries = []
    for relative in sorted(path for path in _tracked_paths() if _is_candidate(path)):
        source_path = ROOT / Path(relative)
        digest, size, digest_mode = _content_snapshot(source_path)
        entries.append(
            {
                "path": relative,
                "classification": "RIGHTS_UNCLEAR",
                "sourceIds": [],
                "evidenceIds": [],
                "rootMitApplies": False,
                "publishableArtifactAllowed": False,
                "reason": "Unclassified content-sensitive path; blocked until item-level evidence and an explicit policy decision are recorded.",
                "digestMode": digest_mode,
                "sha256": digest,
                "sizeBytes": size,
            }
        )
    return {
        "schemaVersion": "1.0",
        "auditId": "tongxuan-public-repo-content-audit-v1",
        "baselineCommit": "e4532a70ea03e54ce6ce797757f597259190409d",
        "classificationVocabulary": sorted(CLASSIFICATIONS),
        "scope": {
            "candidatePrefixes": list(SCOPE_PREFIXES),
            "candidateExactPaths": sorted(SCOPE_FILES),
            "method": "Enumerate tracked data, curriculum, media, and known embedded-content modules; record path, canonical size, digest mode, and SHA-256 only. Text uses UTF-8 with LF-normalized line endings; binary is hashed byte-for-byte. No source corpus is downloaded.",
            "limitations": [
                "Path and digest inventory does not detect paraphrase, copying, embedded data, or authorship.",
                "A source link or public availability is not a reuse grant.",
                "RIGHTS_UNCLEAR is blocked for publishable artifacts; it is not a legal finding.",
                "An empty THIRD_PARTY_RESTRICTED set would not prove the tree contains no such material.",
            ],
        },
        "entries": entries,
    }


def validate_inventory(audit: Mapping[str, Any]) -> list[str]:
    errors: list[str] = []
    if audit.get("schemaVersion") != "1.0":
        errors.append("AUDIT_SCHEMA_VERSION_UNSUPPORTED")
    if audit.get("classificationVocabulary") != sorted(CLASSIFICATIONS):
        errors.append("AUDIT_CLASSIFICATION_VOCABULARY_INVALID")
    scope = audit.get("scope")
    if not isinstance(scope, Mapping) or not isinstance(scope.get("method"), str) or not scope.get("method"):
        errors.append("AUDIT_SCOPE_METHOD_MISSING")
    elif not isinstance(scope.get("limitations"), list) or not scope["limitations"]:
        errors.append("AUDIT_SCOPE_LIMITATIONS_MISSING")
    if isinstance(scope, Mapping):
        if scope.get("candidatePrefixes") != list(SCOPE_PREFIXES):
            errors.append("AUDIT_SCOPE_PREFIXES_STALE")
        if scope.get("candidateExactPaths") != sorted(SCOPE_FILES):
            errors.append("AUDIT_SCOPE_EXACT_PATHS_STALE")
    entries = audit.get("entries")
    if not isinstance(entries, list):
        return ["AUDIT_ENTRIES_INVALID: entries must be an array"]
    tracked = {path for path in _tracked_paths() if _is_candidate(path)}
    declared: set[str] = set()
    by_path: dict[str, Mapping[str, Any]] = {}
    registry = _read_json(REGISTRY_PATH)
    sources = {
        item.get("sourceId"): item
        for item in registry.get("sources", [])
        if isinstance(item, Mapping) and isinstance(item.get("sourceId"), str)
    }
    evidence_source_by_id: dict[str, str] = {}
    for source_id, source in sources.items():
        evidence_records = source.get("rightsEvidence", [])
        if not isinstance(evidence_records, list):
            continue
        for evidence in evidence_records:
            if isinstance(evidence, Mapping) and isinstance(evidence.get("evidenceId"), str):
                evidence_source_by_id[evidence["evidenceId"]] = source_id

    for index, entry in enumerate(entries):
        if not isinstance(entry, Mapping):
            errors.append(f"AUDIT_ENTRY_INVALID: entries/{index} must be an object")
            continue
        path = entry.get("path")
        if not isinstance(path, str) or not path or Path(path).is_absolute() or ".." in Path(path).parts:
            errors.append(f"AUDIT_PATH_INVALID: entries/{index}/path must be a safe repository-relative path")
            continue
        if path in declared:
            errors.append(f"AUDIT_PATH_DUPLICATE: {path}")
            continue
        declared.add(path)
        by_path[path] = entry
        if path not in tracked:
            errors.append(f"AUDIT_PATH_NOT_TRACKED: {path}")
            continue
        classification = entry.get("classification")
        if not isinstance(classification, str) or classification not in CLASSIFICATIONS:
            errors.append(f"AUDIT_CLASSIFICATION_INVALID: {path}")
        if entry.get("rootMitApplies") is not False:
            errors.append(f"ROOT_MIT_RELICENSES_EXTERNAL_CONTENT: {path}")
        if not isinstance(entry.get("reason"), str) or not entry["reason"].strip():
            errors.append(f"AUDIT_REASON_MISSING: {path}")
        source_ids = entry.get("sourceIds")
        if not isinstance(source_ids, list) or any(not isinstance(source_id, str) or source_id not in sources for source_id in source_ids):
            errors.append(f"AUDIT_SOURCE_UNRESOLVED: {path}")
            source_ids = []
        if source_ids and (not isinstance(entry.get("sourceRelationship"), str) or not entry["sourceRelationship"].strip()):
            errors.append(f"AUDIT_SOURCE_RELATIONSHIP_MISSING: {path}")
        evidence_ids = entry.get("evidenceIds")
        if not isinstance(evidence_ids, list):
            errors.append(f"AUDIT_EVIDENCE_UNRESOLVED: {path}")
            evidence_ids = []
        else:
            for evidence_id in evidence_ids:
                if not isinstance(evidence_id, str) or evidence_id not in evidence_source_by_id:
                    errors.append(f"AUDIT_EVIDENCE_UNRESOLVED: {path}")
                elif evidence_source_by_id[evidence_id] not in source_ids:
                    errors.append(f"AUDIT_EVIDENCE_SOURCE_MISMATCH: {path}:{evidence_id}")
        if isinstance(classification, str) and classification in {"OWNED", "OPEN_LICENSED"}:
            if entry.get("publishableArtifactAllowed") is not True or not evidence_ids:
                errors.append(f"AUDIT_CLEARANCE_UNSUPPORTED: {path}")
            if classification == "OPEN_LICENSED" and not source_ids:
                errors.append(f"OPEN_LICENSE_SOURCE_MISSING: {path}")
            for source_id in source_ids:
                if sources[source_id].get("legalStatus") != "GREEN":
                    errors.append(f"AUDIT_SOURCE_NOT_GREEN: {path}:{source_id}")
        elif entry.get("publishableArtifactAllowed") is not False:
            errors.append(f"BLOCKED_AUDIT_ENTRY_MARKED_PUBLISHABLE: {path}")

        source_path = ROOT / Path(path)
        actual_digest, actual_size, actual_mode = _content_snapshot(source_path)
        digest_mode = entry.get("digestMode")
        if not isinstance(digest_mode, str) or digest_mode not in {"TEXT_LF_NORMALIZED", "BINARY_RAW"}:
            errors.append(f"AUDIT_DIGEST_MODE_INVALID: {path}")
        elif digest_mode != actual_mode:
            errors.append(f"AUDIT_DIGEST_MODE_MISMATCH: {path}")
        if entry.get("sha256") != actual_digest:
            errors.append(f"AUDIT_CONTENT_DIGEST_MISMATCH: {path}")
        if entry.get("sizeBytes") != actual_size:
            errors.append(f"AUDIT_CONTENT_SIZE_MISMATCH: {path}")

    for path in sorted(tracked - declared):
        errors.append(f"AUDIT_PATH_UNREGISTERED: {path}")
    for path in sorted(declared - tracked):
        errors.append(f"AUDIT_PATH_NOT_CANDIDATE: {path}")
    return sorted(set(errors))


def validate_publishable_paths(
    paths: Sequence[str], audit: Mapping[str, Any]
) -> list[str]:
    """Reject any explicitly included raw/content file not cleared for publication."""
    inventory_errors = validate_inventory(audit)
    entries = {
        entry.get("path"): entry
        for entry in audit.get("entries", [])
        if isinstance(entry, Mapping) and isinstance(entry.get("path"), str)
    }
    registry = _read_json(REGISTRY_PATH)
    sys.path.insert(0, str(BACKEND_PATH))
    from app.open_curriculum_validator import load_default_source_registry, validate_source_registry

    errors: list[str] = [f"PUBLIC_ARTIFACT_AUDIT_INVALID:{error}" for error in inventory_errors]
    errors.extend(
        f"PUBLIC_ARTIFACT_SOURCE_REGISTRY_INVALID:{issue.code}:{issue.path}"
        for issue in validate_source_registry(load_default_source_registry())
    )
    sources = {
        item.get("sourceId"): item
        for item in registry.get("sources", [])
        if isinstance(item, Mapping) and isinstance(item.get("sourceId"), str)
    }
    for path in paths:
        entry = entries.get(path)
        if entry is None:
            errors.append(f"PUBLIC_ARTIFACT_PATH_UNINVENTORIED: {path}")
            continue
        classification = entry.get("classification")
        if not isinstance(classification, str) or classification in BLOCKED_CLASSIFICATIONS or entry.get("publishableArtifactAllowed") is not True:
            errors.append(f"PUBLIC_ARTIFACT_RESTRICTED_CONTENT: {path}")
        source_ids = entry.get("sourceIds", [])
        if not isinstance(source_ids, list):
            source_ids = []
        for source_id in source_ids:
            source = sources.get(source_id)
            if source is None or source.get("legalStatus") != "GREEN":
                errors.append(f"PUBLIC_ARTIFACT_SOURCE_NOT_GREEN: {path}:{source_id}")
        if entry.get("rootMitApplies") is not False:
            errors.append(f"ROOT_MIT_RELICENSES_EXTERNAL_CONTENT: {path}")
    return sorted(set(errors))


def validate_publishable_pack(path: Path) -> list[str]:
    sys.path.insert(0, str(BACKEND_PATH))
    from app.open_curriculum_validator import validate_curriculum_pack

    try:
        pack = _read_json(path)
    except (OSError, json.JSONDecodeError) as error:
        return [f"PUBLISHABLE_PACK_INVALID: {error}"]
    issues = validate_curriculum_pack(pack)
    return [f"{issue.code}:{issue.path}:{issue.message}" for issue in issues]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate registry and tracked-path audit")
    parser.add_argument("--seed-inventory", action="store_true", help="write a blocked-by-default inventory template")
    parser.add_argument("--refresh-digests", action="store_true", help="refresh digest mode, SHA-256, and canonical size while preserving classifications")
    parser.add_argument("--publishable-path", action="append", default=[], help="repo-relative path proposed for a public curriculum artifact")
    parser.add_argument("--publishable-pack", type=Path, help="validate a candidate curriculum pack for publication")
    args = parser.parse_args(argv)

    if args.seed_inventory:
        AUDIT_PATH.write_text(json.dumps(seed_inventory_template(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote blocked-by-default inventory template: {AUDIT_PATH.relative_to(ROOT)}")
        return 0

    if args.refresh_digests:
        audit = _read_json(AUDIT_PATH)
        for entry in audit.get("entries", []):
            if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
                raise ValueError("Cannot refresh a malformed inventory entry")
            digest, size, digest_mode = _content_snapshot(ROOT / Path(entry["path"]))
            entry["digestMode"] = digest_mode
            entry["sha256"] = digest
            entry["sizeBytes"] = size
        AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Refreshed canonical inventory digests: {AUDIT_PATH.relative_to(ROOT)}")
        return 0

    errors: list[str] = []
    if args.check:
        audit = _read_json(AUDIT_PATH)
        errors.extend(validate_inventory(audit))
        sys.path.insert(0, str(BACKEND_PATH))
        from app.open_curriculum_validator import load_default_source_registry, validate_source_registry

        errors.extend(
            f"{issue.code}:{issue.path}:{issue.message}"
            for issue in validate_source_registry(load_default_source_registry())
        )
    if args.publishable_path:
        audit = _read_json(AUDIT_PATH)
        errors.extend(validate_publishable_paths(args.publishable_path, audit))
    if args.publishable_pack is not None:
        errors.extend(validate_publishable_pack(args.publishable_pack))

    if errors:
        for error in sorted(set(errors)):
            print(error, file=sys.stderr)
        return 1
    print("Open Curriculum rights gate PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
