"""Deterministic authority and consistency checks for proposed curriculum packs.

This module validates proposals only. It does not generate targets, choose the
next lesson, approve curriculum, or import source content.
"""

from __future__ import annotations

import argparse
import json
import math
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


def _reject_nonstandard_json_constant(value: str) -> None:
    raise ValueError(f"Non-standard JSON numeric constant {value!r} is not allowed.")


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(
        path.read_text(encoding="utf-8"),
        parse_constant=_reject_nonstandard_json_constant,
    )


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


def _validate_graph_relationships(
    node_groups: Mapping[str, Any],
    graph_paths: Mapping[str, str],
    nodes: Mapping[str, Mapping[str, Any]],
    node_paths: Mapping[str, str],
    skill_aliases: Mapping[str, Mapping[str, Any]],
    ambiguous_skill_aliases: set[str],
) -> list[ValidationIssue]:
    """Validate graph edges and reject prerequisite cycles without loading content."""
    issues: list[ValidationIssue] = []
    dependency_edges: dict[str, list[tuple[str, str]]] = {node_id: [] for node_id in nodes}

    def add(code: str, path: str, message: str) -> None:
        issues.append(ValidationIssue(code, path, message))

    def resolve(
        reference: Any,
        path: str,
        *,
        expected_types: set[str] | None = None,
        allow_skill_alias: bool = False,
    ) -> tuple[str, Mapping[str, Any]] | None:
        if not isinstance(reference, str) or not reference:
            return None
        if allow_skill_alias and reference in ambiguous_skill_aliases:
            return None
        if allow_skill_alias and reference in skill_aliases:
            node = skill_aliases[reference]
        else:
            node = nodes.get(reference)
        if node is None:
            add(
                "UNREGISTERED_GRAPH_REFERENCE",
                path,
                f"Graph reference {reference!r} does not resolve to a registered node or allowed skill alias.",
            )
            return None
        actual_type = node.get("targetType")
        if expected_types is not None and actual_type not in expected_types:
            expected = ", ".join(sorted(expected_types))
            add(
                "GRAPH_REFERENCE_TYPE_MISMATCH",
                path,
                f"Graph reference {reference!r} resolves to {actual_type!r}; expected {expected}.",
            )
            return None
        canonical_id = node.get("id")
        if not isinstance(canonical_id, str) or not canonical_id:
            return None
        return canonical_id, node

    def iter_references(node: Mapping[str, Any], field: str, path: str):
        values = node.get(field, [])
        if not isinstance(values, list):
            return
        for index, value in enumerate(values):
            yield value, _path(path, field, index)

    def add_dependency(
        source_node: Mapping[str, Any],
        reference: Any,
        path: str,
        *,
        expected_types: set[str] | None,
        allow_skill_alias: bool,
    ) -> None:
        source_id = source_node.get("id")
        if not isinstance(source_id, str) or nodes.get(source_id) is not source_node:
            return
        resolved = resolve(
            reference,
            path,
            expected_types=expected_types,
            allow_skill_alias=allow_skill_alias,
        )
        if resolved is None:
            return
        dependency_id, _ = resolved
        if dependency_id == source_id:
            add(
                "SELF_PREREQUISITE",
                path,
                f"Graph node {source_id!r} cannot require itself as a prerequisite.",
            )
            return
        dependency_edges[source_id].append((dependency_id, path))

    for target_type, group in node_groups.items():
        if not isinstance(group, list):
            continue
        for index, node in enumerate(group):
            if not isinstance(node, Mapping):
                continue
            node_id = node.get("id")
            if not isinstance(node_id, str) or nodes.get(node_id) is not node:
                continue
            node_path = _path("/graph", graph_paths[target_type], index)

            if target_type == "SKILL":
                for field, expected_type in (
                    ("targetVocabulary", "VOCABULARY"),
                    ("targetGrammar", "GRAMMAR"),
                    ("targetCharacters", "CHARACTER"),
                ):
                    for reference, reference_path in iter_references(node, field, node_path):
                        resolve(reference, reference_path, expected_types={expected_type})
                for reference, reference_path in iter_references(node, "prerequisites", node_path):
                    add_dependency(
                        node,
                        reference,
                        reference_path,
                        expected_types={"SKILL"},
                        allow_skill_alias=True,
                    )
            elif target_type == "VOCABULARY":
                resolve(
                    node.get("introducedBySkill"),
                    _path(node_path, "introducedBySkill"),
                    expected_types={"SKILL"},
                    allow_skill_alias=True,
                )
                for reference, reference_path in iter_references(node, "prerequisites", node_path):
                    add_dependency(
                        node,
                        reference,
                        reference_path,
                        expected_types=None,
                        allow_skill_alias=True,
                    )
            elif target_type == "GRAMMAR":
                for reference, reference_path in iter_references(node, "prerequisites", node_path):
                    add_dependency(
                        node,
                        reference,
                        reference_path,
                        expected_types=None,
                        allow_skill_alias=True,
                    )
            elif target_type == "CHARACTER":
                for reference, reference_path in iter_references(node, "prerequisiteSkills", node_path):
                    add_dependency(
                        node,
                        reference,
                        reference_path,
                        expected_types={"SKILL"},
                        allow_skill_alias=True,
                    )
                writing_level = node.get("writingLevel")
                recognition_level = node.get("recognitionLevel")
                if writing_level is not None and recognition_level is None:
                    add(
                        "CHARACTER_WRITING_WITHOUT_RECOGNITION",
                        _path(node_path, "writingLevel"),
                        "A character cannot require writing without an explicit recognition level.",
                    )
                elif (
                    isinstance(writing_level, int)
                    and isinstance(recognition_level, int)
                    and writing_level < recognition_level
                ):
                    add(
                        "CHARACTER_WRITING_BEFORE_RECOGNITION",
                        _path(node_path, "writingLevel"),
                        "A character's writing level cannot precede its recognition level.",
                    )

    # Iterative traversal avoids recursion limits on malformed or oversized graphs.
    visit_state: dict[str, int] = {}
    cycle_signatures: set[tuple[str, ...]] = set()
    for start_id in sorted(dependency_edges):
        if visit_state.get(start_id, 0) != 0:
            continue
        active = [start_id]
        active_index = {start_id: 0}
        visit_state[start_id] = 1
        frames: list[tuple[str, Any]] = [
            (start_id, iter(sorted({edge[0] for edge in dependency_edges[start_id]})))
        ]
        while frames:
            current_id, child_ids = frames[-1]
            try:
                dependency_id = next(child_ids)
            except StopIteration:
                frames.pop()
                visit_state[current_id] = 2
                active.pop()
                active_index.pop(current_id, None)
                continue
            if dependency_id not in dependency_edges:
                continue
            state = visit_state.get(dependency_id, 0)
            if state == 0:
                visit_state[dependency_id] = 1
                active_index[dependency_id] = len(active)
                active.append(dependency_id)
                frames.append(
                    (
                        dependency_id,
                        iter(sorted({edge[0] for edge in dependency_edges[dependency_id]})),
                    )
                )
            elif state == 1:
                cycle = active[active_index[dependency_id] :]
                # A DFS back-edge cycle contains unique node IDs. Rotating from
                # its lexicographically smallest ID gives a stable signature in
                # linear time and avoids quadratic allocations for large graphs.
                smallest_index = cycle.index(min(cycle))
                signature = tuple(cycle[smallest_index:] + cycle[:smallest_index])
                if signature in cycle_signatures:
                    continue
                cycle_signatures.add(signature)
                edge_paths = [
                    path
                    for target_id, path in dependency_edges[current_id]
                    if target_id == dependency_id
                ]
                path = min(edge_paths) if edge_paths else node_paths.get(current_id, "/graph")
                rendered_cycle = " -> ".join((*signature, signature[0]))
                add(
                    "GRAPH_PREREQUISITE_CYCLE",
                    path,
                    f"Prerequisite cycle detected: {rendered_cycle}.",
                )

    return sorted(set(issues))


