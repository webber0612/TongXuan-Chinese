"""Deterministic authority and consistency checks for proposed curriculum packs.

This module validates proposals only. It does not generate targets, choose the
next lesson, approve curriculum, or import source content.
"""

from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Mapping

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource


ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "shared" / "open-curriculum" / "schemas"
PACK_SCHEMA_PATH = SCHEMA_DIR / "open-curriculum.schema.json"
SOURCE_SCHEMA_PATH = SCHEMA_DIR / "source-registry.schema.json"
SOURCE_REGISTRY_PATH = ROOT / "shared" / "content-sources" / "source-registry.json"
EVIDENCE_KIND_ALLOWED_CLAIMS = {
    "LICENSE_NOTICE": {
        "LICENSE_IDENTITY",
        "COMMERCIAL_USE",
        "MODIFICATION",
        "REDISTRIBUTION",
        "ATTRIBUTION",
        "SHARE_ALIKE",
        "RAW_INGESTION",
        "PUBLIC_REPOSITORY",
        "DERIVATIVE_USE",
        "ITEM_LEVEL_LICENSE",
        "AUDIO_LICENSE_SCOPE",
    },
    "TERMS_OF_USE": {
        "LICENSE_IDENTITY",
        "COMMERCIAL_USE",
        "MODIFICATION",
        "REDISTRIBUTION",
        "ATTRIBUTION",
        "SHARE_ALIKE",
        "RAW_INGESTION",
        "PUBLIC_REPOSITORY",
        "DERIVATIVE_USE",
        "ITEM_LEVEL_LICENSE",
        "AUDIO_LICENSE_SCOPE",
    },
    "SOURCE_DESCRIPTION": {"SOURCE_DESCRIPTION"},
    "PROJECT_POLICY": {"PROJECT_POLICY", "CONTENT_LICENSE_SEPARATION"},
    "INACCESSIBLE_PRIMARY_SOURCE": {"SOURCE_ACCESS_STATUS"},
}


@dataclass(frozen=True, order=True)
class ValidationIssue:
    code: str
    path: str
    message: str


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _registry_for(*schemas: Mapping[str, Any]) -> Registry:
    registry = Registry()
    for schema in schemas:
        registry = registry.with_resource(
            str(schema["$id"]), Resource.from_contents(dict(schema))
        )
    return registry


def _schema_issues(
    instance: Any,
    schema: Mapping[str, Any],
    registry: Registry,
) -> list[ValidationIssue]:
    validator = Draft202012Validator(
        schema,
        registry=registry,
        format_checker=FormatChecker(),
    )
    issues: list[ValidationIssue] = []
    for error in validator.iter_errors(instance):
        path = "/" + "/".join(str(part) for part in error.absolute_path)
        issues.append(
            ValidationIssue(
                "SCHEMA_INVALID",
                path,
                error.message,
            )
        )
    return issues


