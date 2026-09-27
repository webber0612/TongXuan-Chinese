from __future__ import annotations

import ast
import json
from copy import deepcopy
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

from app import open_curriculum_validator
from app.open_curriculum_validator import (
    SCHEMA_DIR,
    load_default_source_registry,
    validate_curriculum_pack,
    validate_source_registry,
)


SOURCE_ID = "tongxuan-original-authorship"


@pytest.fixture(autouse=True)
def synthetic_content_source_for_pack_fixtures(monkeypatch):
    """Keep synthetic pack fixtures independent from real source clearance."""
    sources = deepcopy(load_default_source_registry())
    source = next(item for item in sources["sources"] if item["sourceId"] == SOURCE_ID)
    source["legalStatus"] = "GREEN"
    source["validationOnly"] = False
    source["commercialUse"] = "CONDITIONAL"
    source["modificationAllowed"] = "CONDITIONAL"
    source["redistributionAllowed"] = "CONDITIONAL"
    source["attributionRequired"] = "CONDITIONAL"
    source["shareAlike"] = "CONDITIONAL"
    source["rawIngestionAllowed"] = "CONDITIONAL"
    source["publicRepoAllowed"] = "CONDITIONAL"
    source["derivativeUseAllowed"] = "CONDITIONAL"
    source["rightsEvidence"] = [{
        "evidenceId": "synthetic-only-rights-evidence",
        "evidenceKind": "LICENSE_NOTICE",
        "evidenceUrl": "https://example.invalid/synthetic-fixture-only",
        "locator": "Synthetic test fixture; not a real rights claim.",
        "observedAt": "2026-09-28",
        "captureMethod": "POLICY_TEXT",
        "supportsClaims": [
            "COMMERCIAL_USE", "MODIFICATION", "REDISTRIBUTION", "ATTRIBUTION",
            "SHARE_ALIKE", "RAW_INGESTION", "PUBLIC_REPOSITORY", "DERIVATIVE_USE",
        ],
        "claimSummary": "Synthetic fixture only; this record is never shipped or used as product provenance.",
    }]
    source["rightsDecision"] = {
        "policyId": "synthetic-test-only-policy",
        "outcome": "ALLOW_WITH_ITEM_CHECKS",
        "rationale": "Test-only override required to exercise successful pack validation.",
        "evidenceIds": ["synthetic-only-rights-evidence"],
    }
    monkeypatch.setattr(open_curriculum_validator, "load_default_source_registry", lambda: sources)


def evidence(evidence_id="synthetic-evidence", supports_claims=()):
    return {
        "evidenceId": evidence_id,
        "sourceId": SOURCE_ID,
        "authorityType": "AUTHORED_RATIONALE",
        "evidenceType": "synthetic validator fixture",
        "reference": "test-only fixture; no curriculum decision",
        "rationale": "Synthetic data only exercises the schema and validator.",
        "supportsClaims": list(supports_claims),
        "recordedAt": "2026-09-27",
        "reviewStatus": "EVIDENCE_CHECKED",
    }


def provenance():
    return {
        "sourceId": SOURCE_ID,
        "useMode": "CONTENT_SOURCE",
        "reference": "test-only synthetic fixture",
        "rawContentIncluded": False,
        "itemLicenseVerified": True,
        "itemRightsEvidence": {
            "createdBy": "synthetic fixture author",
            "createdAt": "2026-09-27",
            "rightsGrantReference": "test-only synthetic authorship record",
            "verifiedBy": "synthetic validator fixture",
            "verifiedAt": "2026-09-27",
            "publicRepoPermission": "YES",
            "rawIngestionPermission": "YES",
        },
    }


def core(target_id, target_type):
    evidence_id = f"evidence-{target_id}"
    return {
        "id": target_id,
        "targetType": target_type,
        "approvalStatus": "ARCHITECT_APPROVED",
        "rationale": "Synthetic validator fixture, not an approved product target.",
        "evidence": [evidence(evidence_id)],
        "difficultyEvidence": {
            "level": 1,
            "evidenceIds": [evidence_id],
            "rationale": "Fixture-only level value.",
        },
        "sourceProvenance": [provenance()],
    }


