"""Fail-closed source-evidence and public curriculum artifact gate.

The repository inventory records content-sensitive tracked paths without copying
their contents. SHA-256 digests detect unreviewed drift; they are not a rights
finding. Only explicitly rights-cleared, evidence-linked items may enter a
publishable curriculum artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Mapping, Sequence


ROOT = Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / "shared" / "content-sources" / "public-repo-audit.json"
AUDIT_RELATIVE_PATH = "shared/content-sources/public-repo-audit.json"
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
CJK_TEXT_EXTENSIONS = frozenset({
    ".py", ".ts", ".tsx", ".js", ".jsx", ".md", ".json", ".html",
    ".css", ".txt", ".yaml", ".yml", ".csv", ".sql",
})
MEDIA_EXTENSIONS = frozenset({
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif",
    ".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm", ".mov",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".ttf", ".otf", ".woff", ".woff2",
})
CJK_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\U00020000-\U0003347f]")
UNICODE_ESCAPE_PATTERN = re.compile(r"\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})|\\u\{([0-9a-fA-F]{1,6})\}")
HTML_CODEPOINT_PATTERN = re.compile(r"&#(?:x([0-9a-fA-F]+)|([0-9]+));", re.IGNORECASE)
CSS_CODEPOINT_PATTERN = re.compile(r"\\([0-9a-fA-F]{1,6})(?![0-9a-fA-F])")
SCOPE_METHOD = (
    "Enumerate tracked data, curriculum, media, and known embedded-content modules. "
    "In addition, treat every tracked UTF-8 text file in the declared text extensions "
    "with literal CJK, Unicode escapes, numeric HTML entities, or CSS hexadecimal "
    "escapes as a candidate, every undecodable or NUL-containing "
    "file with a declared text extension as an ambiguous candidate, and every file in "
    "the declared media extensions as a candidate. Record path, classification, "
    "source/evidence links where supported, canonical size, digest mode, and SHA-256 "
    "only. Text uses UTF-8 with LF-normalized line endings; binary is hashed "
    "byte-for-byte. No source corpus is downloaded."
)
SCOPE_LIMITATIONS = (
    "Path and digest inventory does not detect paraphrase, copying, embedded data, or authorship.",
    "CJK detection is a conservative path-discovery signal; it can include interface, technical, and reference text and does not establish that a path contains curriculum content.",
    "The text scan recognizes literal CJK through the Unicode 18 Extension J block boundary (U+3347F), Unicode escapes including UTF-16 surrogate pairs, numeric HTML entities, and CSS hexadecimal escapes only in the declared text extensions; future Unicode blocks require an explicit scanner-range update, and the scan does not detect English paraphrase or semantic similarity.",
    "Declared text paths that are not valid UTF-8 or contain NUL bytes are included as ambiguous blocked candidates; their contents are not decoded for CJK matching.",
    "The media scan is extension-based and does not inspect or identify the contents of a binary file.",
    "The public-repository audit manifest is intentionally not one of its own digest entries; the gate validates its structure and scope directly.",
    "A source link or public availability is not a reuse grant.",
    "RIGHTS_UNCLEAR is blocked for publishable artifacts; it is not a legal finding.",
    "An empty THIRD_PARTY_RESTRICTED set would not prove the tree contains no such material.",
)
SCOPE_FILES = {
    "shared/validated-curriculum-slice.json",
    "backend/app/curriculum.py",
    "backend/app/learning.py",
    "backend/app/sprint_b.py",
    "backend/app/learning_flow.py",
    "backend/tests/test_learning_flow.py",
    "backend/tests/test_lesson_player.py",
    "backend/tests/test_validated_curriculum_policy.py",
    "docs/archive/ui/issue-28-frontend-review.md",
    "docs/assessment-blueprints.md",
    "docs/curriculum-audit-v1.md",
    "docs/frontend-rebuild-plan.md",
    "docs/learning-path-v2.md",
    "docs/learning-session-policy-v1.md",
    "frontend/src/pages/ChildPortalPage.tsx",
    "frontend/src/pages/CourseZeroPage.tsx",
    "frontend/src/pages/FirstLessonPage.tsx",
    "frontend/src/pages/LearningPage.tsx",
    "frontend/src/pages/LessonPlayerPage.tsx",
    "frontend/src/components/PlacementStatus.tsx",
    "frontend/src/lib/childFirst.test.tsx",
    "frontend/src/lib/lessonPlayer.test.tsx",
    "frontend/src/lib/testFixtures/learningFlow.ts",
    "frontend/src/lib/curriculum.test.ts",
    "frontend/src/lib/learning.test.ts",
    "frontend/src/lib/adaptiveWriting.test.ts",
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


def _is_cjk_codepoint(value: int) -> bool:
    return bool(CJK_PATTERN.fullmatch(chr(value))) if 0 <= value <= 0x10FFFF else False


def _contains_cjk(text: str) -> bool:
    """Recognize literal, Unicode-escaped, and HTML-escaped CJK in UTF-8 text."""
    decoded = html.unescape(text)
    if CJK_PATTERN.search(decoded):
        return True
    escaped_codepoints: list[int] = []
    for match in UNICODE_ESCAPE_PATTERN.finditer(decoded):
        encoded = next((group for group in match.groups() if group is not None), None)
        if encoded is not None and _is_cjk_codepoint(int(encoded, 16)):
            return True
        if encoded is not None:
            escaped_codepoints.append(int(encoded, 16))
    index = 0
    while index + 1 < len(escaped_codepoints):
        high, low = escaped_codepoints[index:index + 2]
        if 0xD800 <= high <= 0xDBFF and 0xDC00 <= low <= 0xDFFF:
            codepoint = 0x10000 + ((high - 0xD800) << 10) + (low - 0xDC00)
            if _is_cjk_codepoint(codepoint):
                return True
            index += 2
        else:
            index += 1
    for match in HTML_CODEPOINT_PATTERN.finditer(decoded):
        encoded = match.group(1) or match.group(2)
        radix = 16 if match.group(1) else 10
        if encoded is not None and _is_cjk_codepoint(int(encoded, radix)):
            return True
    for match in CSS_CODEPOINT_PATTERN.finditer(decoded):
        if _is_cjk_codepoint(int(match.group(1), 16)):
            return True
    return False


def _is_dynamic_text_candidate(path: str, text: str) -> bool:
    return Path(path).suffix.lower() in CJK_TEXT_EXTENSIONS and _contains_cjk(text)


def _is_candidate(path: str) -> bool:
    if path.endswith("/.gitkeep") or path == ".gitkeep":
        return False
    if path == AUDIT_RELATIVE_PATH:
        # The manifest validates its own structure and cannot safely hash itself.
        return False
    if path in SCOPE_FILES or path.startswith(SCOPE_PREFIXES):
        return True

    suffix = Path(path).suffix.lower()
    if suffix in MEDIA_EXTENSIONS:
        return True
    if suffix not in CJK_TEXT_EXTENSIONS:
        return False

    try:
        content = (ROOT / Path(path)).read_bytes()
        if b"\x00" in content:
            # A declared text path with unexpected binary bytes is ambiguous;
            # keep it in the blocked inventory instead of treating it as safe.
            return True
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        # Do not let a non-UTF-8 payload with a text extension bypass discovery.
        return True
    except OSError:
        return False
    return _is_dynamic_text_candidate(path, text)


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
        "baselineCommit": "4777c699412cfc49f7cef0e7a007143813d8b652",
        "classificationVocabulary": sorted(CLASSIFICATIONS),
        "scope": {
            "candidatePrefixes": list(SCOPE_PREFIXES),
            "candidateExactPaths": sorted(SCOPE_FILES),
            "dynamicCjkTextExtensions": sorted(CJK_TEXT_EXTENSIONS),
            "dynamicMediaExtensions": sorted(MEDIA_EXTENSIONS),
            "method": SCOPE_METHOD,
            "limitations": list(SCOPE_LIMITATIONS),
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
        if scope.get("method") != SCOPE_METHOD:
            errors.append("AUDIT_SCOPE_METHOD_STALE")
        if scope.get("limitations") != list(SCOPE_LIMITATIONS):
            errors.append("AUDIT_SCOPE_LIMITATIONS_STALE")
        if scope.get("candidatePrefixes") != list(SCOPE_PREFIXES):
            errors.append("AUDIT_SCOPE_PREFIXES_STALE")
        if scope.get("candidateExactPaths") != sorted(SCOPE_FILES):
            errors.append("AUDIT_SCOPE_EXACT_PATHS_STALE")
        if scope.get("dynamicCjkTextExtensions") != sorted(CJK_TEXT_EXTENSIONS):
            errors.append("AUDIT_CJK_TEXT_SCOPE_STALE")
        if scope.get("dynamicMediaExtensions") != sorted(MEDIA_EXTENSIONS):
            errors.append("AUDIT_MEDIA_SCOPE_STALE")
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
    """Validate a pack and require its tracked repository path to be cleared."""
    sys.path.insert(0, str(BACKEND_PATH))
    from app.open_curriculum_validator import validate_curriculum_pack

    try:
        pack = _read_json(path)
    except (OSError, json.JSONDecodeError) as error:
        return [f"PUBLISHABLE_PACK_INVALID: {error}"]
    errors = [f"{issue.code}:{issue.path}:{issue.message}" for issue in validate_curriculum_pack(pack)]
    if not isinstance(pack, Mapping) or pack.get("publicationStatus") != "PUBLISHABLE":
        errors.append("PUBLISHABLE_PACK_STATUS_REQUIRED: publicationStatus must be PUBLISHABLE.")
    try:
        relative_path = path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return sorted(set(errors + [f"PUBLIC_ARTIFACT_PATH_UNINVENTORIED: {path}"]))
    if not _is_candidate(relative_path):
        errors.append(f"PUBLIC_ARTIFACT_PATH_UNINVENTORIED: {relative_path}")
    else:
        errors.extend(validate_publishable_paths([relative_path], _read_json(AUDIT_PATH)))
    return sorted(set(errors))


def validate_tracked_open_curriculum_packs(audit: Mapping[str, Any]) -> list[str]:
    """Validate every tracked Open Curriculum pack; publication also needs path clearance."""
    sys.path.insert(0, str(BACKEND_PATH))
    from app.open_curriculum_validator import validate_curriculum_pack

    errors: list[str] = []
    pack_paths = sorted(
        path for path in _tracked_paths()
        if path.startswith("shared/open-curriculum/packs/") and path.lower().endswith(".json")
    )
    for relative_path in pack_paths:
        path = ROOT / Path(relative_path)
        try:
            pack = _read_json(path)
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"OPEN_CURRICULUM_PACK_INVALID: {relative_path}: {error}")
            continue
        if not isinstance(pack, Mapping):
            errors.append(f"OPEN_CURRICULUM_PACK_INVALID: {relative_path}: document must be an object")
            continue
        publication_status = pack.get("publicationStatus")
        if publication_status not in {"PROPOSED", "PUBLISHABLE"}:
            errors.append(f"OPEN_CURRICULUM_PACK_STATUS_INVALID: {relative_path}")
        errors.extend(
            f"{relative_path}:{issue.code}:{issue.path}:{issue.message}"
            for issue in validate_curriculum_pack(pack)
        )
        if publication_status == "PUBLISHABLE":
            errors.extend(validate_publishable_paths([relative_path], audit))
    return sorted(set(errors))


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate registry, tracked-path audit, and all tracked Open Curriculum packs")
    parser.add_argument("--seed-inventory", action="store_true", help="write a blocked-by-default inventory template")
    parser.add_argument("--refresh-digests", action="store_true", help="refresh digest mode, SHA-256, and canonical size while preserving classifications")
    parser.add_argument("--publishable-path", action="append", default=[], help="repo-relative path proposed for a public curriculum artifact")
    parser.add_argument("--publishable-pack", type=Path, help="validate a PUBLISHABLE pack and require tracked path clearance")
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
        errors.extend(validate_tracked_open_curriculum_packs(audit))
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
