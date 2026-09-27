from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

from app.open_curriculum_validator import load_default_source_registry, validate_source_registry

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT))

from scripts import open_curriculum_rights_gate as rights_gate
from scripts.open_curriculum_rights_gate import (
    AUDIT_PATH,
    _content_snapshot,
    _is_candidate,
    validate_inventory,
    validate_publishable_paths,
    validate_publishable_pack,
    validate_tracked_open_curriculum_packs,
)

NEW_CURRICULUM_CONTENT_PATHS = (
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
)
OCAC_SOURCE_LINKED_CONTENT_PATHS = frozenset({
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
    "frontend/src/pages/FirstLessonPage.tsx",
    "frontend/src/lib/childFirst.test.tsx",
    "frontend/src/lib/lessonPlayer.test.tsx",
    "frontend/src/lib/testFixtures/learningFlow.ts",
    "frontend/src/components/PlacementStatus.tsx",
    "frontend/src/pages/LessonPlayerPage.tsx",
})


def load_audit():
    return json.loads(AUDIT_PATH.read_text(encoding="utf-8"))


def test_machine_inventory_covers_current_tracked_content_sensitive_paths():
    audit = load_audit()
    assert validate_inventory(audit) == []
    assert len(audit["entries"]) >= 30
    assert all(entry["sha256"] and entry["sizeBytes"] >= 0 for entry in audit["entries"])


def test_future_pack_raw_import_and_discovered_content_paths_enter_the_audit_scope():
    assert _is_candidate("shared/open-curriculum/packs/candidate.json")
    assert _is_candidate("shared/content-sources/imports/corpus.csv")
    assert _is_candidate("shared/content-sources/raw/audio.zip")
    assert all(_is_candidate(path) for path in NEW_CURRICULUM_CONTENT_PATHS)


def test_embedded_curriculum_and_reference_paths_are_inventoried_and_blocked():
    audit = load_audit()
    paths = NEW_CURRICULUM_CONTENT_PATHS
    entries = {entry["path"]: entry for entry in audit["entries"]}
    for path in paths:
        entry = entries[path]
        assert entry["classification"] == "RIGHTS_UNCLEAR"
        assert entry["publishableArtifactAllowed"] is False
        assert entry["rootMitApplies"] is False
        if path in OCAC_SOURCE_LINKED_CONTENT_PATHS:
            assert entry["sourceIds"] == ["ocac-learn-mandarin-children"]
            assert entry["evidenceIds"] == ["evidence-ocac-learn-mandarin-children-series-page"]
        else:
            assert entry["sourceIds"] == []
            assert entry["evidenceIds"] == []
    errors = validate_publishable_paths(paths, audit)
    assert {error.split(": ", 1)[-1] for error in errors if error.startswith("PUBLIC_ARTIFACT_RESTRICTED_CONTENT:")} == set(paths)


def test_embedded_curriculum_inventory_omission_and_digest_drift_fail_closed():
    for path in ("backend/app/learning_flow.py", "frontend/src/pages/LessonPlayerPage.tsx"):
        audit = load_audit()
        audit["entries"] = [entry for entry in audit["entries"] if entry["path"] != path]
        assert f"AUDIT_PATH_UNREGISTERED: {path}" in validate_inventory(audit)

        audit = load_audit()
        entry = next(item for item in audit["entries"] if item["path"] == path)
        entry["sha256"] = "0" * 64
        assert f"AUDIT_CONTENT_DIGEST_MISMATCH: {path}" in validate_inventory(audit)


def test_newly_discovered_content_cannot_be_cleared_by_status_flip_without_rights_evidence():
    for path in NEW_CURRICULUM_CONTENT_PATHS:
        audit = load_audit()
        entry = next(item for item in audit["entries"] if item["path"] == path)
        entry["classification"] = "OWNED"
        entry["publishableArtifactAllowed"] = True

        errors = validate_inventory(audit)
        if path not in OCAC_SOURCE_LINKED_CONTENT_PATHS:
            assert f"AUDIT_CLEARANCE_UNSUPPORTED: {path}" in errors
        else:
            assert f"AUDIT_SOURCE_NOT_GREEN: {path}:ocac-learn-mandarin-children" in errors