def validate_source_registry(source_registry: Mapping[str, Any]) -> list[ValidationIssue]:
    """Validate source registry structure, evidence links, and fail-closed decisions."""
    pack_schema = _read_json(PACK_SCHEMA_PATH)
    source_schema = _read_json(SOURCE_SCHEMA_PATH)
    registry = _registry_for(pack_schema, source_schema)
    issues = _schema_issues(source_registry, source_schema, registry)
    if isinstance(source_registry, Mapping):
        allowed = source_registry.get("allowedLegalStatuses", [])
        required = {"GREEN", "YELLOW", "RED", "UNKNOWN"}
        allowed_is_valid = isinstance(allowed, list) and all(isinstance(item, str) for item in allowed)
        if not allowed_is_valid or set(allowed) != required:
            issues.append(ValidationIssue("SOURCE_STATUS_SET_INVALID", "/allowedLegalStatuses", "The source registry must support exactly GREEN, YELLOW, RED, and UNKNOWN."))
        seen: set[str] = set()
        global_evidence_ids: set[str] = set()
        records = source_registry.get("sources", [])
        if isinstance(records, list):
            evidence_by_source: dict[str, set[str]] = {}
            for index, source in enumerate(records):
                if not isinstance(source, Mapping):
                    continue
                source_id = source.get("sourceId")
                if isinstance(source_id, str) and source_id in seen:
                    issues.append(ValidationIssue("SOURCE_ID_DUPLICATE", f"/sources/{index}/sourceId", f"Source ID {source_id!r} is duplicated."))
                if isinstance(source_id, str) and source_id:
                    seen.add(source_id)
                if isinstance(allowed, list) and source.get("legalStatus") not in allowed:
                    issues.append(ValidationIssue("SOURCE_STATUS_NOT_ALLOWED", f"/sources/{index}/legalStatus", "Each source status must appear in allowedLegalStatuses."))

                source_evidence_ids: set[str] = set()
                evidence_records = source.get("rightsEvidence", [])
                if isinstance(evidence_records, list):
                    for evidence_index, evidence in enumerate(evidence_records):
                        if not isinstance(evidence, Mapping):
                            continue
                        evidence_id = evidence.get("evidenceId")
                        if not isinstance(evidence_id, str) or not evidence_id:
                            continue
                        evidence_path = f"/sources/{index}/rightsEvidence/{evidence_index}/evidenceId"
                        if evidence_id in global_evidence_ids:
                            issues.append(ValidationIssue("RIGHTS_EVIDENCE_ID_DUPLICATE", evidence_path, f"Evidence ID {evidence_id!r} must be globally unique."))
                        global_evidence_ids.add(evidence_id)
                        source_evidence_ids.add(evidence_id)
                        evidence_kind = evidence.get("evidenceKind")
                        allowed_claims = EVIDENCE_KIND_ALLOWED_CLAIMS.get(evidence_kind, set()) if isinstance(evidence_kind, str) else set()
                        claims = evidence.get("supportsClaims", [])
                        if isinstance(claims, list) and any(
                            not isinstance(claim, str) or claim not in allowed_claims
                            for claim in claims
                        ):
                            issues.append(ValidationIssue(
                                "RIGHTS_EVIDENCE_CLAIM_KIND_MISMATCH",
                                f"/sources/{index}/rightsEvidence/{evidence_index}/supportsClaims",
                                "A claim type must be supported by the recorded evidence kind; inaccessible pages cannot support permission claims.",
                            ))
                if isinstance(source_id, str) and source_id:
                    evidence_by_source[source_id] = source_evidence_ids

            for index, source in enumerate(records):
                if not isinstance(source, Mapping):
                    continue
                source_id = source.get("sourceId")
                status = source.get("legalStatus")
                decision = source.get("rightsDecision")
                outcome = decision.get("outcome") if isinstance(decision, Mapping) else None
                linked_value = decision.get("evidenceIds", []) if isinstance(decision, Mapping) else []
                linked_ids = linked_value if isinstance(linked_value, list) else []
                local_evidence_ids = evidence_by_source.get(source_id, set()) if isinstance(source_id, str) else set()
                if isinstance(linked_ids, list):
                    for evidence_id in linked_ids:
                        if not isinstance(evidence_id, str) or evidence_id not in local_evidence_ids:
                            issues.append(ValidationIssue("RIGHTS_DECISION_EVIDENCE_UNRESOLVED", f"/sources/{index}/rightsDecision/evidenceIds", f"Decision evidence {evidence_id!r} must resolve to evidence recorded on the same source."))

                expected_outcome = {
                    "GREEN": "ALLOW_WITH_ITEM_CHECKS",
                    "YELLOW": "REFERENCE_ONLY",
                    "RED": "BLOCK",
                    "UNKNOWN": "UNKNOWN_BLOCKED",
                }.get(status) if isinstance(status, str) else None
                if expected_outcome is not None and outcome != expected_outcome:
                    issues.append(ValidationIssue("RIGHTS_STATUS_DECISION_MISMATCH", f"/sources/{index}/rightsDecision/outcome", f"{status} requires the explicit {expected_outcome} policy outcome."))

                if source.get("validationOnly") is True and status == "GREEN":
                    issues.append(ValidationIssue("VALIDATION_ONLY_SOURCE_NOT_PUBLISHABLE", f"/sources/{index}/validationOnly", "Validation-only sources cannot have GREEN publication status."))

                if status == "GREEN":
                    permission_fields = (
                        "commercialUse",
                        "modificationAllowed",
                        "redistributionAllowed",
                        "attributionRequired",
                        "shareAlike",
                        "rawIngestionAllowed",
                        "publicRepoAllowed",
                        "derivativeUseAllowed",
                    )
                    if any(source.get(field) in (None, "UNKNOWN", "NO", "NOT_ALLOWED") for field in permission_fields):
                        issues.append(ValidationIssue("GREEN_RIGHTS_UNSUPPORTED", f"/sources/{index}", "GREEN requires evidence-backed known terms for each permission field. Conditional terms require item-level checks; unknown or denied source-level use remains blocked."))
                    evidence_records = source.get("rightsEvidence", [])
                    has_linked_terms_evidence = isinstance(evidence_records, list) and any(
                        isinstance(item, Mapping)
                        and item.get("evidenceKind") in {"LICENSE_NOTICE", "TERMS_OF_USE"}
                        and item.get("evidenceId") in linked_ids
                        for item in evidence_records
                    )
                    if not has_linked_terms_evidence:
                        issues.append(ValidationIssue("GREEN_RIGHTS_EVIDENCE_MISSING", f"/sources/{index}/rightsEvidence", "GREEN requires linked evidence from a license notice or terms of use."))
                    claim_by_permission = {
                        "commercialUse": "COMMERCIAL_USE",
                        "modificationAllowed": "MODIFICATION",
                        "redistributionAllowed": "REDISTRIBUTION",
                        "attributionRequired": "ATTRIBUTION",
                        "shareAlike": "SHARE_ALIKE",
                        "rawIngestionAllowed": "RAW_INGESTION",
                        "publicRepoAllowed": "PUBLIC_REPOSITORY",
                        "derivativeUseAllowed": "DERIVATIVE_USE",
                    }
                    linked_claims: set[str] = set()
                    evidence_records = source.get("rightsEvidence", [])
                    if isinstance(evidence_records, list):
                        for evidence in evidence_records:
                            if not isinstance(evidence, Mapping) or evidence.get("evidenceId") not in linked_ids:
                                continue
                            claims = evidence.get("supportsClaims", [])
                            if isinstance(claims, list):
                                evidence_kind = evidence.get("evidenceKind")
                                allowed_claims = EVIDENCE_KIND_ALLOWED_CLAIMS.get(evidence_kind, set()) if isinstance(evidence_kind, str) else set()
                                linked_claims.update(
                                    claim for claim in claims
                                    if isinstance(claim, str) and claim in allowed_claims
                                )
                    missing_claims = {
                        claim
                        for field, claim in claim_by_permission.items()
                        if source.get(field) not in (None, "UNKNOWN") and claim not in linked_claims
                    }
                    if missing_claims:
                        issues.append(ValidationIssue("GREEN_PERMISSION_EVIDENCE_MISSING", f"/sources/{index}/rightsEvidence", f"Linked evidence must explicitly support permission claims: {', '.join(sorted(missing_claims))}."))
                    if any(source.get(field) == "CONDITIONAL" for field in permission_fields) and source.get("itemLevelRightsRequired") is not True:
                        issues.append(ValidationIssue("GREEN_ITEM_LEVEL_GUARD_MISSING", f"/sources/{index}/itemLevelRightsRequired", "Conditional source permissions require an item-level rights gate."))
    return sorted(set(issues))