def make_pack():
    recognition = {
        **core("skill-recognition", "SKILL"),
        "skillId": "recognition",
        "domain": "recognition",
        "capability": "Synthetic recognition capability statement.",
        "description": "Synthetic test skill.",
        "level": 1,
        "prerequisites": [],
        "targetVocabulary": [],
        "targetGrammar": [],
        "targetCharacters": [],
        "productiveRequirement": {"required": False, "description": "fixture", "evidenceIds": []},
        "receptiveRequirement": {"required": True, "description": "fixture", "evidenceIds": ["evidence-skill-recognition"]},
    }
    writing = {
        **core("skill-writing", "SKILL"),
        "skillId": "writing",
        "domain": "writing",
        "capability": "Synthetic writing capability statement.",
        "description": "Synthetic test skill.",
        "level": 1,
        "prerequisites": ["recognition"],
        "targetVocabulary": [],
        "targetGrammar": [],
        "targetCharacters": [],
        "productiveRequirement": {"required": True, "description": "fixture", "evidenceIds": ["evidence-skill-writing"]},
        "receptiveRequirement": {"required": False, "description": "fixture", "evidenceIds": []},
    }
    vocabulary = {
        **core("vocab-demo", "VOCABULARY"),
        "evidence": [evidence(
            "evidence-vocab-demo",
            ["TARGET_DIFFICULTY", "RECEPTIVE_REQUIREMENT", "PRODUCTIVE_REQUIREMENT"],
        )],
        "traditional": "甲乙",
        "simplified": "甲乙",
        "pinyin": "jiǎ yǐ",
        "zhuyin": None,
        "meanings": {"en": "synthetic fixture"},
        "frequencyEvidence": [evidence("evidence-vocab-demo-frequency", ["VOCABULARY_FREQUENCY"])],
        "introducedBySkill": "recognition",
        "prerequisites": [],
        "requiresRecycling": False,
        "receptiveRequirement": {
            "required": True,
            "description": "Synthetic receptive role only.",
            "evidenceIds": ["evidence-vocab-demo"],
        },
        "productiveRequirement": {
            "required": False,
            "description": "Synthetic productive role only.",
            "evidenceIds": ["evidence-vocab-demo"],
        },
    }
    character = {
        **core("char-demo", "CHARACTER"),
        "character": "丙",
        "exposureLevel": 1,
        "recognitionLevel": 1,
        "readingLevel": 1,
        "writingLevel": 1,
        "readings": [{
            "script": "BOTH",
            "reading": "synthetic fixture reading",
            "sourceProvenance": [provenance()],
            "evidenceIds": ["evidence-char-demo"],
        }],
        "prerequisiteSkills": [],
    }
    grammar = {
        **core("grammar-demo", "GRAMMAR"),
        "evidence": [
            evidence("evidence-grammar-demo", ["TARGET_DIFFICULTY"]),
            evidence("evidence-grammar-level", ["TARGET_DIFFICULTY"]),
            evidence("evidence-grammar-example"),
            evidence("evidence-grammar-receptive", ["RECEPTIVE_REQUIREMENT"]),
            evidence("evidence-grammar-productive", ["PRODUCTIVE_REQUIREMENT"]),
            evidence("evidence-grammar-policy", ["RECEPTIVE_PRODUCTIVE_POLICY"]),
        ],
        "canonicalDescription": "Synthetic grammar schema fixture.",
        "levelEvidence": {
            "level": 1,
            "evidenceIds": ["evidence-grammar-level"],
            "rationale": "Fixture-only level value.",
        },
        "receptiveRequirement": {
            "required": True,
            "description": "Synthetic receptive grammar requirement.",
            "evidenceIds": ["evidence-grammar-receptive"],
        },
        "productiveRequirement": {
            "required": True,
            "description": "Synthetic productive grammar requirement.",
            "evidenceIds": ["evidence-grammar-productive"],
        },
        "receptiveProductivePolicy": "RECEPTIVE_BEFORE_PRODUCTIVE",
        "receptiveProductivePolicyEvidenceIds": ["evidence-grammar-policy"],
        "prerequisites": [],
        "examples": [{
            "text": "甲乙",
            "tokens": [{"id": "vocab-demo", "tokenType": "VOCABULARY", "text": "甲乙"}],
            "sourceProvenance": [provenance()],
            "evidenceIds": ["evidence-grammar-example"],
        }],
    }
    proposal_node = {
        **core("proposal-skill", "SKILL"),
        "approvalStatus": "PROPOSED",
        "skillId": "proposal-skill",
        "domain": "speaking",
        "capability": "Synthetic proposed speaking capability.",
        "description": "Synthetic proposal schema fixture.",
        "level": 1,
        "prerequisites": [],
        "targetVocabulary": [],
        "targetGrammar": [],
        "targetCharacters": [],
        "productiveRequirement": {"required": True, "description": "fixture", "evidenceIds": ["evidence-proposal-skill"]},
        "receptiveRequirement": {"required": False, "description": "fixture", "evidenceIds": []},
    }
    proposal_node["evidence"][0]["supportsClaims"] = ["TARGET_DIFFICULTY"]
    lesson = {
        "lessonId": "synthetic-lesson",
        "level": 1,
        "skillIds": ["recognition", "writing"],
        "availableSkillIds": ["recognition", "writing"],
        "priorKnowledgeSkillIds": ["recognition"],
        "priorRecognizedCharacterIds": [],
        "targetVocabularyIds": ["vocab-demo"],
        "targetGrammarIds": ["grammar-demo"],
        "targetCharacterIds": ["char-demo"],
        "availableTargetIds": ["vocab-demo", "grammar-demo", "char-demo"],
        "priorKnowledgeTargetIds": [],
        "newVocabularyIds": ["vocab-demo"],
        "recycledTargetIds": [],
        "sentences": [{
            "text": "甲乙。",
            "tokens": [{"id": "vocab-demo", "tokenType": "VOCABULARY", "text": "甲乙"}],
            "evidenceIds": ["evidence-vocab-demo"],
            "sourceProvenance": [provenance()],
        }],
        "activities": [
            {
                "activityId": "recognize-demo",
                "domain": "recognition",
                "targetIds": ["char-demo"],
                "masteryTargets": [{"skillId": "recognition", "domain": "recognition"}],
            },
            {
                "activityId": "write-demo",
                "domain": "writing",
                "targetIds": ["char-demo"],
                "masteryTargets": [],
            },
        ],
        "masteryTargets": [{"skillId": "recognition", "domain": "recognition"}],
        "sourceProvenance": [provenance()],
        "rationale": "Synthetic validator fixture only.",
        "approvalStatus": "ARCHITECT_APPROVED",
    }
    return {
        "schemaVersion": "1.4",
        "documentType": "CURRICULUM_PACK",
        "packId": "synthetic-pack",
        "publicationStatus": "PUBLISHABLE",
        "graph": {"skills": [recognition, writing], "vocabulary": [vocabulary], "grammar": [grammar], "characters": [character]},
        "lessons": [lesson],
        "curriculumChangeProposals": [{
            "proposalId": "synthetic-proposal",
            "documentType": "CURRICULUM_CHANGE_PROPOSAL",
            "changeType": "ADD_TARGET",
            "affectedTargetIds": [],
            "proposedNodes": [proposal_node],
            "whyNow": {
                "rationale": "Synthetic rationale only; it does not select a product target.",
                "evidenceIds": ["evidence-proposal-authority"],
            },
            "prerequisites": [],
            "authorityEvidenceIds": ["evidence-proposal-authority"],
            "difficultyEvidenceIds": ["evidence-proposal-difficulty", "evidence-proposal-skill"],
            "alternativesConsidered": [{
                "alternativeId": "synthetic-alternative",
                "description": "Synthetic alternative option.",
                "rationale": "Synthetic comparison only.",
                "evidenceIds": ["evidence-proposal-alternative"],
            }],
            "expectedCognitiveLoad": {"dimensions": [{
                "dimension": "speaking",
                "estimatedImpact": "Synthetic estimate only.",
                "targetIds": ["proposal-skill"],
                "rationale": "Synthetic load note.",
                "evidenceIds": ["evidence-proposal-load"],
            }]},
            "confidence": {
                "estimate": 0.5,
                "rationale": "Synthetic confidence estimate only.",
                "evidenceIds": ["evidence-proposal-confidence"],
                "limitations": ["Synthetic fixture; no learner evidence."],
            },
            "unresolvedQuestions": [],
            "rationale": "Synthetic schema fixture only; does not mutate the graph.",
            "evidence": [
                evidence("evidence-proposal-authority", ["CURRICULUM_AUTHORITY"]),
                evidence("evidence-proposal-difficulty", ["TARGET_DIFFICULTY"]),
                evidence("evidence-proposal-alternative", ["CURRICULUM_AUTHORITY"]),
                evidence("evidence-proposal-load", ["EXPECTED_COGNITIVE_LOAD"]),
                evidence("evidence-proposal-confidence", ["PROPOSAL_CONFIDENCE"]),
            ],
            "approvalStatus": "PROPOSED",
        }],
        "validationPolicy": {
            "policyId": "synthetic-approved-policy",
            "approved": True,
            "maxNewVocabularyRatio": 1.0,
            "evidenceIds": ["evidence-skill-recognition"],
        },
    }