def test_rights_workflow_runs_when_embedded_curriculum_sources_change():
    workflow = (REPOSITORY_ROOT / ".github/workflows/open-curriculum-rights-gate.yml").read_text(encoding="utf-8")
    for path in NEW_CURRICULUM_CONTENT_PATHS:
        assert workflow.count(f'"{path}"') == 2


def test_unknown_and_reference_only_content_cannot_enter_publishable_artifact():
    audit = load_audit()
    blocked = [
        "shared/lesson-packages/book1-l01.json",
        "data/license-registry.json",
        "frontend/src/data/ocacTextbooksData.ts",
    ]
    errors = validate_publishable_paths(blocked, audit)
    assert len([error for error in errors if error.startswith("PUBLIC_ARTIFACT_RESTRICTED_CONTENT:")]) == len(blocked)


def test_uninventoried_publishable_path_fails_closed():
    assert validate_publishable_paths(["shared/unreviewed-pack.json"], load_audit()) == [
        "PUBLIC_ARTIFACT_PATH_UNINVENTORIED: shared/unreviewed-pack.json"
    ]


def test_publishable_pack_command_requires_inventory_clearance_for_its_path():
    errors = validate_publishable_pack(REPOSITORY_ROOT / "shared/lesson-packages/book1-l01.json")
    assert "PUBLIC_ARTIFACT_RESTRICTED_CONTENT: shared/lesson-packages/book1-l01.json" in errors
    assert "PUBLISHABLE_PACK_STATUS_REQUIRED: publicationStatus must be PUBLISHABLE." in errors


def test_check_discovers_and_validates_tracked_open_curriculum_packs(tmp_path, monkeypatch):
    relative_path = "shared/open-curriculum/packs/candidate.json"
    pack_path = tmp_path / Path(relative_path)
    pack_path.parent.mkdir(parents=True)
    pack_path.write_text('{"publicationStatus":"PROPOSED"}', encoding="utf-8")
    monkeypatch.setattr(rights_gate, "ROOT", tmp_path)
    monkeypatch.setattr(rights_gate, "_tracked_paths", lambda: [relative_path])

    errors = validate_tracked_open_curriculum_packs(load_audit())
    assert any(error.startswith(f"{relative_path}:") and "SCHEMA_INVALID" in error for error in errors)


def test_check_rejects_publishable_pack_with_blocked_inventory_path(tmp_path, monkeypatch, capsys):
    relative_path = "shared/open-curriculum/packs/candidate.json"
    pack_path = tmp_path / Path(relative_path)
    pack_path.parent.mkdir(parents=True)
    pack_path.write_text('{"publicationStatus":"PUBLISHABLE"}', encoding="utf-8")
    digest, size, digest_mode = rights_gate._content_snapshot(pack_path)
    audit_path = tmp_path / "public-repo-audit.json"
    audit_path.write_text(json.dumps({
        "schemaVersion": "1.0",
        "auditId": "test-audit",
        "baselineCommit": "test-only",
        "classificationVocabulary": sorted(rights_gate.CLASSIFICATIONS),
        "scope": {
            "candidatePrefixes": list(rights_gate.SCOPE_PREFIXES),
            "candidateExactPaths": sorted(rights_gate.SCOPE_FILES),
            "method": "synthetic test inventory",
            "limitations": ["synthetic only"],
        },
        "entries": [{
            "path": relative_path,
            "classification": "RIGHTS_UNCLEAR",
            "sourceIds": [],
            "evidenceIds": [],
            "rootMitApplies": False,
            "publishableArtifactAllowed": False,
            "reason": "synthetic blocked test path",
            "digestMode": digest_mode,
            "sha256": digest,
            "sizeBytes": size,
        }],
    }), encoding="utf-8")
    monkeypatch.setattr(rights_gate, "ROOT", tmp_path)
    monkeypatch.setattr(rights_gate, "AUDIT_PATH", audit_path)
    monkeypatch.setattr(rights_gate, "_tracked_paths", lambda: [relative_path])

    assert rights_gate.main(["--check"]) == 1
    assert "PUBLIC_ARTIFACT_RESTRICTED_CONTENT: shared/open-curriculum/packs/candidate.json" in capsys.readouterr().err