def load_default_source_registry() -> dict[str, Any]:
    return _read_json(SOURCE_REGISTRY_PATH)


def _normalize_text(value: str) -> str:
    return "".join(
        character
        for character in value
        if not unicodedata.category(character).startswith(("P", "Z"))
    )


def _sentence_token_issues(
    sentence: Mapping[str, Any],
    nodes: Mapping[str, Mapping[str, Any]],
    sentence_path: str,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    rendered: list[str] = []
    tokens = sentence.get("tokens", [])
    if isinstance(tokens, list):
        for token_index, token in enumerate(tokens):
            if not isinstance(token, Mapping):
                continue
            token_id = token.get("id")
            node = nodes.get(token_id) if isinstance(token_id, str) else None
            expected_type = token.get("tokenType")
            if node is None or node.get("targetType") != expected_type:
                issues.append(ValidationIssue(
                    "UNREGISTERED_SENTENCE_TOKEN",
                    _path(sentence_path, "tokens", token_index),
                    f"Sentence token {token_id!r} is not a registered {expected_type} target.",
                ))
                continue
            text = token.get("text", "")
            raw_texts = (
                [node.get("traditional"), node.get("simplified")]
                if expected_type == "VOCABULARY"
                else [node.get("character")]
            )
            expected_texts = {value for value in raw_texts if isinstance(value, str)}
            if text not in expected_texts:
                issues.append(ValidationIssue(
                    "SENTENCE_TOKEN_TEXT_MISMATCH",
                    _path(sentence_path, "tokens", token_index, "text"),
                    f"Token text {text!r} does not match registered target {token_id!r}.",
                ))
            rendered.append(text)
    if _normalize_text("".join(rendered)) != _normalize_text(str(sentence.get("text", ""))):
        issues.append(ValidationIssue(
            "UNREGISTERED_SENTENCE_TEXT",
            _path(sentence_path, "text"),
            "Sentence text must be fully covered by the ordered registered tokens, ignoring punctuation and spacing.",
        ))
    return issues


def _path(base: str, *parts: Any) -> str:
    return "/" + "/".join((base.strip("/"), *(str(part) for part in parts)))


def _permission_cleared(registry_permission: Any, item_permission: Any) -> bool:
    """Allow registry-wide YES, or CONDITIONAL with explicit item-level YES."""
    return registry_permission == "YES" or (
        registry_permission == "CONDITIONAL" and item_permission == "YES"
    )


def _requires_content_rights(value: Mapping[str, Any], object_path: str) -> bool:
    """Identify graph targets and authored text-bearing curriculum examples."""
    curriculum_content_paths = (
        "/graph/",
        "/lessons/",
        "/curriculumChangeProposals/",
    )
    return (
        (object_path.startswith(curriculum_content_paths) and value.get("targetType") in {"SKILL", "VOCABULARY", "GRAMMAR", "CHARACTER"})
        or (object_path.startswith(curriculum_content_paths) and isinstance(value.get("reading"), str))
        or (object_path.startswith(curriculum_content_paths) and isinstance(value.get("text"), str) and isinstance(value.get("tokens"), list))
    )


def _walk(value: Any, path: str = ""):
    if isinstance(value, dict):
        yield path, value
        for key, child in value.items():
            yield from _walk(child, _path(path, key))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _walk(child, _path(path, index))


def validate_curriculum_pack(
    pack: Mapping[str, Any],
    source_registry: Mapping[str, Any] | None = None,
) -> list[ValidationIssue]:
    """Return stable schema and cross-reference diagnostics for one candidate pack."""
    sources = source_registry if source_registry is not None else load_default_source_registry()
    if not isinstance(sources, Mapping):
        sources = {"sources": []}
    pack_schema = _read_json(PACK_SCHEMA_PATH)
    source_schema = _read_json(SOURCE_SCHEMA_PATH)
    resolver_registry = _registry_for(pack_schema, source_schema)
    issues = _schema_issues(pack, pack_schema, resolver_registry)
    issues.extend(validate_source_registry(sources))

    if not isinstance(pack, Mapping):
        return sorted(set(issues))

    source_records = sources.get("sources", [])
    if not isinstance(source_records, list):
        source_records = []
    source_entries = {
        source.get("sourceId"): source
        for source in source_records
        if isinstance(source, Mapping) and isinstance(source.get("sourceId"), str) and source.get("sourceId")
    }

    def add(code: str, path: str, message: str) -> None:
        issues.append(ValidationIssue(code, path, message))

    graph = pack.get("graph", {})
    if not isinstance(graph, Mapping):
        graph = {}
    node_groups = {
        "SKILL": graph.get("skills", []),
        "VOCABULARY": graph.get("vocabulary", []),
        "GRAMMAR": graph.get("grammar", []),
        "CHARACTER": graph.get("characters", []),
    }
    graph_paths = {
        "SKILL": "skills",
        "VOCABULARY": "vocabulary",
        "GRAMMAR": "grammar",
        "CHARACTER": "characters",
    }
    nodes: dict[str, Mapping[str, Any]] = {}
    skill_aliases: dict[str, Mapping[str, Any]] = {}
    for target_type, group in node_groups.items():
        if not isinstance(group, list):
            continue
        for index, node in enumerate(group):
            if not isinstance(node, Mapping):
                continue
            node_id = node.get("id")
            node_path = _path("/graph", graph_paths[target_type], index)
            if not node.get("sourceProvenance"):
                add("MISSING_PROVENANCE", _path(node_path, "sourceProvenance"), "Every graph target requires source provenance.")
            if isinstance(node_id, str) and node_id:
                if node_id in nodes:
                    add("DUPLICATE_TARGET_ID", _path(node_path, "id"), f"Target ID {node_id!r} is already registered.")
                else:
                    nodes[node_id] = node
            if target_type == "SKILL":
                for alias in (node_id, node.get("skillId")):
                    if isinstance(alias, str) and alias:
                        skill_aliases[alias] = node

    lessons = pack.get("lessons", [])
    if not isinstance(lessons, list):
        lessons = []

    publishable = pack.get("publicationStatus") == "PUBLISHABLE"
    policy = pack.get("validationPolicy", {})
    approved_policy = isinstance(policy, Mapping) and policy.get("approved") is True
    if publishable and not approved_policy:
        add("VALIDATION_POLICY_NOT_APPROVED", "/validationPolicy/approved", "A publishable pack requires an explicitly approved validation policy.")

    # Check source references, item rights, and raw-content boundaries throughout the document.
    for object_path, value in _walk(pack):
        if "sourceId" in value:
            source_id = value.get("sourceId")
            source = source_entries.get(source_id) if isinstance(source_id, str) else None
            if source is None:
                add("SOURCE_NOT_REGISTERED", _path(object_path, "sourceId"), f"Source {source_id!r} is absent from the source registry.")
        else:
            source = None
        if "sourceProvenance" in value:
            provenance = value.get("sourceProvenance")
            if not provenance:
                add("MISSING_PROVENANCE", _path(object_path, "sourceProvenance"), "Every publishable target or authored example requires source provenance.")
    evidence_ids: set[str] = set()
    for object_path, value in _walk(pack):
        evidence_id = value.get("evidenceId")
        if isinstance(evidence_id, str) and evidence_id:
            if evidence_id in evidence_ids:
                add("DUPLICATE_EVIDENCE_ID", _path(object_path, "evidenceId"), f"Evidence ID {evidence_id!r} is duplicated.")
            evidence_ids.add(evidence_id)
    for object_path, value in _walk(pack):
        refs = value.get("evidenceIds")
        if isinstance(refs, list):
            for ref_index, evidence_id in enumerate(refs):
                if not isinstance(evidence_id, str) or evidence_id not in evidence_ids:
                    add("EVIDENCE_NOT_REGISTERED", _path(object_path, "evidenceIds", ref_index), f"Evidence {evidence_id!r} is not registered in this pack.")
        if isinstance(value.get("useMode"), str) and value.get("useMode") in {"EVIDENCE_REFERENCE", "CONTENT_SOURCE"}:
            source_id = value.get("sourceId")
            source = source_entries.get(source_id) if isinstance(source_id, str) else None
            raw_included = value.get("rawContentIncluded") is True
            use_mode = value.get("useMode")
            if use_mode == "EVIDENCE_REFERENCE" and raw_included:
                add("RAW_CONTENT_AS_EVIDENCE", _path(object_path, "rawContentIncluded"), "Evidence references may identify a source but may not contain its raw content.")
            if use_mode == "CONTENT_SOURCE":
                if source is None:
                    continue
                rights = value.get("itemRightsEvidence")
                if not isinstance(rights, Mapping):
                    rights = {}
                    add("ITEM_RIGHTS_EVIDENCE_MISSING", _path(object_path, "itemRightsEvidence"), "Content-source use requires item-level authorship and rights evidence.")
                if source.get("legalStatus") != "GREEN":
                    add("SOURCE_NOT_GREEN", _path(object_path, "sourceId"), "Content-source use requires a GREEN registered source.")
                if value.get("itemLicenseVerified") is not True:
                    add("ITEM_LICENSE_UNVERIFIED", _path(object_path, "itemLicenseVerified"), "Content-source use requires item-level license verification.")
                public_repo_cleared = _permission_cleared(
                    source.get("publicRepoAllowed"), rights.get("publicRepoPermission")
                )
                raw_ingestion_cleared = _permission_cleared(
                    source.get("rawIngestionAllowed"), rights.get("rawIngestionPermission")
                )
                if publishable and not public_repo_cleared:
                    add("SOURCE_REDISTRIBUTION_NOT_CLEARED", _path(object_path, "sourceId"), "Publishable content requires explicit YES for public-repository use.")
                if raw_included and (not raw_ingestion_cleared or not public_repo_cleared):
                    add("UNLICENSED_RAW_CONTENT", _path(object_path, "rawContentIncluded"), "Raw content requires explicit YES for ingestion and public-repository use.")

    if publishable:
        for object_path, value in _walk(pack):
            if not _requires_content_rights(value, object_path):
                continue
            provenance_records = value.get("sourceProvenance", [])
            if not isinstance(provenance_records, list):
                provenance_records = []
            has_verified_rights = False
            for provenance in provenance_records:
                if not isinstance(provenance, Mapping) or provenance.get("useMode") != "CONTENT_SOURCE":
                    continue
                source_id = provenance.get("sourceId")
                source = source_entries.get(source_id) if isinstance(source_id, str) else None
                rights = provenance.get("itemRightsEvidence")
                if (
                    source is not None
                    and source.get("legalStatus") == "GREEN"
                    and provenance.get("itemLicenseVerified") is True
                    and isinstance(rights, Mapping)
                    and _permission_cleared(source.get("publicRepoAllowed"), rights.get("publicRepoPermission"))
                ):
                    has_verified_rights = True
                    break
            if not has_verified_rights:
                add("CONTENT_RIGHTS_EVIDENCE_REQUIRED", _path(object_path, "sourceProvenance"), "Every publishable content-bearing target or example requires verified item-level authorship/rights and explicit public-repository permission.")

    if publishable:
        for target_type, group in node_groups.items():
            if not isinstance(group, list):
                continue
            for index, node in enumerate(group):
                if isinstance(node, Mapping) and node.get("approvalStatus") != "ARCHITECT_APPROVED":
                    add("UNAPPROVED_TARGET", _path("/graph", graph_paths[target_type], index, "approvalStatus"), "Publishable packs may include only ARCHITECT_APPROVED graph targets.")

    # Grammar examples belong to graph targets, so validate them once at pack scope.
    grammar_nodes = node_groups.get("GRAMMAR", [])
    if isinstance(grammar_nodes, list):
        for grammar_index, grammar_node in enumerate(grammar_nodes):
            if not isinstance(grammar_node, Mapping):
                continue
            for example_index, example in enumerate(grammar_node.get("examples", [])):
                if isinstance(example, Mapping):
                    example_path = _path("/graph/grammar", grammar_index, "examples", example_index)
                    issues.extend(_sentence_token_issues(example, nodes, example_path))

    known_from_previous_lessons: set[str] = set()
    prior_skill_aliases: set[str] = set()
    for lesson_index, lesson in enumerate(lessons):
        if not isinstance(lesson, Mapping):
            continue
        lesson_path = _path("/lessons", lesson_index)
        if not lesson.get("sourceProvenance"):
            add("MISSING_PROVENANCE", _path(lesson_path, "sourceProvenance"), "Every lesson requires source provenance.")
        lesson_level = lesson.get("level")
        if publishable and lesson.get("approvalStatus") != "ARCHITECT_APPROVED":
            add("UNAPPROVED_LESSON", _path(lesson_path, "approvalStatus"), "A publishable pack requires each lesson to be ARCHITECT_APPROVED.")

        def id_set(key: str) -> set[str]:
            value = lesson.get(key, [])
            return {item for item in value if isinstance(item, str)} if isinstance(value, list) else set()

        target_ids = set().union(
            id_set("skillIds"), id_set("targetVocabularyIds"),
            id_set("targetGrammarIds"), id_set("targetCharacterIds"),
        )
        content_target_ids = set().union(
            id_set("targetVocabularyIds"), id_set("targetGrammarIds"),
            id_set("targetCharacterIds"),
        )
        available_ids = id_set("availableTargetIds")
        prior_knowledge_ids = id_set("priorKnowledgeTargetIds") | known_from_previous_lessons
        prior_skills = id_set("priorKnowledgeSkillIds") | prior_skill_aliases

        for key, values in (
            ("skillIds", id_set("skillIds")),
            ("availableSkillIds", id_set("availableSkillIds")),
            ("priorKnowledgeSkillIds", id_set("priorKnowledgeSkillIds")),
        ):
            for value in values:
                if value not in skill_aliases:
                    add("UNREGISTERED_SKILL", _path(lesson_path, key), f"Skill {value!r} is not registered.")
        expected_keys = {
            "targetVocabularyIds": "VOCABULARY",
            "targetGrammarIds": "GRAMMAR",
            "targetCharacterIds": "CHARACTER",
        }
        for key, target_type in expected_keys.items():
            for target_id in id_set(key):
                if target_id not in nodes or nodes[target_id].get("targetType") != target_type:
                    add("UNREGISTERED_TARGET", _path(lesson_path, key), f"{target_type} target {target_id!r} is not registered.")
                elif target_id not in available_ids:
                    add("TARGET_NOT_AVAILABLE", _path(lesson_path, key), f"Target {target_id!r} is not listed in availableTargetIds.")
        if not id_set("skillIds") <= id_set("availableSkillIds"):
            add("SKILL_NOT_AVAILABLE", _path(lesson_path, "skillIds"), "Every lesson skill must also be listed in availableSkillIds.")
        for target_id in available_ids | id_set("priorKnowledgeTargetIds") | id_set("recycledTargetIds"):
            if target_id not in nodes:
                add("UNREGISTERED_TARGET", _path(lesson_path, "availableTargetIds"), f"Target {target_id!r} is not registered.")

        for target_id in target_ids:
            node = nodes.get(target_id)
            if node is None:
                continue
            node_type = node.get("targetType")
            difficulty = node.get("level")
            if node_type in {"VOCABULARY", "GRAMMAR"}:
                difficulty = node.get("difficultyEvidence", {}).get("level") if isinstance(node.get("difficultyEvidence"), Mapping) else None
            if node_type == "CHARACTER":
                difficulty = node.get("recognitionLevel")
            if isinstance(lesson_level, int) and isinstance(difficulty, int) and difficulty > lesson_level:
                add("TARGET_OUT_OF_LEVEL", _path(lesson_path, "level"), f"Target {target_id!r} is level {difficulty}, above lesson level {lesson_level}.")
            prereqs = node.get("prerequisites", [])
            if node_type == "SKILL":
                prereqs = list(prereqs)
            if node_type == "CHARACTER":
                prereqs = list(prereqs) + list(node.get("prerequisiteSkills", []))
            for prereq in prereqs if isinstance(prereqs, list) else []:
                if prereq in skill_aliases:
                    satisfied = prereq in prior_skills
                else:
                    satisfied = prereq in prior_knowledge_ids
                if not satisfied:
                    add("UNMET_PREREQUISITE", _path(lesson_path, "priorKnowledgeTargetIds"), f"Target {target_id!r} requires prior target {prereq!r}.")

        new_vocabulary_ids = id_set("newVocabularyIds")
        recycled_ids = id_set("recycledTargetIds")
        vocabulary_targets = id_set("targetVocabularyIds")
        for target_id in new_vocabulary_ids:
            if target_id not in vocabulary_targets:
                add("NEW_VOCABULARY_NOT_TARGETED", _path(lesson_path, "newVocabularyIds"), f"New vocabulary {target_id!r} must also be a lesson target.")
            if target_id in known_from_previous_lessons or target_id in id_set("priorKnowledgeTargetIds"):
                add("KNOWN_VOCABULARY_MARKED_NEW", _path(lesson_path, "newVocabularyIds"), f"Previously known vocabulary {target_id!r} cannot be marked new.")
        for target_id in recycled_ids:
            if target_id not in target_ids:
                add("RECYCLED_TARGET_NOT_USED", _path(lesson_path, "recycledTargetIds"), f"Recycled target {target_id!r} must be used by the lesson.")
            if target_id not in prior_knowledge_ids:
                add("UNMET_RECYCLING", _path(lesson_path, "recycledTargetIds"), f"Recycled target {target_id!r} was not previously known or taught in an earlier pack lesson.")
            if target_id in new_vocabulary_ids:
                add("NEW_TARGET_MARKED_RECYCLED", _path(lesson_path, "recycledTargetIds"), f"Target {target_id!r} cannot be both new and recycled.")
        for target_id in vocabulary_targets:
            node = nodes.get(target_id, {})
            if isinstance(node, Mapping) and node.get("introducedBySkill") not in skill_aliases:
                add("UNREGISTERED_INTRODUCING_SKILL", _path(lesson_path, "targetVocabularyIds"), f"Vocabulary {target_id!r} names unregistered introducing skill {node.get('introducedBySkill')!r}.")
            elif isinstance(node, Mapping) and target_id in new_vocabulary_ids and isinstance(node.get("introducedBySkill"), str) and node.get("introducedBySkill") not in id_set("skillIds"):
                add("INTRODUCING_SKILL_NOT_IN_LESSON", _path(lesson_path, "skillIds"), f"New vocabulary {target_id!r} must be introduced by a skill included in this lesson.")
            if isinstance(node, Mapping) and node.get("requiresRecycling") is True and target_id in prior_knowledge_ids and target_id not in recycled_ids:
                add("RECYCLING_REQUIRED", _path(lesson_path, "recycledTargetIds"), f"Vocabulary {target_id!r} requires an explicit recycling mark.")

        if approved_policy and isinstance(policy, Mapping) and isinstance(policy.get("maxNewVocabularyRatio"), (int, float)):
            denominator = len(vocabulary_targets)
            ratio = len(new_vocabulary_ids) / denominator if denominator else 0.0
            if ratio > policy["maxNewVocabularyRatio"]:
                add("NEW_VOCABULARY_RATIO_EXCEEDED", _path(lesson_path, "newVocabularyIds"), f"New vocabulary ratio {ratio:.3f} exceeds the explicitly approved limit {policy['maxNewVocabularyRatio']:.3f}.")

        # Sentences are built only from registered graph tokens and must match those tokens.
        sentences = lesson.get("sentences", [])
        if isinstance(sentences, list):
            for sentence_index, sentence in enumerate(sentences):
                if not isinstance(sentence, Mapping):
                    continue
                sentence_path = _path(lesson_path, "sentences", sentence_index)
                issues.extend(_sentence_token_issues(sentence, nodes, sentence_path))
                for token_index, token in enumerate(sentence.get("tokens", [])):
                    if isinstance(token, Mapping):
                        token_id = token.get("id")
                        if isinstance(token_id, str) and token_id not in content_target_ids | prior_knowledge_ids:
                            add("SENTENCE_TARGET_NOT_DECLARED", _path(sentence_path, "tokens", token_index), f"Sentence target {token_id!r} is neither targeted nor declared as prior knowledge.")

        # Writing requires recognized characters first in the same lesson or prior knowledge.
        activities = lesson.get("activities", [])
        seen_recognition: set[str] = set()
        if isinstance(activities, list):
            for activity_index, activity in enumerate(activities):
                if not isinstance(activity, Mapping):
                    continue
                domain = str(activity.get("domain", "")).lower().replace("-", "_")
                activity_target_ids = id_set_from(activity.get("targetIds"))
                for target_id in activity_target_ids:
                    node = nodes.get(target_id)
                    if node is None:
                        add("UNREGISTERED_ACTIVITY_TARGET", _path(lesson_path, "activities", activity_index, "targetIds"), f"Activity target {target_id!r} is not registered.")
                    elif target_id not in content_target_ids | prior_knowledge_ids:
                        add("ACTIVITY_TARGET_NOT_DECLARED", _path(lesson_path, "activities", activity_index, "targetIds"), f"Activity target {target_id!r} is neither targeted nor declared as prior knowledge.")
                if domain in {"recognition", "character_recognition"}:
                    seen_recognition.update(
                        target_id for target_id in activity_target_ids
                        if target_id in nodes and nodes[target_id].get("targetType") == "CHARACTER"
                    )
                if domain not in {"writing", "handwriting"}:
                    continue
                for target_id in activity_target_ids:
                    node = nodes.get(target_id)
                    if node is None:
                        continue
                    if node.get("targetType") != "CHARACTER":
                        add("WRITING_TARGET_NOT_CHARACTER", _path(lesson_path, "activities", activity_index, "targetIds"), f"Writing activity target {target_id!r} is not a character.")
                        continue
                    if node.get("writingLevel") is None:
                        add("WRITING_LEVEL_UNSUPPORTED", _path(lesson_path, "activities", activity_index, "targetIds"), f"Character {target_id!r} has no approved writing level.")
                    elif isinstance(lesson_level, int) and isinstance(node.get("writingLevel"), int) and node.get("writingLevel") > lesson_level:
                        add("TARGET_OUT_OF_LEVEL", _path(lesson_path, "activities", activity_index, "targetIds"), f"Character {target_id!r} writing level {node.get('writingLevel')} is above lesson level {lesson_level}.")
                    if target_id not in prior_knowledge_ids and target_id not in seen_recognition:
                        add("WRITING_BEFORE_RECOGNITION", _path(lesson_path, "activities", activity_index), f"Character {target_id!r} must be recognized before its writing activity.")

        # Mastery references must map to a supported registered skill in this lesson.
        lesson_skill_refs = id_set("skillIds")
        mastery_targets = lesson.get("masteryTargets", [])
        if not isinstance(mastery_targets, list):
            mastery_targets = []
        lesson_mastery_keys: set[tuple[str, str]] = set()
        for target_index, mastery in enumerate(mastery_targets):
            if not isinstance(mastery, Mapping):
                continue
            skill_id = mastery.get("skillId")
            domain = mastery.get("domain")
            node = skill_aliases.get(skill_id) if isinstance(skill_id, str) else None
            if node is None or skill_id not in lesson_skill_refs and node.get("id") not in lesson_skill_refs:
                add("UNSUPPORTED_MASTERY_TARGET", _path(lesson_path, "masteryTargets", target_index), f"Mastery target skill {skill_id!r} is not part of this lesson's registered skills.")
            elif node.get("domain") != domain:
                add("UNSUPPORTED_MASTERY_DOMAIN", _path(lesson_path, "masteryTargets", target_index, "domain"), f"Domain {domain!r} does not match registered skill domain {node.get('domain')!r}.")
            if node is not None:
                lesson_mastery_keys.add((str(node.get("id")), str(domain)))
        if isinstance(activities, list):
            for activity_index, activity in enumerate(activities):
                if not isinstance(activity, Mapping):
                    continue
                activity_mastery = activity.get("masteryTargets", [])
                if not isinstance(activity_mastery, list):
                    continue
                for target_index, mastery in enumerate(activity_mastery):
                    if not isinstance(mastery, Mapping):
                        continue
                    mastery_skill_id = mastery.get("skillId")
                    skill = skill_aliases.get(mastery_skill_id) if isinstance(mastery_skill_id, str) else None
                    key = (str(skill.get("id")) if skill else str(mastery.get("skillId")), str(mastery.get("domain")))
                    if key not in lesson_mastery_keys:
                        add("UNSUPPORTED_ACTIVITY_MASTERY_TARGET", _path(lesson_path, "activities", activity_index, "masteryTargets", target_index), "Activity mastery targets must be declared by the lesson and map to a registered skill.")

        for target_id in id_set("targetVocabularyIds") | id_set("targetGrammarIds") | id_set("targetCharacterIds"):
            known_from_previous_lessons.add(target_id)
        for skill_ref in id_set("skillIds"):
            skill = skill_aliases.get(skill_ref)
            if skill is not None:
                known_from_previous_lessons.add(str(skill.get("id")))
                if skill.get("skillId"):
                    prior_skill_aliases.add(str(skill["skillId"]))

    return sorted(set(issues))


def id_set_from(value: Any) -> set[str]:
    return {item for item in value if isinstance(item, str)} if isinstance(value, list) else set()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate an evidence-constrained Open Curriculum pack.")
    parser.add_argument("pack", type=Path, help="Candidate pack JSON file")
    parser.add_argument("--source-registry", type=Path, default=SOURCE_REGISTRY_PATH)
    args = parser.parse_args(argv)
    try:
        pack = _read_json(args.pack)
        sources = _read_json(args.source_registry)
    except (OSError, json.JSONDecodeError) as exc:
        print(json.dumps([{"code": "INPUT_UNREADABLE", "path": "/", "message": str(exc)}], ensure_ascii=False, indent=2))
        return 2
    results = validate_curriculum_pack(pack, sources)
    print(json.dumps([asdict(issue) for issue in results], ensure_ascii=False, indent=2))
    return 1 if results else 0


if __name__ == "__main__":
    sys.exit(main())