def _validate_proposed_node_relationships(
    proposed_nodes: list[Any],
    proposal_path: str,
    nodes: Mapping[str, Mapping[str, Any]],
    skill_aliases: Mapping[str, Mapping[str, Any]],
    ambiguous_skill_aliases: set[str],
) -> list[ValidationIssue]:
    """Resolve candidate-node edges against this proposal plus the approved graph."""
    issues: list[ValidationIssue] = []

    def add(code: str, path: str, message: str) -> None:
        issues.append(ValidationIssue(code, path, message))

    candidate_nodes: dict[str, Mapping[str, Any]] = {}
    candidate_paths: dict[str, str] = {}
    candidate_skill_aliases: dict[str, Mapping[str, Any]] = {}
    ambiguous_candidate_aliases: set[str] = set()
    for index, node in enumerate(proposed_nodes):
        if not isinstance(node, Mapping):
            continue
        node_id = node.get("id")
        node_path = _path(proposal_path, "proposedNodes", index)
        if not isinstance(node_id, str) or not node_id:
            continue
        if node_id in candidate_nodes:
            add("DUPLICATE_PROPOSED_NODE_ID", _path(node_path, "id"), f"Proposed node ID {node_id!r} is duplicated in this proposal.")
            continue
        candidate_nodes[node_id] = node
        candidate_paths[node_id] = node_path
        if node.get("targetType") != "SKILL":
            continue
        for alias in (node_id, node.get("skillId")):
            if not isinstance(alias, str) or not alias:
                continue
            previous = candidate_skill_aliases.get(alias)
            registered = skill_aliases.get(alias)
            registered_id = registered.get("id") if isinstance(registered, Mapping) else None
            if previous is not None and previous.get("id") != node_id:
                ambiguous_candidate_aliases.add(alias)
            elif registered is not None and registered_id != node_id:
                ambiguous_candidate_aliases.add(alias)
            else:
                candidate_skill_aliases[alias] = node
            if alias in ambiguous_candidate_aliases:
                add("PROPOSAL_SKILL_ALIAS_COLLISION", _path(node_path, "skillId"), f"Proposed skill alias {alias!r} collides with another registered skill.")

    combined_nodes = dict(nodes)
    combined_nodes.update(candidate_nodes)
    for node_id, node in candidate_nodes.items():
        registered_skill = skill_aliases.get(node_id)
        registered_skill_id = registered_skill.get("id") if isinstance(registered_skill, Mapping) else None
        if node_id in ambiguous_skill_aliases or (registered_skill is not None and registered_skill_id != node_id):
            add(
                "PROPOSAL_SKILL_ALIAS_COLLISION",
                _path(candidate_paths[node_id], "id"),
                f"Proposed target ID {node_id!r} collides with a registered skill alias.",
            )

    for alias, node in candidate_skill_aliases.items():
        alias_target = combined_nodes.get(alias)
        node_id = node.get("id")
        alias_target_id = alias_target.get("id") if isinstance(alias_target, Mapping) else None
        if alias_target is not None and alias_target_id != node_id:
            ambiguous_candidate_aliases.add(alias)
            node_path = candidate_paths.get(node_id, proposal_path)
            add(
                "PROPOSAL_SKILL_ALIAS_COLLISION",
                _path(node_path, "skillId"),
                f"Proposed skill alias {alias!r} collides with a different graph target ID.",
            )

    combined_aliases = dict(skill_aliases)
    for alias, node in candidate_skill_aliases.items():
        if alias not in ambiguous_candidate_aliases:
            combined_aliases[alias] = node
    combined_ambiguous_aliases = set(ambiguous_skill_aliases) | ambiguous_candidate_aliases

    def resolve(
        reference: Any,
        path: str,
        *,
        expected_types: set[str] | None = None,
        allow_skill_alias: bool = False,
    ) -> str | None:
        if not isinstance(reference, str) or not reference:
            add("PROPOSAL_GRAPH_REFERENCE_NOT_REGISTERED", path, f"Proposed-node reference {reference!r} must resolve to a graph target or skill.")
            return None
        target = None
        if allow_skill_alias and reference in combined_ambiguous_aliases:
            add("PROPOSAL_GRAPH_REFERENCE_AMBIGUOUS", path, f"Proposed-node skill reference {reference!r} is ambiguous.")
            return None
        if allow_skill_alias and reference in combined_aliases:
            alias_node = combined_aliases[reference]
            alias_id = alias_node.get("id")
            target = combined_nodes.get(alias_id) if isinstance(alias_id, str) else alias_node
        if target is None:
            target = combined_nodes.get(reference)
        if target is None:
            add("PROPOSAL_GRAPH_REFERENCE_NOT_REGISTERED", path, f"Proposed-node reference {reference!r} is not registered in this proposal or the graph.")
            return None
        actual_type = target.get("targetType")
        if expected_types is not None and actual_type not in expected_types:
            add("PROPOSAL_GRAPH_REFERENCE_TYPE_MISMATCH", path, f"Proposed-node reference {reference!r} resolves to {actual_type!r}; expected {', '.join(sorted(expected_types))}.")
            return None
        target_id = target.get("id")
        return target_id if isinstance(target_id, str) and target_id else None

    dependency_edges: dict[str, set[str]] = {node_id: set() for node_id in combined_nodes}

    def check_refs(
        source_id: str,
        source_node: Mapping[str, Any],
        source_path: str,
        field: str,
        *,
        expected_types: set[str] | None,
        allow_skill_alias: bool,
        dependency: bool,
    ) -> None:
        references = source_node.get(field, [])
        if not isinstance(references, list):
            return
        is_candidate = source_id in candidate_nodes and candidate_nodes[source_id] is source_node
        for ref_index, reference in enumerate(references):
            ref_path = _path(source_path, field, ref_index)
            if is_candidate:
                target_id = resolve(reference, ref_path, expected_types=expected_types, allow_skill_alias=allow_skill_alias)
            else:
                if not isinstance(reference, str) or not reference:
                    continue
                target = None
                if allow_skill_alias and reference in combined_ambiguous_aliases:
                    continue
                if allow_skill_alias and reference in combined_aliases:
                    alias_node = combined_aliases[reference]
                    alias_id = alias_node.get("id")
                    target = combined_nodes.get(alias_id) if isinstance(alias_id, str) else alias_node
                if target is None and isinstance(reference, str):
                    target = combined_nodes.get(reference)
                if target is None or (expected_types is not None and target.get("targetType") not in expected_types):
                    continue
                target_id = target.get("id") if isinstance(target.get("id"), str) else None
            if dependency and target_id is not None:
                if target_id == source_id and is_candidate:
                    add("PROPOSAL_SELF_PREREQUISITE", ref_path, f"Proposed node {source_id!r} cannot require itself.")
                dependency_edges.setdefault(source_id, set()).add(target_id)

    for source_id, source_node in combined_nodes.items():
        source_path = candidate_paths.get(source_id, "/graph")
        target_type = source_node.get("targetType")
        if target_type == "SKILL":
            check_refs(source_id, source_node, source_path, "targetVocabulary", expected_types={"VOCABULARY"}, allow_skill_alias=False, dependency=False)
            check_refs(source_id, source_node, source_path, "targetGrammar", expected_types={"GRAMMAR"}, allow_skill_alias=False, dependency=False)
            check_refs(source_id, source_node, source_path, "targetCharacters", expected_types={"CHARACTER"}, allow_skill_alias=False, dependency=False)
            check_refs(source_id, source_node, source_path, "prerequisites", expected_types={"SKILL"}, allow_skill_alias=True, dependency=True)
        elif target_type == "VOCABULARY":
            if source_id in candidate_nodes and candidate_nodes[source_id] is source_node:
                resolve(source_node.get("introducedBySkill"), _path(source_path, "introducedBySkill"), expected_types={"SKILL"}, allow_skill_alias=True)
            check_refs(source_id, source_node, source_path, "prerequisites", expected_types=None, allow_skill_alias=True, dependency=True)
        elif target_type == "GRAMMAR":
            check_refs(source_id, source_node, source_path, "prerequisites", expected_types=None, allow_skill_alias=True, dependency=True)
        elif target_type == "CHARACTER":
            check_refs(source_id, source_node, source_path, "prerequisiteSkills", expected_types={"SKILL"}, allow_skill_alias=True, dependency=True)

    in_degree = {node_id: 0 for node_id in combined_nodes}
    for dependencies in dependency_edges.values():
        for dependency_id in dependencies:
            if dependency_id in in_degree:
                in_degree[dependency_id] += 1
    ready = [node_id for node_id, degree in in_degree.items() if degree == 0]
    while ready:
        source_id = ready.pop()
        for dependency_id in dependency_edges.get(source_id, set()):
            if dependency_id not in in_degree:
                continue
            in_degree[dependency_id] -= 1
            if in_degree[dependency_id] == 0:
                ready.append(dependency_id)
    for node_id, degree in in_degree.items():
        if degree > 0 and node_id in candidate_paths:
            add("PROPOSAL_GRAPH_PREREQUISITE_CYCLE", candidate_paths[node_id], f"Proposed node {node_id!r} participates in a prerequisite cycle.")

    return sorted(set(issues))


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
    skill_alias_paths: dict[str, str] = {}
    ambiguous_skill_aliases: set[str] = set()
    node_paths: dict[str, str] = {}
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
                    node_paths[node_id] = node_path
            if target_type == "SKILL":
                for alias in (node_id, node.get("skillId")):
                    if isinstance(alias, str) and alias:
                        if alias in skill_aliases and skill_aliases[alias] is not node:
                            ambiguous_skill_aliases.add(alias)
                            add(
                                "SKILL_ALIAS_COLLISION",
                                _path(node_path, "skillId" if alias == node.get("skillId") else "id"),
                                f"Skill alias {alias!r} is already assigned to another node.",
                            )
                        else:
                            skill_aliases[alias] = node
                            skill_alias_paths[alias] = _path(
                                node_path,
                                "skillId" if alias == node.get("skillId") and alias != node_id else "id",
                            )

    for alias, skill_node in skill_aliases.items():
        target_node = nodes.get(alias)
        if target_node is not None and target_node is not skill_node:
            ambiguous_skill_aliases.add(alias)
            add(
                "SKILL_ALIAS_COLLISION",
                skill_alias_paths.get(alias, "/graph/skills"),
                f"Skill alias {alias!r} collides with a different graph target ID.",
            )

    issues.extend(
        _validate_graph_relationships(
            node_groups,
            graph_paths,
            nodes,
            node_paths,
            skill_aliases,
            ambiguous_skill_aliases,
        )
    )

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
    evidence_records: dict[str, Mapping[str, Any]] = {}
    for object_path, value in _walk(pack):
        evidence_id = value.get("evidenceId")
        if isinstance(evidence_id, str) and evidence_id:
            if evidence_id in evidence_ids:
                add("DUPLICATE_EVIDENCE_ID", _path(object_path, "evidenceId"), f"Evidence ID {evidence_id!r} is duplicated.")
            else:
                evidence_records[evidence_id] = value
            evidence_ids.add(evidence_id)

    proposal_ids: set[str] = set()
    proposal_target_ids: dict[str, str] = {}
    proposals = pack.get("curriculumChangeProposals", [])
    if isinstance(proposals, list):
        for proposal_index, proposal in enumerate(proposals):
            if not isinstance(proposal, Mapping):
                continue
            proposal_path = _path("/curriculumChangeProposals", proposal_index)
            proposal_id = proposal.get("proposalId")
            if isinstance(proposal_id, str) and proposal_id:
                if proposal_id in proposal_ids:
                    add("DUPLICATE_PROPOSAL_ID", _path(proposal_path, "proposalId"), f"Proposal ID {proposal_id!r} is duplicated.")
                proposal_ids.add(proposal_id)

            if proposal.get("approvalStatus") != "PROPOSED":
                add("PROPOSAL_APPROVAL_NOT_AUTHENTICATED", _path(proposal_path, "approvalStatus"), "Proposal records remain PROPOSED until a separate authenticated human approval transition exists.")

            proposed_nodes = proposal.get("proposedNodes", [])
            if not isinstance(proposed_nodes, list):
                proposed_nodes = []
            proposed_target_ids = {
                node.get("id")
                for node in proposed_nodes
                if isinstance(node, Mapping) and isinstance(node.get("id"), str)
            }
            change_type = proposal.get("changeType")
            for node_index, node in enumerate(proposed_nodes):
                if not isinstance(node, Mapping):
                    continue
                node_path = _path(proposal_path, "proposedNodes", node_index)
                node_id = node.get("id")
                if node.get("approvalStatus") != "PROPOSED":
                    add("PROPOSAL_TARGET_APPROVAL_NOT_AUTHENTICATED", _path(node_path, "approvalStatus"), "A proposed node cannot self-assert approval; human approval must use a separate authenticated transition.")
                if change_type == "ADD_TARGET" and isinstance(node_id, str):
                    if node_id in nodes:
                        add("PROPOSAL_TARGET_ALREADY_REGISTERED", _path(node_path, "id"), f"New target {node_id!r} already exists in the approved graph.")
                    elif node_id in proposal_target_ids:
                        add("DUPLICATE_PROPOSED_TARGET_ID", _path(node_path, "id"), f"New target {node_id!r} is already proposed by {proposal_target_ids[node_id]!r}.")
                    else:
                        proposal_target_ids[node_id] = proposal_id if isinstance(proposal_id, str) else proposal_path

            issues.extend(
                _validate_proposed_node_relationships(
                    proposed_nodes,
                    proposal_path,
                    nodes,
                    skill_aliases,
                    ambiguous_skill_aliases,
                )
            )

            affected_ids = proposal.get("affectedTargetIds", [])
            if not isinstance(affected_ids, list):
                affected_ids = []
            if change_type in {"MODIFY_TARGET", "REMOVE_TARGET", "CHANGE_PREREQUISITE", "CHANGE_SEQUENCE"} and not affected_ids:
                add("PROPOSAL_AFFECTED_TARGET_REQUIRED", _path(proposal_path, "affectedTargetIds"), f"{change_type} proposals must identify at least one existing target.")
            for target_index, target_id in enumerate(affected_ids):
                if isinstance(target_id, str) and target_id not in nodes:
                    add("PROPOSAL_AFFECTED_TARGET_NOT_REGISTERED", _path(proposal_path, "affectedTargetIds", target_index), f"Affected target {target_id!r} is not in the current graph.")

            if change_type == "REMOVE_TARGET" and proposed_nodes:
                add("PROPOSAL_REMOVAL_HAS_PROPOSED_NODE", _path(proposal_path, "proposedNodes"), "A removal proposal identifies the existing affected target and must not include a replacement node.")
            elif change_type in {"MODIFY_TARGET", "CHANGE_PREREQUISITE", "CHANGE_SEQUENCE"}:
                proposed_ids = {
                    node.get("id")
                    for node in proposed_nodes
                    if isinstance(node, Mapping) and isinstance(node.get("id"), str)
                }
                affected_id_set = {target_id for target_id in affected_ids if isinstance(target_id, str)}
                for node_index, node in enumerate(proposed_nodes):
                    if not isinstance(node, Mapping):
                        continue
                    node_id = node.get("id")
                    if isinstance(node_id, str) and node_id not in affected_id_set:
                        add("PROPOSAL_NODE_NOT_AFFECTED", _path(proposal_path, "proposedNodes", node_index, "id"), f"Proposed node {node_id!r} is not declared in affectedTargetIds.")
                    current_node = nodes.get(node_id) if isinstance(node_id, str) else None
                    if current_node is not None and node.get("targetType") != current_node.get("targetType"):
                        add("PROPOSAL_TARGET_TYPE_MISMATCH", _path(proposal_path, "proposedNodes", node_index, "targetType"), f"Proposed node {node_id!r} must preserve the existing target type {current_node.get('targetType')!r}.")
                for target_index, target_id in enumerate(affected_ids):
                    if isinstance(target_id, str) and target_id not in proposed_ids:
                        add("PROPOSAL_AFFECTED_TARGET_NOT_PROPOSED", _path(proposal_path, "affectedTargetIds", target_index), f"Affected target {target_id!r} must have a corresponding proposed node for this change type.")

            prerequisites = proposal.get("prerequisites", [])
            if not isinstance(prerequisites, list):
                prerequisites = []
            for prerequisite_index, prerequisite in enumerate(prerequisites):
                if not isinstance(prerequisite, Mapping):
                    continue
                target_id = prerequisite.get("targetId")
                if isinstance(target_id, str) and target_id not in nodes and target_id not in skill_aliases:
                    add("PROPOSAL_PREREQUISITE_NOT_REGISTERED", _path(proposal_path, "prerequisites", prerequisite_index, "targetId"), f"Prerequisite {target_id!r} is not an existing graph target or skill.")

            local_evidence: dict[str, Mapping[str, Any]] = {
                value.get("evidenceId"): value
                for _, value in _walk(proposal)
                if isinstance(value, Mapping)
                and isinstance(value.get("evidenceId"), str)
            }

            def validate_proposal_evidence_refs(
                refs: Any,
                field_path: str,
                expected_claim: str | None = None,
            ) -> set[str]:
                resolved: set[str] = set()
                if not isinstance(refs, list):
                    return resolved
                for ref_index, evidence_id in enumerate(refs):
                    ref_path = _path(field_path, ref_index)
                    if not isinstance(evidence_id, str) or evidence_id not in local_evidence:
                        add("PROPOSAL_EVIDENCE_NOT_LOCAL", ref_path, f"Proposal evidence {evidence_id!r} must be included in this proposal record.")
                        continue
                    resolved.add(evidence_id)
                    if expected_claim is not None:
                        claims = local_evidence[evidence_id].get("supportsClaims", [])
                        if not isinstance(claims, list) or expected_claim not in claims:
                            add("PROPOSAL_EVIDENCE_CLAIM_MISMATCH", ref_path, f"Proposal evidence {evidence_id!r} must declare support for {expected_claim}.")
                return resolved

            validate_proposal_evidence_refs(
                proposal.get("whyNow", {}).get("evidenceIds") if isinstance(proposal.get("whyNow"), Mapping) else None,
                _path(proposal_path, "whyNow", "evidenceIds"),
            )
            validate_proposal_evidence_refs(
                proposal.get("authorityEvidenceIds"),
                _path(proposal_path, "authorityEvidenceIds"),
                "CURRICULUM_AUTHORITY",
            )
            difficulty_evidence_ids = validate_proposal_evidence_refs(
                proposal.get("difficultyEvidenceIds"),
                _path(proposal_path, "difficultyEvidenceIds"),
                "TARGET_DIFFICULTY",
            )
            for node in proposed_nodes:
                if not isinstance(node, Mapping):
                    continue
                difficulty = node.get("difficultyEvidence")
                if isinstance(difficulty, Mapping):
                    node_difficulty_ids = difficulty.get("evidenceIds", [])
                    if not isinstance(node_difficulty_ids, list):
                        node_difficulty_ids = []
                    for evidence_id in node_difficulty_ids:
                        if isinstance(evidence_id, str) and evidence_id not in difficulty_evidence_ids:
                            add("PROPOSAL_DIFFICULTY_EVIDENCE_NOT_DECLARED", _path(proposal_path, "difficultyEvidenceIds"), f"Node difficulty evidence {evidence_id!r} must be listed in proposal difficultyEvidenceIds.")

            alternatives = proposal.get("alternativesConsidered", [])
            seen_alternative_ids: set[str] = set()
            if isinstance(alternatives, list):
                for alternative_index, alternative in enumerate(alternatives):
                    if not isinstance(alternative, Mapping):
                        continue
                    alternative_path = _path(proposal_path, "alternativesConsidered", alternative_index)
                    alternative_id = alternative.get("alternativeId")
                    if isinstance(alternative_id, str) and alternative_id in seen_alternative_ids:
                        add("DUPLICATE_PROPOSAL_ALTERNATIVE_ID", _path(alternative_path, "alternativeId"), f"Alternative ID {alternative_id!r} is duplicated within this proposal.")
                    if isinstance(alternative_id, str):
                        seen_alternative_ids.add(alternative_id)
                    validate_proposal_evidence_refs(alternative.get("evidenceIds"), _path(alternative_path, "evidenceIds"))

            cognitive_load = proposal.get("expectedCognitiveLoad", {})
            dimensions = cognitive_load.get("dimensions", []) if isinstance(cognitive_load, Mapping) else []
            if isinstance(dimensions, list):
                referenced_targets = proposed_target_ids | {
                    target_id for target_id in affected_ids if isinstance(target_id, str)
                }
                for dimension_index, dimension in enumerate(dimensions):
                    if not isinstance(dimension, Mapping):
                        continue
                    dimension_path = _path(proposal_path, "expectedCognitiveLoad", "dimensions", dimension_index)
                    dimension_target_ids = dimension.get("targetIds", [])
                    if not isinstance(dimension_target_ids, list):
                        dimension_target_ids = []
                    for target_index, target_id in enumerate(dimension_target_ids):
                        if isinstance(target_id, str) and target_id not in referenced_targets:
                            add("PROPOSAL_LOAD_TARGET_NOT_DECLARED", _path(dimension_path, "targetIds", target_index), f"Load target {target_id!r} must be a proposed or affected target.")
                    validate_proposal_evidence_refs(
                        dimension.get("evidenceIds"),
                        _path(dimension_path, "evidenceIds"),
                        "EXPECTED_COGNITIVE_LOAD",
                    )

            confidence = proposal.get("confidence")
            if isinstance(confidence, Mapping):
                estimate = confidence.get("estimate")
                if (
                    not isinstance(estimate, (int, float))
                    or isinstance(estimate, bool)
                    or not 0 <= estimate <= 1
                    or not math.isfinite(estimate)
                ):
                    add("PROPOSAL_CONFIDENCE_INVALID", _path(proposal_path, "confidence", "estimate"), "Proposal confidence must be a finite number between 0 and 1.")
                validate_proposal_evidence_refs(
                    confidence.get("evidenceIds"),
                    _path(proposal_path, "confidence", "evidenceIds"),
                    "PROPOSAL_CONFIDENCE",
                )

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

    # Vocabulary and grammar claims must point to reviewed evidence attached to
    # that same graph node. Global existence alone is not a provenance link.
    claimable_types = {"VOCABULARY", "GRAMMAR"}
    for target_type, group in node_groups.items():
        if target_type not in claimable_types or not isinstance(group, list):
            continue
        for index, node in enumerate(group):
            if not isinstance(node, Mapping):
                continue
            node_path = _path("/graph", graph_paths[target_type], index)
            requires_reviewed_claim_evidence = (
                publishable or node.get("approvalStatus") == "ARCHITECT_APPROVED"
            )
            local_evidence_ids = {
                value.get("evidenceId")
                for _, value in _walk(node)
                if isinstance(value, Mapping)
                and isinstance(value.get("evidenceId"), str)
            }

            def validate_claim_references(field_path: str, refs: Any, expected_claim: str) -> None:
                if not isinstance(refs, list):
                    return
                for ref_index, evidence_id in enumerate(refs):
                    ref_path = _path(field_path, ref_index)
                    if not isinstance(evidence_id, str) or evidence_id not in evidence_ids:
                        continue  # The shared reference pass emitted EVIDENCE_NOT_REGISTERED.
                    if evidence_id not in local_evidence_ids:
                        add(
                            "CROSS_NODE_GRAPH_EVIDENCE",
                            ref_path,
                            f"Evidence {evidence_id!r} must be attached to the same graph node as this claim.",
                        )
                        continue
                    evidence_record = evidence_records.get(evidence_id)
                    claims = evidence_record.get("supportsClaims", []) if isinstance(evidence_record, Mapping) else []
                    if not isinstance(claims, list) or expected_claim not in claims:
                        add(
                            "GRAPH_EVIDENCE_CLAIM_MISMATCH",
                            ref_path,
                            f"Evidence {evidence_id!r} does not declare support for {expected_claim}.",
                        )
                    if (
                        requires_reviewed_claim_evidence
                        and isinstance(evidence_record, Mapping)
                        and evidence_record.get("reviewStatus") not in {"EVIDENCE_CHECKED", "ARCHITECT_APPROVED"}
                    ):
                        add(
                            "GRAPH_CLAIM_EVIDENCE_UNVERIFIED",
                            ref_path,
                            f"Approved or publishable graph claims require checked evidence; {evidence_id!r} is {evidence_record.get('reviewStatus')!r}.",
                        )

            for difficulty_field in ("difficultyEvidence", "levelEvidence"):
                difficulty = node.get(difficulty_field)
                if isinstance(difficulty, Mapping):
                    validate_claim_references(
                        _path(node_path, difficulty_field, "evidenceIds"),
                        difficulty.get("evidenceIds"),
                        "TARGET_DIFFICULTY",
                    )
            for field, expected_claim in (
                ("receptiveRequirement", "RECEPTIVE_REQUIREMENT"),
                ("productiveRequirement", "PRODUCTIVE_REQUIREMENT"),
            ):
                requirement = node.get(field)
                if isinstance(requirement, Mapping):
                    validate_claim_references(
                        _path(node_path, field, "evidenceIds"),
                        requirement.get("evidenceIds"),
                        expected_claim,
                    )

            if target_type == "VOCABULARY":
                frequency_evidence = node.get("frequencyEvidence", [])
                if isinstance(frequency_evidence, list):
                    for evidence_index, evidence_record in enumerate(frequency_evidence):
                        if not isinstance(evidence_record, Mapping):
                            continue
                        evidence_path = _path(node_path, "frequencyEvidence", evidence_index)
                        claims = evidence_record.get("supportsClaims", [])
                        if not isinstance(claims, list) or "VOCABULARY_FREQUENCY" not in claims:
                            add(
                                "GRAPH_EVIDENCE_CLAIM_MISMATCH",
                                _path(evidence_path, "supportsClaims"),
                                "Frequency evidence must declare VOCABULARY_FREQUENCY support.",
                            )
                        if (
                            requires_reviewed_claim_evidence
                            and evidence_record.get("reviewStatus") not in {"EVIDENCE_CHECKED", "ARCHITECT_APPROVED"}
                        ):
                            add(
                                "GRAPH_CLAIM_EVIDENCE_UNVERIFIED",
                                _path(evidence_path, "reviewStatus"),
                                "Approved or publishable frequency claims require checked evidence.",
                            )
            else:
                sequence_policy = node.get("receptiveProductivePolicy")
                receptive = node.get("receptiveRequirement", {})
                productive = node.get("productiveRequirement", {})
                receptive_required = isinstance(receptive, Mapping) and receptive.get("required") is True
                productive_required = isinstance(productive, Mapping) and productive.get("required") is True
                if sequence_policy == "RECEPTIVE_BEFORE_PRODUCTIVE" and not (receptive_required and productive_required):
                    add(
                        "GRAMMAR_SEQUENCE_POLICY_INCONSISTENT",
                        _path(node_path, "receptiveProductivePolicy"),
                        "RECEPTIVE_BEFORE_PRODUCTIVE requires both receptive and productive requirements.",
                    )
                elif sequence_policy == "NOT_APPLICABLE" and productive_required:
                    add(
                        "GRAMMAR_SEQUENCE_POLICY_INCONSISTENT",
                        _path(node_path, "receptiveProductivePolicy"),
                        "NOT_APPLICABLE requires productive learning to be explicitly not required.",
                    )
                policy_evidence_ids = node.get("receptiveProductivePolicyEvidenceIds", [])
                policy_path = _path(node_path, "receptiveProductivePolicyEvidenceIds")
                if sequence_policy != "UNRESOLVED" and not policy_evidence_ids:
                    add("GRAMMAR_SEQUENCE_POLICY_EVIDENCE_REQUIRED", policy_path, "A resolved grammar sequencing policy requires supporting evidence.")
                validate_claim_references(
                    policy_path,
                    policy_evidence_ids,
                    "RECEPTIVE_PRODUCTIVE_POLICY",
                )
                if sequence_policy == "UNRESOLVED" and (publishable or node.get("approvalStatus") == "ARCHITECT_APPROVED"):
                    add(
                        "UNRESOLVED_GRAMMAR_SEQUENCE_POLICY",
                        _path(node_path, "receptiveProductivePolicy"),
                        "An unresolved grammar sequencing policy cannot be approved or published.",
                    )

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
    recognized_characters_from_previous_lessons: set[str] = set()
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

        prior_recognized_character_ids: set[str] = set()
        for character_id in id_set("priorRecognizedCharacterIds"):
            character = nodes.get(character_id)
            if (
                character is None
                or character.get("targetType") != "CHARACTER"
                or character.get("recognitionLevel") is None
            ):
                add(
                    "UNSUPPORTED_PRIOR_RECOGNITION",
                    _path(lesson_path, "priorRecognizedCharacterIds"),
                    f"Prior recognition {character_id!r} must resolve to a character with an explicit recognition level.",
                )
                continue
            if character_id not in prior_knowledge_ids:
                add(
                    "PRIOR_RECOGNITION_NOT_KNOWN",
                    _path(lesson_path, "priorRecognizedCharacterIds"),
                    f"Prior-recognized character {character_id!r} must also be declared as prior knowledge or taught in an earlier pack lesson.",
                )
                continue
            prior_recognized_character_ids.add(character_id)

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
        new_vocabulary_ratio_limit = (
            policy.get("maxNewVocabularyRatio") if isinstance(policy, Mapping) else None
        )
        has_valid_new_vocabulary_ratio_limit = (
            isinstance(new_vocabulary_ratio_limit, (int, float))
            and not isinstance(new_vocabulary_ratio_limit, bool)
            and 0 <= new_vocabulary_ratio_limit <= 1
            and math.isfinite(new_vocabulary_ratio_limit)
        )
        if publishable and new_vocabulary_ids and not has_valid_new_vocabulary_ratio_limit:
            limit_code = (
                "NEW_VOCABULARY_LIMIT_REQUIRED"
                if new_vocabulary_ratio_limit is None
                else "NEW_VOCABULARY_LIMIT_INVALID"
            )
            add(
                limit_code,
                "/validationPolicy/maxNewVocabularyRatio",
                "A publishable lesson with new vocabulary requires an explicitly approved finite maxNewVocabularyRatio between 0 and 1; the validator does not choose a threshold.",
            )
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

        if approved_policy and has_valid_new_vocabulary_ratio_limit:
            denominator = len(vocabulary_targets)
            ratio = len(new_vocabulary_ids) / denominator if denominator else 0.0
            if ratio > new_vocabulary_ratio_limit:
                add("NEW_VOCABULARY_RATIO_EXCEEDED", _path(lesson_path, "newVocabularyIds"), f"New vocabulary ratio {ratio:.3f} exceeds the explicitly approved limit {new_vocabulary_ratio_limit:.3f}.")

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
        seen_recognition: set[str] = recognized_characters_from_previous_lessons | prior_recognized_character_ids
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
                    for target_id in activity_target_ids:
                        node = nodes.get(target_id)
                        if node is None or node.get("targetType") != "CHARACTER":
                            continue
                        recognition_level = node.get("recognitionLevel")
                        if recognition_level is None:
                            add("RECOGNITION_LEVEL_UNSUPPORTED", _path(lesson_path, "activities", activity_index, "targetIds"), f"Character {target_id!r} has no registered recognition level.")
                        else:
                            seen_recognition.add(target_id)
                            if isinstance(lesson_level, int) and isinstance(recognition_level, int) and recognition_level > lesson_level:
                                add("TARGET_OUT_OF_LEVEL", _path(lesson_path, "activities", activity_index, "targetIds"), f"Character {target_id!r} recognition level {recognition_level} is above lesson level {lesson_level}.")
                if domain in {"exposure", "character_exposure"}:
                    for target_id in activity_target_ids:
                        node = nodes.get(target_id)
                        if node is None:
                            continue
                        if node.get("targetType") != "CHARACTER":
                            add("EXPOSURE_TARGET_NOT_CHARACTER", _path(lesson_path, "activities", activity_index, "targetIds"), f"Character exposure activity target {target_id!r} is not a character.")
                        elif node.get("exposureLevel") is None:
                            add("EXPOSURE_LEVEL_UNSUPPORTED", _path(lesson_path, "activities", activity_index, "targetIds"), f"Character {target_id!r} has no registered exposure level.")
                        elif isinstance(lesson_level, int) and isinstance(node.get("exposureLevel"), int) and node.get("exposureLevel") > lesson_level:
                            add("TARGET_OUT_OF_LEVEL", _path(lesson_path, "activities", activity_index, "targetIds"), f"Character {target_id!r} exposure level {node.get('exposureLevel')} is above lesson level {lesson_level}.")
                if domain in {"reading", "character_reading"}:
                    for target_id in activity_target_ids:
                        node = nodes.get(target_id)
                        if node is None or node.get("targetType") != "CHARACTER":
                            continue
                        reading_level = node.get("readingLevel")
                        if reading_level is None:
                            add("READING_LEVEL_UNSUPPORTED", _path(lesson_path, "activities", activity_index, "targetIds"), f"Character {target_id!r} has no registered reading level.")
                        elif isinstance(lesson_level, int) and isinstance(reading_level, int) and reading_level > lesson_level:
                            add("TARGET_OUT_OF_LEVEL", _path(lesson_path, "activities", activity_index, "targetIds"), f"Character {target_id!r} reading level {reading_level} is above lesson level {lesson_level}.")
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
                    if target_id not in seen_recognition:
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

        recognized_characters_from_previous_lessons.update(seen_recognition)
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
    except (OSError, ValueError) as exc:
        print(json.dumps([{"code": "INPUT_UNREADABLE", "path": "/", "message": str(exc)}], ensure_ascii=False, indent=2))
        return 2
    results = validate_curriculum_pack(pack, sources)
    print(json.dumps([asdict(issue) for issue in results], ensure_ascii=False, indent=2))
    return 1 if results else 0


if __name__ == "__main__":
    sys.exit(main())