def test_third_party_content_cannot_inherit_root_mit():
    audit = load_audit()
    record = next(item for item in audit["entries"] if item["path"] == "shared/lesson-packages/book1-l01.json")
    record.update({
        "classification": "OPEN_LICENSED",
        "sourceIds": ["cc-cedict"],
        "evidenceIds": ["evidence-cc-cedict-download-license"],
        "publishableArtifactAllowed": True,
        "rootMitApplies": True,
    })
    errors = validate_publishable_paths([record["path"]], audit)
    assert "ROOT_MIT_RELICENSES_EXTERNAL_CONTENT: shared/lesson-packages/book1-l01.json" in errors


def test_inventory_digest_drift_requires_reaudit():
    audit = load_audit()
    audit = deepcopy(audit)
    audit["entries"][0]["sha256"] = "0" * 64
    errors = validate_inventory(audit)
    assert any(error.startswith("AUDIT_CONTENT_DIGEST_MISMATCH:") for error in errors)


def test_text_inventory_digest_is_stable_across_checkout_line_endings(tmp_path):
    path = tmp_path / "text.json"
    path.write_bytes(b'{"lesson": 1}\r\n')
    windows_snapshot = _content_snapshot(path)
    path.write_bytes(b'{"lesson": 1}\n')
    linux_snapshot = _content_snapshot(path)
    assert windows_snapshot == linux_snapshot
    assert windows_snapshot[2] == "TEXT_LF_NORMALIZED"


def test_binary_inventory_digest_remains_byte_exact(tmp_path):
    path = tmp_path / "image.bin"
    path.write_bytes(b"\x89PNG\r\n\x00\x1a")
    first = _content_snapshot(path)
    path.write_bytes(b"\x89PNG\n\x00\x1a")
    second = _content_snapshot(path)
    assert first[2] == second[2] == "BINARY_RAW"
    assert first[0] != second[0]


def test_source_ids_require_explicit_relationship_role():
    audit = load_audit()
    entry = next(item for item in audit["entries"] if item.get("sourceIds"))
    entry.pop("sourceRelationship", None)
    assert f"AUDIT_SOURCE_RELATIONSHIP_MISSING: {entry['path']}" in validate_inventory(audit)


def test_inventory_evidence_must_belong_to_a_declared_source():
    audit = load_audit()
    entry = next(item for item in audit["entries"] if len(item.get("sourceIds", [])) == 1 and item.get("evidenceIds"))
    declared_source_id = entry["sourceIds"][0]
    other_source = next(
        source for source in load_default_source_registry()["sources"]
        if source["sourceId"] != declared_source_id and source.get("rightsEvidence")
    )
    entry["evidenceIds"] = [other_source["rightsEvidence"][0]["evidenceId"]]
    assert f"AUDIT_EVIDENCE_SOURCE_MISMATCH: {entry['path']}:{entry['evidenceIds'][0]}" in validate_inventory(audit)


def test_missing_green_source_evidence_and_unknown_permissions_fail_closed():
    registry = load_default_source_registry()
    source = next(item for item in registry["sources"] if item["sourceId"] == "cc-cedict")
    source["rightsEvidence"] = []
    source["rightsDecision"]["evidenceIds"] = []
    assert {"SCHEMA_INVALID", "GREEN_RIGHTS_EVIDENCE_MISSING"} <= {
        issue.code for issue in validate_source_registry(registry)
    }

    registry = load_default_source_registry()
    source = next(item for item in registry["sources"] if item["sourceId"] == "cc-cedict")
    source["publicRepoAllowed"] = "UNKNOWN"
    assert "GREEN_RIGHTS_UNSUPPORTED" in {issue.code for issue in validate_source_registry(registry)}

    registry = load_default_source_registry()
    source = next(item for item in registry["sources"] if item["sourceId"] == "cc-cedict")
    source["shareAlike"] = "UNKNOWN"
    assert "GREEN_RIGHTS_UNSUPPORTED" in {issue.code for issue in validate_source_registry(registry)}