def codes(issues):
    return {issue.code for issue in issues}


def test_registered_source_registry_and_all_schema_files_are_valid():
    sources = load_default_source_registry()
    assert validate_source_registry(sources) == []
    for path in SCHEMA_DIR.glob("*.schema.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)


def test_contract_wrappers_resolve_and_validate_their_graph_instances():
    pack = make_pack()
    sources = load_default_source_registry()
    bundle = json.loads((SCHEMA_DIR / "open-curriculum.schema.json").read_text(encoding="utf-8"))
    source_schema = json.loads((SCHEMA_DIR / "source-registry.schema.json").read_text(encoding="utf-8"))
    registry = Registry().with_resource(bundle["$id"], Resource.from_contents(bundle))
    registry = registry.with_resource(source_schema["$id"], Resource.from_contents(source_schema))
    instances = {
        "skill-node.schema.json": pack["graph"]["skills"][0],
        "vocabulary-node.schema.json": pack["graph"]["vocabulary"][0],
        "grammar-node.schema.json": pack["graph"]["grammar"][0],
        "character-node.schema.json": pack["graph"]["characters"][0],
        "evidence.schema.json": pack["graph"]["skills"][0]["evidence"][0],
        "source-provenance.schema.json": pack["graph"]["skills"][0]["sourceProvenance"][0],
        "approval-status.schema.json": "ARCHITECT_APPROVED",
        "curriculum-change-proposal.schema.json": pack["curriculumChangeProposals"][0],
        "source-registry.schema.json": sources,
    }
    for wrapper_name, instance in instances.items():
        wrapper = json.loads((SCHEMA_DIR / wrapper_name).read_text(encoding="utf-8"))
        Draft202012Validator(
            wrapper,
            registry=registry,
            format_checker=FormatChecker(),
        ).validate(instance)


def test_synthetic_publishable_pack_passes_composed_graph_schemas():
    assert validate_curriculum_pack(make_pack()) == []


def test_phase3_guard_matrix_covers_each_roadmap_guard_with_existing_regressions():
    repository_root = Path(__file__).resolve().parents[2]
    matrix_path = repository_root / "shared" / "open-curriculum" / "validator-guard-matrix.json"
    matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
    guards = matrix["guards"]
    assert [guard["id"] for guard in guards] == list(range(1, 16))

    allowed_statuses = {
        "COMPLETE",
        "PARTIAL",
        "BROKEN",
        "MISSING",
        "NEEDS_PRODUCT_DECISION",
        "NEEDS_REAL_CHILD_VALIDATION",
    }
    discovered_tests: dict[str, set[str]] = {}
    for guard in guards:
        assert guard["status"] in allowed_statuses
        assert guard["priority"] in {"P0", "P1", "P2"}
        assert guard["rule"]
        assert guard["remainingGap"]
        assert isinstance(guard["ownerDecision"], bool)
        assert guard["tests"]
        for reference in guard["tests"]:
            path = reference["file"]
            if path not in discovered_tests:
                module = ast.parse((repository_root / path).read_text(encoding="utf-8"))
                discovered_tests[path] = {
                    node.name
                    for node in ast.walk(module)
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
                }
            assert reference["name"] in discovered_tests[path], (
                f"Guard {guard['id']} references missing regression {path}:{reference['name']}"
            )


def test_skill_capability_is_required_by_graph_schema_v1_2():
    pack = make_pack()
    del pack["graph"]["skills"][0]["capability"]

    assert "SCHEMA_INVALID" in codes(validate_curriculum_pack(pack))


def test_lesson_schema_requires_explicit_prior_character_recognition_state():
    pack = make_pack()
    del pack["lessons"][0]["priorRecognizedCharacterIds"]

    assert "SCHEMA_INVALID" in codes(validate_curriculum_pack(pack))


def test_prior_recognition_declaration_fails_closed_for_wrong_or_not_yet_known_targets():
    pack = make_pack()
    pack["lessons"][0]["priorRecognizedCharacterIds"] = ["vocab-demo"]
    assert "UNSUPPORTED_PRIOR_RECOGNITION" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    pack["lessons"][0]["priorRecognizedCharacterIds"] = ["char-demo"]
    assert "PRIOR_RECOGNITION_NOT_KNOWN" in codes(validate_curriculum_pack(pack))


def test_publishable_pack_rejects_unapproved_target_and_policy():
    pack = make_pack()
    pack["graph"]["vocabulary"][0]["approvalStatus"] = "EVIDENCE_CHECKED"
    pack["validationPolicy"]["approved"] = False
    assert {"UNAPPROVED_TARGET", "VALIDATION_POLICY_NOT_APPROVED"} <= codes(validate_curriculum_pack(pack))


def test_publishable_pack_rejects_missing_provenance():
    pack = make_pack()
    del pack["graph"]["characters"][0]["sourceProvenance"]
    assert {"MISSING_PROVENANCE", "SCHEMA_INVALID"} <= codes(validate_curriculum_pack(pack))


def test_content_source_requires_registered_green_item_license_and_public_rights():
    for status in ("YELLOW", "RED", "UNKNOWN"):
        pack = make_pack()
        source_registry = load_default_source_registry()
        source = next(item for item in source_registry["sources"] if item["sourceId"] == SOURCE_ID)
        source["legalStatus"] = status
        pack["graph"]["vocabulary"][0]["sourceProvenance"] = [{
            "sourceId": SOURCE_ID,
            "useMode": "CONTENT_SOURCE",
            "reference": "synthetic fixture only",
            "rawContentIncluded": True,
            "itemLicenseVerified": False,
        }]
        found = codes(validate_curriculum_pack(pack, source_registry))
        assert {"SOURCE_NOT_GREEN", "ITEM_LICENSE_UNVERIFIED", "ITEM_RIGHTS_EVIDENCE_MISSING", "SOURCE_REDISTRIBUTION_NOT_CLEARED", "UNLICENSED_RAW_CONTENT", "SCHEMA_INVALID"} <= found


def test_publishable_content_cannot_be_marked_as_evidence_reference_only():
    for content_node in (
        lambda pack: pack["graph"]["vocabulary"][0],
        lambda pack: pack["graph"]["grammar"][0]["examples"][0],
        lambda pack: pack["lessons"][0]["sentences"][0],
        lambda pack: pack["curriculumChangeProposals"][0]["proposedNodes"][0],
    ):
        pack = make_pack()
        content_node(pack)["sourceProvenance"] = [{
            "sourceId": SOURCE_ID,
            "useMode": "EVIDENCE_REFERENCE",
            "reference": "synthetic evidence only",
            "rawContentIncluded": False,
            "itemLicenseVerified": False,
        }]
        assert "CONTENT_RIGHTS_EVIDENCE_REQUIRED" in codes(validate_curriculum_pack(pack))


def test_conditional_publication_rights_require_item_level_yes():
    pack = make_pack()
    pack["graph"]["vocabulary"][0]["sourceProvenance"][0]["itemRightsEvidence"]["publicRepoPermission"] = "UNKNOWN"
    assert {"SOURCE_REDISTRIBUTION_NOT_CLEARED", "CONTENT_RIGHTS_EVIDENCE_REQUIRED"} <= codes(validate_curriculum_pack(pack))


def test_unmet_prerequisite_and_out_of_level_targets_fail_closed():
    pack = make_pack()
    pack["graph"]["vocabulary"][0]["prerequisites"] = ["char-demo"]
    pack["graph"]["characters"][0]["recognitionLevel"] = 2
    assert {"UNMET_PREREQUISITE", "TARGET_OUT_OF_LEVEL"} <= codes(validate_curriculum_pack(pack))


@pytest.mark.parametrize(
    "target_type",
    ["vocabulary", "grammar"],
)
def test_vocabulary_and_grammar_targets_above_lesson_level_fail_closed(target_type):
    pack = make_pack()
    target = pack["graph"][target_type][0]
    target["difficultyEvidence"]["level"] = 2

    assert "TARGET_OUT_OF_LEVEL" in codes(validate_curriculum_pack(pack))


def test_graph_relationships_resolve_across_domains_without_approving_new_targets():
    pack = make_pack()
    pack["graph"]["skills"][0]["targetVocabulary"] = ["vocab-demo"]
    pack["graph"]["skills"][0]["targetGrammar"] = ["grammar-demo"]
    pack["graph"]["skills"][0]["targetCharacters"] = ["char-demo"]
    pack["graph"]["vocabulary"][0]["prerequisites"] = ["recognition"]
    pack["graph"]["grammar"][0]["prerequisites"] = ["recognition"]
    pack["graph"]["characters"][0]["prerequisiteSkills"] = ["recognition"]

    assert validate_curriculum_pack(pack) == []


def test_graph_relationships_reject_missing_and_wrong_type_references():
    pack = make_pack()
    pack["graph"]["skills"][0]["prerequisites"] = ["missing-skill"]
    pack["graph"]["skills"][0]["targetVocabulary"] = ["grammar-demo"]
    pack["graph"]["skills"][0]["targetGrammar"] = ["missing-grammar"]
    pack["graph"]["skills"][0]["targetCharacters"] = ["vocab-demo"]
    pack["graph"]["vocabulary"][0]["introducedBySkill"] = "missing-skill"
    pack["graph"]["vocabulary"][0]["prerequisites"] = ["missing-target"]
    pack["graph"]["grammar"][0]["prerequisites"] = ["missing-target"]
    pack["graph"]["characters"][0]["prerequisiteSkills"] = ["vocab-demo"]

    found = validate_curriculum_pack(pack)
    assert {"UNREGISTERED_GRAPH_REFERENCE", "GRAPH_REFERENCE_TYPE_MISMATCH"} <= codes(found)
    assert sum(issue.code == "UNREGISTERED_GRAPH_REFERENCE" for issue in found) >= 5
    assert sum(issue.code == "GRAPH_REFERENCE_TYPE_MISMATCH" for issue in found) >= 3


def test_graph_evidence_references_must_resolve_within_the_pack():
    pack = make_pack()
    pack["graph"]["skills"][0]["productiveRequirement"]["evidenceIds"] = ["missing-evidence"]

    assert "EVIDENCE_NOT_REGISTERED" in codes(validate_curriculum_pack(pack))


def test_vocabulary_and_grammar_require_explicit_learning_contracts():
    pack = make_pack()
    del pack["graph"]["vocabulary"][0]["receptiveRequirement"]
    del pack["graph"]["grammar"][0]["receptiveProductivePolicy"]

    assert "SCHEMA_INVALID" in codes(validate_curriculum_pack(pack))


def test_vocabulary_and_grammar_claim_evidence_must_be_node_local_and_claim_specific():
    pack = make_pack()
    pack["graph"]["vocabulary"][0]["productiveRequirement"]["evidenceIds"] = ["evidence-skill-recognition"]
    pack["graph"]["grammar"][0]["receptiveProductivePolicyEvidenceIds"] = ["evidence-skill-writing"]

    found = codes(validate_curriculum_pack(pack))
    assert "CROSS_NODE_GRAPH_EVIDENCE" in found

    pack = make_pack()
    pack["graph"]["vocabulary"][0]["evidence"][0]["supportsClaims"] = ["TARGET_DIFFICULTY"]
    assert "GRAPH_EVIDENCE_CLAIM_MISMATCH" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    pack["graph"]["vocabulary"][0]["frequencyEvidence"][0]["supportsClaims"] = []
    assert "GRAPH_EVIDENCE_CLAIM_MISMATCH" in codes(validate_curriculum_pack(pack))


def test_publishable_graph_claims_reject_unreviewed_and_rejected_evidence():
    pack = make_pack()
    pack["graph"]["vocabulary"][0]["evidence"][0]["reviewStatus"] = "PROPOSED"
    pack["graph"]["grammar"][0]["evidence"][0]["reviewStatus"] = "REJECTED"

    found = codes(validate_curriculum_pack(pack))
    assert "GRAPH_CLAIM_EVIDENCE_UNVERIFIED" in found


def test_approved_graph_claims_reject_unreviewed_evidence_in_proposed_pack():
    pack = make_pack()
    pack["publicationStatus"] = "PROPOSED"
    pack["graph"]["vocabulary"][0]["evidence"][0]["reviewStatus"] = "REJECTED"

    found = codes(validate_curriculum_pack(pack))
    assert "GRAPH_CLAIM_EVIDENCE_UNVERIFIED" in found

    pack = make_pack()
    pack["publicationStatus"] = "PROPOSED"
    pack["graph"]["vocabulary"][0]["frequencyEvidence"][0]["reviewStatus"] = "PROPOSED"

    found = codes(validate_curriculum_pack(pack))
    assert "GRAPH_CLAIM_EVIDENCE_UNVERIFIED" in found


def test_unresolved_grammar_policy_fails_closed_for_approved_or_publishable_nodes():
    pack = make_pack()
    pack["graph"]["grammar"][0]["receptiveProductivePolicy"] = "UNRESOLVED"
    pack["graph"]["grammar"][0]["receptiveProductivePolicyEvidenceIds"] = []
    assert "UNRESOLVED_GRAMMAR_SEQUENCE_POLICY" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    pack["publicationStatus"] = "PROPOSED"
    pack["graph"]["grammar"][0]["approvalStatus"] = "EVIDENCE_CHECKED"
    pack["graph"]["grammar"][0]["receptiveProductivePolicy"] = "UNRESOLVED"
    pack["graph"]["grammar"][0]["receptiveProductivePolicyEvidenceIds"] = []
    assert "UNRESOLVED_GRAMMAR_SEQUENCE_POLICY" not in codes(validate_curriculum_pack(pack))


def test_grammar_sequence_policy_must_match_learning_requirements():
    pack = make_pack()
    pack["graph"]["grammar"][0]["receptiveRequirement"]["required"] = False
    assert "GRAMMAR_SEQUENCE_POLICY_INCONSISTENT" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    pack["graph"]["grammar"][0]["receptiveProductivePolicy"] = "NOT_APPLICABLE"
    assert "GRAMMAR_SEQUENCE_POLICY_INCONSISTENT" in codes(validate_curriculum_pack(pack))


@pytest.mark.parametrize(
    ("policy", "productive_required"),
    [
        ("RECEPTIVE_BEFORE_PRODUCTIVE", True),
        ("NO_ORDER_CONSTRAINT", True),
        ("NOT_APPLICABLE", False),
    ],
)
def test_explicit_grammar_sequence_policies_validate(policy, productive_required):
    pack = make_pack()
    grammar = pack["graph"]["grammar"][0]
    grammar["receptiveProductivePolicy"] = policy
    grammar["productiveRequirement"]["required"] = productive_required
    assert validate_curriculum_pack(pack) == []


def test_graph_rejects_skill_alias_collisions_with_skills_and_target_ids():
    pack = make_pack()
    pack["graph"]["skills"][1]["skillId"] = "recognition"
    assert "SKILL_ALIAS_COLLISION" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    pack["graph"]["skills"][1]["skillId"] = "vocab-demo"
    assert "SKILL_ALIAS_COLLISION" in codes(validate_curriculum_pack(pack))


def test_graph_rejects_self_prerequisite_and_cross_target_cycles():
    pack = make_pack()
    pack["graph"]["grammar"][0]["prerequisites"] = ["grammar-demo"]
    assert "SELF_PREREQUISITE" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    pack["graph"]["vocabulary"][0]["prerequisites"] = ["grammar-demo"]
    pack["graph"]["grammar"][0]["prerequisites"] = ["vocab-demo"]
    found = validate_curriculum_pack(pack)
    cycle_issues = [issue for issue in found if issue.code == "GRAPH_PREREQUISITE_CYCLE"]
    assert len(cycle_issues) == 1
    assert "grammar-demo" in cycle_issues[0].message
    assert "vocab-demo" in cycle_issues[0].message


def test_exposure_only_character_does_not_require_or_infer_later_stages():
    pack = make_pack()
    character = pack["graph"]["characters"][0]
    character["recognitionLevel"] = None
    character["readingLevel"] = None
    character["writingLevel"] = None
    pack["lessons"][0]["activities"] = [{
        "activityId": "expose-character",
        "domain": "character_exposure",
        "targetIds": ["char-demo"],
        "masteryTargets": [],
    }]

    assert validate_curriculum_pack(pack) == []

    pack["lessons"][0]["activities"].append({
        "activityId": "write-exposure-only-character",
        "domain": "writing",
        "targetIds": ["char-demo"],
        "masteryTargets": [],
    })
    assert "WRITING_LEVEL_UNSUPPORTED" in codes(validate_curriculum_pack(pack))


def test_exposure_activity_uses_its_own_level_not_the_later_recognition_level():
    pack = make_pack()
    character = pack["graph"]["characters"][0]
    character["exposureLevel"] = 1
    character["recognitionLevel"] = 2
    character["readingLevel"] = None
    character["writingLevel"] = 2
    pack["lessons"][0]["activities"] = [{
        "activityId": "expose-before-recognition",
        "domain": "character_exposure",
        "targetIds": ["char-demo"],
        "masteryTargets": [],
    }]

    assert validate_curriculum_pack(pack) == []


def test_nonrequired_exposure_stage_is_null_and_cannot_back_an_exposure_activity():
    pack = make_pack()
    pack["graph"]["characters"][0]["exposureLevel"] = None

    assert validate_curriculum_pack(pack) == []

    pack["lessons"][0]["activities"].append({
        "activityId": "expose-without-exposure-stage",
        "domain": "character_exposure",
        "targetIds": ["char-demo"],
        "masteryTargets": [],
    })
    assert "EXPOSURE_LEVEL_UNSUPPORTED" in codes(validate_curriculum_pack(pack))


def test_character_writing_requires_a_recognition_stage_and_cannot_precede_it():
    pack = make_pack()
    pack["graph"]["characters"][0]["recognitionLevel"] = None
    assert "CHARACTER_WRITING_WITHOUT_RECOGNITION" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    pack["graph"]["characters"][0]["recognitionLevel"] = 2
    pack["graph"]["characters"][0]["writingLevel"] = 1
    assert "CHARACTER_WRITING_BEFORE_RECOGNITION" in codes(validate_curriculum_pack(pack))


def test_recognition_activity_requires_an_explicit_recognition_level():
    pack = make_pack()
    character = pack["graph"]["characters"][0]
    character["recognitionLevel"] = None
    character["writingLevel"] = None

    assert "RECOGNITION_LEVEL_UNSUPPORTED" in codes(validate_curriculum_pack(pack))


def test_exposure_in_one_lesson_does_not_satisfy_later_writing_recognition_gate():
    pack = make_pack()
    character = pack["graph"]["characters"][0]
    character["exposureLevel"] = 1
    character["recognitionLevel"] = 2
    character["readingLevel"] = None
    character["writingLevel"] = 2

    first = pack["lessons"][0]
    first["level"] = 1
    first["activities"] = [{
        "activityId": "expose-character",
        "domain": "character_exposure",
        "targetIds": ["char-demo"],
        "masteryTargets": [],
    }]
    second = deepcopy(first)
    second["lessonId"] = "synthetic-lesson-2"
    second["level"] = 2
    second["priorKnowledgeTargetIds"] = ["char-demo", "vocab-demo"]
    second["priorRecognizedCharacterIds"] = []
    second["newVocabularyIds"] = []
    second["recycledTargetIds"] = ["vocab-demo"]
    second["activities"] = [{
        "activityId": "write-character",
        "domain": "writing",
        "targetIds": ["char-demo"],
        "masteryTargets": [],
    }]
    pack["lessons"].append(second)

    assert "WRITING_BEFORE_RECOGNITION" in codes(validate_curriculum_pack(pack))

    second["priorRecognizedCharacterIds"] = ["char-demo"]
    assert validate_curriculum_pack(pack) == []


def test_character_reading_activity_requires_an_explicit_reading_level():
    pack = make_pack()
    pack["graph"]["characters"][0]["readingLevel"] = None
    pack["lessons"][0]["activities"].append({
        "activityId": "read-character",
        "domain": "character_reading",
        "targetIds": ["char-demo"],
        "masteryTargets": [],
    })

    assert "READING_LEVEL_UNSUPPORTED" in codes(validate_curriculum_pack(pack))


def test_graph_prerequisite_cycle_diagnostics_are_deterministic():
    pack = make_pack()
    pack["graph"]["skills"][0]["prerequisites"] = ["writing"]
    pack["graph"]["skills"][1]["prerequisites"] = ["recognition"]

    first = validate_curriculum_pack(pack)
    second = validate_curriculum_pack(pack)
    first_cycles = [issue for issue in first if issue.code == "GRAPH_PREREQUISITE_CYCLE"]
    second_cycles = [issue for issue in second if issue.code == "GRAPH_PREREQUISITE_CYCLE"]
    assert first_cycles == second_cycles
    assert len(first_cycles) == 1


def test_graph_cycle_detection_handles_a_chain_deeper_than_python_recursion_limit():
    pack = make_pack()
    template = pack["graph"]["skills"][0]
    node_count = 1_050
    skills = []
    for index in range(node_count):
        node = deepcopy(template)
        evidence_id = f"evidence-cycle-skill-{index:04d}"
        node["id"] = f"skill-node-{index:04d}"
        node["skillId"] = f"skill-{index:04d}"
        node["prerequisites"] = [f"skill-{(index + 1) % node_count:04d}"]
        node["evidence"] = [evidence(evidence_id)]
        node["difficultyEvidence"]["evidenceIds"] = [evidence_id]
        node["receptiveRequirement"]["evidenceIds"] = [evidence_id]
        skills.append(node)
    pack["graph"]["skills"] = skills
    pack["graph"]["vocabulary"][0]["introducedBySkill"] = "skill-0000"
    lesson = pack["lessons"][0]
    lesson["skillIds"] = ["skill-0000"]
    lesson["availableSkillIds"] = ["skill-0000"]
    lesson["priorKnowledgeSkillIds"] = ["skill-0000"]
    lesson["masteryTargets"] = []
    for activity in lesson["activities"]:
        activity["masteryTargets"] = []

    assert "GRAPH_PREREQUISITE_CYCLE" in codes(validate_curriculum_pack(pack))


def test_unregistered_targets_and_sources_fail_closed():
    pack = make_pack()
    pack["lessons"][0]["targetCharacterIds"] = ["unregistered-character"]
    pack["graph"]["vocabulary"][0]["sourceProvenance"][0]["sourceId"] = "unknown-source"
    assert {"UNREGISTERED_TARGET", "SOURCE_NOT_REGISTERED"} <= codes(validate_curriculum_pack(pack))


def test_new_vocabulary_ratio_is_checked_only_with_explicit_approved_limit():
    pack = make_pack()
    pack["validationPolicy"]["maxNewVocabularyRatio"] = 0.5
    assert "NEW_VOCABULARY_RATIO_EXCEEDED" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    pack["validationPolicy"].pop("maxNewVocabularyRatio")
    assert "NEW_VOCABULARY_LIMIT_REQUIRED" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    pack["publicationStatus"] = "PROPOSED"
    pack["validationPolicy"].pop("maxNewVocabularyRatio")
    assert "NEW_VOCABULARY_LIMIT_REQUIRED" not in codes(validate_curriculum_pack(pack))


@pytest.mark.parametrize("invalid_limit", [float("nan"), float("inf"), float("-inf")])
def test_non_finite_new_vocabulary_limit_fails_closed(invalid_limit):
    pack = make_pack()
    pack["validationPolicy"]["maxNewVocabularyRatio"] = invalid_limit
    issues = codes(validate_curriculum_pack(pack))

    assert "NEW_VOCABULARY_LIMIT_INVALID" in issues
    assert "NEW_VOCABULARY_RATIO_EXCEEDED" not in issues


@pytest.mark.parametrize("constant", ["NaN", "Infinity", "-Infinity"])
def test_json_reader_rejects_non_standard_non_finite_constants(tmp_path, constant):
    path = tmp_path / "non-standard.json"
    path.write_text(f'{{"maxNewVocabularyRatio": {constant}}}', encoding="utf-8")

    with pytest.raises(ValueError, match="Non-standard JSON numeric constant"):
        open_curriculum_validator._read_json(path)


def test_recycling_must_be_known_used_and_not_marked_new():
    pack = make_pack()
    pack["lessons"][0]["recycledTargetIds"] = ["vocab-demo"]
    assert "UNMET_RECYCLING" in codes(validate_curriculum_pack(pack))

    pack["lessons"][0]["priorKnowledgeTargetIds"] = ["vocab-demo"]
    assert "KNOWN_VOCABULARY_MARKED_NEW" in codes(validate_curriculum_pack(pack))
    assert "NEW_TARGET_MARKED_RECYCLED" in codes(validate_curriculum_pack(pack))


def test_required_recycling_cannot_be_omitted_for_known_vocabulary():
    pack = make_pack()
    pack["graph"]["vocabulary"][0]["requiresRecycling"] = True
    pack["lessons"][0]["priorKnowledgeTargetIds"] = ["vocab-demo"]
    pack["lessons"][0]["newVocabularyIds"] = []

    assert "RECYCLING_REQUIRED" in codes(validate_curriculum_pack(pack))


def test_writing_activity_requires_recognition_first():
    pack = make_pack()
    pack["lessons"][0]["activities"].reverse()
    assert "WRITING_BEFORE_RECOGNITION" in codes(validate_curriculum_pack(pack))


def test_each_lesson_gets_activity_and_mastery_validation():
    pack = make_pack()
    invalid_first = deepcopy(pack["lessons"][0])
    invalid_first["activities"].reverse()
    invalid_first["activities"][1]["masteryTargets"] = [{
        "skillId": "unregistered-skill",
        "domain": "writing",
    }]
    valid_second = deepcopy(pack["lessons"][0])
    valid_second["lessonId"] = "valid-second-lesson"
    pack["lessons"] = [invalid_first, valid_second]

    found = codes(validate_curriculum_pack(pack))
    assert {"WRITING_BEFORE_RECOGNITION", "UNSUPPORTED_ACTIVITY_MASTERY_TARGET"} <= found


def test_prior_knowledge_accumulates_between_pack_lessons():
    pack = make_pack()
    first = deepcopy(pack["lessons"][0])
    second = deepcopy(pack["lessons"][0])
    second.update({
        "lessonId": "second-lesson",
        "skillIds": ["writing"],
        "availableSkillIds": ["writing"],
        "priorKnowledgeSkillIds": [],
        "targetVocabularyIds": [],
        "targetGrammarIds": [],
        "targetCharacterIds": [],
        "availableTargetIds": [],
        "newVocabularyIds": [],
        "recycledTargetIds": [],
        "sentences": [],
        "activities": [],
        "masteryTargets": [],
    })
    pack["lessons"] = [first, second]

    assert "UNMET_PREREQUISITE" not in codes(validate_curriculum_pack(pack))


def test_sentence_tokens_must_be_registered_and_match_sentence_text():
    pack = make_pack()
    sentence = pack["lessons"][0]["sentences"][0]
    sentence["tokens"] = [{"id": "unregistered-character", "tokenType": "CHARACTER", "text": "丙"}]
    sentence["text"] = "丙。"
    assert {"UNREGISTERED_SENTENCE_TOKEN", "UNREGISTERED_SENTENCE_TEXT"} <= codes(validate_curriculum_pack(pack))


def test_sentence_rejects_mismatched_registered_token_and_uncovered_text():
    pack = make_pack()
    sentence = pack["lessons"][0]["sentences"][0]
    sentence["tokens"] = [{"id": "vocab-demo", "tokenType": "VOCABULARY", "text": "未登錄詞"}]
    sentence["text"] = "未登錄詞"
    assert "SENTENCE_TOKEN_TEXT_MISMATCH" in codes(validate_curriculum_pack(pack))

    pack = make_pack()
    sentence = pack["lessons"][0]["sentences"][0]
    sentence["text"] += "未登錄"
    assert "UNREGISTERED_SENTENCE_TEXT" in codes(validate_curriculum_pack(pack))


def test_grammar_examples_also_require_registered_character_tokens():
    pack = make_pack()
    example = pack["graph"]["grammar"][0]["examples"][0]
    example["tokens"] = [{"id": "unregistered-character", "tokenType": "CHARACTER", "text": "丙"}]
    example["text"] = "丙"
    assert {"UNREGISTERED_SENTENCE_TOKEN", "UNREGISTERED_SENTENCE_TEXT"} <= codes(validate_curriculum_pack(pack))


def test_mastery_targets_must_map_to_registered_lesson_skill():
    pack = make_pack()
    pack["lessons"][0]["masteryTargets"] = [{"skillId": "unknown", "domain": "reading"}]
    assert "UNSUPPORTED_MASTERY_TARGET" in codes(validate_curriculum_pack(pack))


def test_mastery_target_domain_must_match_registered_skill():
    pack = make_pack()
    pack["lessons"][0]["masteryTargets"] = [{"skillId": "recognition", "domain": "writing"}]

    assert "UNSUPPORTED_MASTERY_DOMAIN" in codes(validate_curriculum_pack(pack))


def test_approved_proposal_node_does_not_become_a_lesson_graph_skill():
    pack = make_pack()
    proposal = pack["curriculumChangeProposals"][0]
    proposal["approvalStatus"] = "ARCHITECT_APPROVED"
    proposal["proposedNodes"][0]["approvalStatus"] = "ARCHITECT_APPROVED"
    pack["lessons"][0]["skillIds"] = ["proposal-skill"]
    pack["lessons"][0]["availableSkillIds"] = ["proposal-skill"]

    assert "UNREGISTERED_SKILL" in codes(validate_curriculum_pack(pack))


@pytest.mark.parametrize(
    "required_field",
    [
        "whyNow",
        "prerequisites",
        "authorityEvidenceIds",
        "difficultyEvidenceIds",
        "alternativesConsidered",
        "expectedCognitiveLoad",
        "confidence",
        "unresolvedQuestions",
    ],
)
def test_proposal_contract_requires_all_explanation_fields(required_field):
    pack = make_pack()
    del pack["curriculumChangeProposals"][0][required_field]

    assert "SCHEMA_INVALID" in codes(validate_curriculum_pack(pack))


def test_proposal_evidence_must_be_local_and_support_the_declared_claim():
    pack = make_pack()
    proposal = pack["curriculumChangeProposals"][0]
    proposal["authorityEvidenceIds"] = ["evidence-skill-recognition"]
    assert "PROPOSAL_EVIDENCE_NOT_LOCAL" in codes(validate_curriculum_pack(pack))

    proposal["authorityEvidenceIds"] = ["evidence-proposal-difficulty"]
    assert "PROPOSAL_EVIDENCE_CLAIM_MISMATCH" in codes(validate_curriculum_pack(pack))


def test_proposal_prerequisites_and_cognitive_load_targets_resolve():
    pack = make_pack()
    proposal = pack["curriculumChangeProposals"][0]
    proposal["prerequisites"] = [{"targetId": "missing-target", "rationale": "synthetic test"}]
    proposal["expectedCognitiveLoad"]["dimensions"][0]["targetIds"] = ["missing-target"]
    issue_codes = codes(validate_curriculum_pack(pack))
    assert "PROPOSAL_PREREQUISITE_NOT_REGISTERED" in issue_codes
    assert "PROPOSAL_LOAD_TARGET_NOT_DECLARED" in issue_codes

    proposal["prerequisites"] = [{"targetId": "vocab-demo", "rationale": "synthetic graph prerequisite"}]
    proposal["expectedCognitiveLoad"]["dimensions"][0]["targetIds"] = ["proposal-skill"]
    assert validate_curriculum_pack(pack) == []


def test_non_add_proposal_nodes_match_the_affected_target_identity_and_type():
    pack = make_pack()
    proposal = pack["curriculumChangeProposals"][0]
    proposal["changeType"] = "MODIFY_TARGET"
    proposal["affectedTargetIds"] = ["vocab-demo"]

    issue_codes = codes(validate_curriculum_pack(pack))
    assert "PROPOSAL_NODE_NOT_AFFECTED" in issue_codes
    assert "PROPOSAL_AFFECTED_TARGET_NOT_PROPOSED" in issue_codes

    proposal["proposedNodes"][0]["id"] = "vocab-demo"
    issue_codes = codes(validate_curriculum_pack(pack))
    assert "PROPOSAL_TARGET_TYPE_MISMATCH" in issue_codes


def test_remove_target_proposal_identifies_target_without_replacement_node():
    pack = make_pack()
    proposal = pack["curriculumChangeProposals"][0]
    proposal["changeType"] = "REMOVE_TARGET"
    proposal["affectedTargetIds"] = ["vocab-demo"]
    proposal["proposedNodes"] = []
    proposal["difficultyEvidenceIds"] = ["evidence-proposal-difficulty"]
    proposal["expectedCognitiveLoad"]["dimensions"][0]["targetIds"] = ["vocab-demo"]

    assert validate_curriculum_pack(pack) == []


@pytest.mark.parametrize(
    "mutate",
    [
        lambda proposal: proposal["confidence"].pop("limitations"),
        lambda proposal: proposal["expectedCognitiveLoad"]["dimensions"][0].pop("evidenceIds"),
        lambda proposal: proposal["expectedCognitiveLoad"]["dimensions"][0].update({"targetIds": []}),
    ],
    ids=["missing-confidence-limitations", "missing-load-evidence", "empty-load-targets"],
)
def test_malformed_proposal_confidence_and_load_records_fail_schema(mutate):
    pack = make_pack()
    mutate(pack["curriculumChangeProposals"][0])

    assert "SCHEMA_INVALID" in codes(validate_curriculum_pack(pack))


@pytest.mark.parametrize("invalid_confidence", [float("nan"), float("inf"), -0.1, 1.1])
def test_proposal_confidence_must_be_finite_and_in_range(invalid_confidence):
    pack = make_pack()
    pack["curriculumChangeProposals"][0]["confidence"]["estimate"] = invalid_confidence

    assert "PROPOSAL_CONFIDENCE_INVALID" in codes(validate_curriculum_pack(pack))


def test_proposal_and_proposed_nodes_cannot_self_approve_or_mutate_graph():
    pack = make_pack()
    graph_before = deepcopy(pack["graph"])
    proposal = pack["curriculumChangeProposals"][0]
    proposal["approvalStatus"] = "ARCHITECT_APPROVED"
    proposal["proposedNodes"][0]["approvalStatus"] = "ARCHITECT_APPROVED"
    issue_codes = codes(validate_curriculum_pack(pack))

    assert "PROPOSAL_APPROVAL_NOT_AUTHENTICATED" in issue_codes
    assert "PROPOSAL_TARGET_APPROVAL_NOT_AUTHENTICATED" in issue_codes
    assert pack["graph"] == graph_before


def test_multiple_proposals_with_duplicate_identity_and_new_target_fail_closed():
    pack = make_pack()
    duplicate = deepcopy(pack["curriculumChangeProposals"][0])
    pack["curriculumChangeProposals"].append(duplicate)

    issue_codes = codes(validate_curriculum_pack(pack))
    assert "DUPLICATE_PROPOSAL_ID" in issue_codes
    assert "DUPLICATE_PROPOSED_TARGET_ID" in issue_codes


def test_source_provenance_cannot_smuggle_raw_text_as_evidence_reference():
    pack = make_pack()
    pack["lessons"][0]["sourceProvenance"][0]["useMode"] = "EVIDENCE_REFERENCE"
    pack["lessons"][0]["sourceProvenance"][0]["rawContentIncluded"] = True
    assert "RAW_CONTENT_AS_EVIDENCE" in codes(validate_curriculum_pack(pack))


def test_registry_rejects_invalid_license_status():
    sources = load_default_source_registry()
    sources["sources"][0]["legalStatus"] = "MAYBE"
    assert "SCHEMA_INVALID" in codes(validate_source_registry(sources))


@pytest.mark.parametrize("wrapper", [
    "skill-node.schema.json",
    "vocabulary-node.schema.json",
    "grammar-node.schema.json",
    "character-node.schema.json",
    "evidence.schema.json",
    "source-provenance.schema.json",
    "approval-status.schema.json",
    "curriculum-change-proposal.schema.json",
    "source-registry.schema.json",
])
def test_contract_inventory_contains_required_wrappers(wrapper):
    assert (SCHEMA_DIR / wrapper).is_file()