def test_unknown_cannot_be_changed_to_green_without_also_passing_decision_and_evidence_gates():
    registry = load_default_source_registry()
    source = next(item for item in registry["sources"] if item["sourceId"] == "mozilla-common-voice")
    source["legalStatus"] = "GREEN"
    issues = validate_source_registry(registry)
    codes = {issue.code for issue in issues}
    assert {"RIGHTS_STATUS_DECISION_MISMATCH", "GREEN_RIGHTS_UNSUPPORTED", "GREEN_RIGHTS_EVIDENCE_MISSING"} <= codes


def test_validation_only_source_cannot_be_green_even_with_a_license_notice():
    registry = load_default_source_registry()
    source = next(item for item in registry["sources"] if item["sourceId"] == "cc-cedict")
    source["validationOnly"] = True
    assert "VALIDATION_ONLY_SOURCE_NOT_PUBLISHABLE" in {
        issue.code for issue in validate_source_registry(registry)
    }


def test_malformed_rights_evidence_fails_closed_without_crashing():
    registry = load_default_source_registry()
    source = next(item for item in registry["sources"] if item["sourceId"] == "cc-cedict")
    source["rightsDecision"]["evidenceIds"] = None
    source["rightsEvidence"] = [None, {"evidenceId": ["invalid"]}]
    codes = {issue.code for issue in validate_source_registry(registry)}
    assert "SCHEMA_INVALID" in codes
    assert "GREEN_RIGHTS_EVIDENCE_MISSING" in codes

    registry = load_default_source_registry()
    registry["sources"][0]["legalStatus"] = ["GREEN"]
    assert "SCHEMA_INVALID" in {
        issue.code for issue in validate_source_registry(registry)
    }


def test_green_permission_claims_must_resolve_to_linked_evidence():
    registry = load_default_source_registry()
    source = next(item for item in registry["sources"] if item["sourceId"] == "cc-cedict")
    source["rightsEvidence"][0]["supportsClaims"] = ["SOURCE_DESCRIPTION"]
    source["rightsEvidence"][1]["supportsClaims"] = ["SOURCE_DESCRIPTION"]
    assert "GREEN_PERMISSION_EVIDENCE_MISSING" in {
        issue.code for issue in validate_source_registry(registry)
    }


def test_evidence_kind_must_be_capable_of_supporting_declared_rights_claims():
    registry = load_default_source_registry()
    source = next(item for item in registry["sources"] if item["sourceId"] == "cc-cedict")
    for evidence in source["rightsEvidence"]:
        evidence["evidenceKind"] = "SOURCE_DESCRIPTION"
    codes = {issue.code for issue in validate_source_registry(registry)}
    assert "RIGHTS_EVIDENCE_CLAIM_KIND_MISMATCH" in codes
    assert "GREEN_RIGHTS_EVIDENCE_MISSING" in codes
    assert "GREEN_PERMISSION_EVIDENCE_MISSING" in codes

    registry = load_default_source_registry()
    source = next(item for item in registry["sources"] if item["sourceId"] == "mozilla-common-voice")
    source["rightsEvidence"][0]["supportsClaims"] = ["PUBLIC_REPOSITORY"]
    assert "RIGHTS_EVIDENCE_CLAIM_KIND_MISMATCH" in {
        issue.code for issue in validate_source_registry(registry)
    }


def test_malformed_inventory_entry_fails_closed_without_crashing():
    audit = load_audit()
    audit["entries"][0]["classification"] = {"unexpected": "object"}
    assert validate_inventory(audit)

    audit = load_audit()
    audit["entries"][0]["digestMode"] = ["unexpected"]
    assert any(error.startswith("AUDIT_DIGEST_MODE_INVALID:") for error in validate_inventory(audit))


def test_root_license_does_not_claim_content_rights():
    content_policy = (REPOSITORY_ROOT / "CONTENT_LICENSES.md").read_text(encoding="utf-8").lower()
    assert "does not grant rights to third-party" in content_policy
    assert "not relicense them as mit" in content_policy
