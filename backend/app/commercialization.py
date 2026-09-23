"""Deterministic Phase 18 Commercialization Gate and release audit."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ALLOWED_STATUSES = {"PRIVATE_OK", "COMMERCIAL_OK", "COMMERCIAL_LICENSE_REQUIRED", "LICENSE_REVIEW_REQUIRED", "REPLACE_BEFORE_COMMERCIAL", "PROHIBITED"}
ALLOWED_REPLACEMENT_STATUSES = {"OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"}
BUILD_TARGETS = {"family", "commercial"}
REQUIRED_FIELDS = {"resource_id", "resource_type", "source_name", "source_url", "license_name", "usage_status", "private_use_allowed", "commercial_use_allowed", "commercial_license_required", "commercial_replacement_required", "technical_usable", "commercial_ready", "commercial_action", "commercial_evidence", "notes", "inventory_entries"}
ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "data" / "license-registry.json"
INVENTORY_MANIFEST_PATH = ROOT / "data" / "commercialization-inventory.json"


def load_registry() -> dict[str, Any]:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def _bool(value: Any) -> bool:
    return type(value) is bool


def _manifest_inventory(root: Path = ROOT) -> dict[str, set[str]]:
    package = json.loads((root / "frontend" / "package.json").read_text(encoding="utf-8"))
    packages = set(package.get("dependencies", {})) | set(package.get("devDependencies", {}))
    requirements: set[str] = set()
    for line in (root / "backend" / "requirements.txt").read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            requirements.add(re.split(r"[<>=!~\[]", line, maxsplit=1)[0].strip().lower())
    return {"frontend_packages": packages, "backend_requirements": requirements}


def _scan_manifest_sources(root: Path, manifest: dict[str, Any]) -> dict[str, set[str]]:
    excluded = set(manifest.get("excluded_directories", []))
    found: dict[str, set[str]] = {}
    for scope in manifest.get("scopes", []):
        paths: set[str] = set()
        excluded_paths = set(scope.get("excluded_paths", []))
        for pattern in scope.get("include_globs", []):
            for path in root.glob(pattern):
                if path.is_file():
                    relative = path.relative_to(root).as_posix()
                    if ".test." not in path.name and relative not in excluded_paths and not any(part in excluded for part in path.relative_to(root).parts):
                        if not scope.get("extensions") or path.suffix.lower() in scope["extensions"]:
                            paths.add(relative)
        for scan_root in scope.get("include_roots", []):
            base = root / scan_root
            if not base.exists():
                continue
            for path in base.rglob("*"):
                if path.is_file() and not any(part in excluded for part in path.relative_to(root).parts):
                    if not scope.get("extensions") or path.suffix.lower() in scope["extensions"]:
                        paths.add(path.relative_to(root).as_posix())
        found[scope["scope_id"]] = paths
    return found


def reconcile_inventory(root: Path = ROOT, registry: dict[str, Any] | None = None) -> list[str]:
    registry = registry or json.loads((root / "data" / "license-registry.json").read_text(encoding="utf-8"))
    manifest = json.loads((root / "data" / "commercialization-inventory.json").read_text(encoding="utf-8"))
    resources = registry.get("resources", [])
    actual = _manifest_inventory(root)
    covered = {entry for resource in resources for entry in resource.get("inventory_entries", [])}
    errors: list[str] = []
    for category, entries in actual.items():
        for entry in sorted(entries):
            if entry not in covered:
                errors.append(f"unregistered_inventory:{category}:{entry}")
    declared = registry.get("inventory", {})
    for manifest_name, entries in declared.get("frontend_package_manifests", {}).items():
        if manifest_name == "frontend/package.json" and set(entries) != actual["frontend_packages"]:
            errors.append("inventory_manifest_mismatch:frontend/package.json")
    for manifest_name, entries in declared.get("backend_requirements", {}).items():
        if manifest_name == "backend/requirements.txt" and {str(item).lower() for item in entries} != actual["backend_requirements"]:
            errors.append("inventory_manifest_mismatch:backend/requirements.txt")
    for scope in manifest.get("scopes", []):
        registered = set(scope.get("registered_paths", []))
        for path in sorted(_scan_manifest_sources(root, manifest).get(scope["scope_id"], set())):
            if path not in registered:
                errors.append(f"unregistered_repository_resource:{scope['scope_id']}:{path}")
    return sorted(set(errors))


def _validate(registry: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    resources = registry.get("resources", [])
    if set(registry.get("usage_statuses", [])) != ALLOWED_STATUSES:
        errors.append("usage_statuses_mismatch")
    if set(registry.get("replacement_statuses", [])) != ALLOWED_REPLACEMENT_STATUSES:
        errors.append("replacement_statuses_mismatch")
    seen: set[str] = set()
    for resource in resources:
        resource_id = resource.get("resource_id", "<missing>")
        if resource_id in seen:
            errors.append(f"duplicate_resource:{resource_id}")
        seen.add(resource_id)
        missing = sorted(REQUIRED_FIELDS - resource.keys())
        if missing:
            errors.append(f"missing_fields:{resource_id}:{','.join(missing)}")
            continue
        status = resource["usage_status"]
        if status not in ALLOWED_STATUSES:
            errors.append(f"invalid_usage_status:{resource_id}")
        for field in ("private_use_allowed", "commercial_use_allowed", "commercial_license_required", "commercial_replacement_required", "technical_usable", "commercial_ready"):
            if not _bool(resource[field]):
                errors.append(f"boolean_required:{resource_id}:{field}")
        for field in ("source_name", "source_url", "license_name", "commercial_action", "commercial_evidence", "notes"):
            if not isinstance(resource[field], str) or not resource[field].strip():
                errors.append(f"provenance_required:{resource_id}:{field}")
        if not isinstance(resource["inventory_entries"], list) or any(not isinstance(entry, str) or not entry.strip() for entry in resource["inventory_entries"]):
            errors.append(f"inventory_entries_invalid:{resource_id}")
        if status == "COMMERCIAL_OK":
            if not resource["private_use_allowed"] or not resource["commercial_use_allowed"] or resource["commercial_license_required"] or resource["commercial_replacement_required"]:
                errors.append(f"commercial_ok_truth_table:{resource_id}")
            if not resource["commercial_ready"] or not resource["commercial_evidence"].strip():
                errors.append(f"commercial_ok_evidence_required:{resource_id}")
        elif resource["commercial_ready"]:
            errors.append(f"commercial_ready_requires_commercial_ok:{resource_id}")
        if status == "PROHIBITED" and (resource["private_use_allowed"] or resource["commercial_use_allowed"] or resource["technical_usable"]):
            errors.append(f"prohibited_truth_table:{resource_id}")
        if not resource["technical_usable"] and resource["inventory_entries"]:
            errors.append(f"nonusable_resource_in_runtime_inventory:{resource_id}")
    replacements = registry.get("commercial_replacements", [])
    resource_map = {resource.get("resource_id"): resource for resource in resources}
    replacement_ids: set[str] = set()
    for replacement in replacements:
        resource_id = replacement.get("resource_id", "<missing>")
        if resource_id in replacement_ids:
            errors.append(f"duplicate_replacement:{resource_id}")
        replacement_ids.add(resource_id)
        if resource_id not in resource_map:
            errors.append(f"orphan_replacement:{resource_id}")
        for field in ("resource_id", "current_source", "current_license", "commercial_issue", "replacement_candidate", "license_option", "estimated_work", "status", "evidence"):
            if not isinstance(replacement.get(field), str) or not replacement[field].strip() and field != "evidence":
                errors.append(f"replacement_missing:{resource_id}:{field}")
        if replacement.get("status") not in ALLOWED_REPLACEMENT_STATUSES:
            errors.append(f"invalid_replacement_status:{resource_id}")
        if replacement.get("status") == "RESOLVED" and not str(replacement.get("evidence", "")).strip():
            errors.append(f"resolved_replacement_evidence_required:{resource_id}")
    expected_replacements = {resource["resource_id"] for resource in resources if resource.get("commercial_replacement_required") and not resource.get("commercial_ready")}
    if replacement_ids != expected_replacements:
        errors.append("replacement_registry_incomplete_or_has_orphans")
    errors.extend(reconcile_inventory(ROOT, registry))
    return errors


def audit_registry(build_target: str = "family") -> dict[str, Any]:
    if build_target not in BUILD_TARGETS:
        raise ValueError("invalid_build_target")
    registry = load_registry()
    resources = registry.get("resources", [])
    validation_errors = _validate(registry)
    warnings: list[dict[str, Any]] = []
    blockers: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []
    for resource in resources:
        status = resource.get("usage_status")
        if not resource.get("technical_usable", False):
            result, reason = "EXCLUDED", "technical_usable=false; excluded from runtime/build"
        elif build_target == "family":
            result, reason = ("FAIL", "resource is prohibited for the current usage") if status == "PROHIBITED" else (("WARNING", resource.get("commercial_action", "commercial review required")) if status != "COMMERCIAL_OK" or not resource.get("commercial_ready") else ("PASS", "commercially ready"))
        elif status == "COMMERCIAL_OK" and resource.get("commercial_ready"):
            result, reason = "PASS", "commercially ready"
        else:
            result, reason = "FAIL", resource.get("commercial_action", "commercial blocker")
        entry = {"resource_id": resource.get("resource_id"), "resource_type": resource.get("resource_type"), "source_name": resource.get("source_name"), "usage_status": status, "technical_usable": resource.get("technical_usable"), "commercial_ready": resource.get("commercial_ready"), "result": result, "reason": reason}
        results.append(entry)
        if result == "WARNING": warnings.append(entry)
        if result == "FAIL": blockers.append(entry)
    for error in validation_errors:
        blockers.append({"resource_id": "registry", "resource_type": "registry", "source_name": "license-registry.json", "usage_status": "LICENSE_REVIEW_REQUIRED", "commercial_ready": False, "result": "FAIL", "reason": error})
    by_type: dict[str, dict[str, int]] = {}
    for resource in resources:
        bucket = by_type.setdefault(resource.get("resource_type", "unknown"), {"total": 0, "commercial_ready": 0, "blockers": 0, "excluded": 0})
        bucket["total"] += 1
        bucket["commercial_ready"] += int(resource.get("commercial_ready") is True)
        bucket["excluded"] += int(resource.get("technical_usable") is False)
    for blocker in blockers:
        if blocker.get("resource_type") in by_type: by_type[blocker["resource_type"]]["blockers"] += 1
    reconciliation = {"status": "FAIL" if any(error.startswith("unregistered_inventory") or error.startswith("inventory_manifest") for error in validation_errors) else "PASS", "errors": [error for error in validation_errors if error.startswith(("unregistered_inventory", "inventory_manifest"))]}
    return {"build_target": build_target, "status": "FAIL" if blockers else "WARNING" if warnings else "PASS", "commercial_blockers": len(blockers), "warnings": len(warnings), "readiness": {"dependencies": len(resources), "commercial_ready": sum(resource.get("commercial_ready") is True for resource in resources), "need_license": sum(resource.get("commercial_license_required") is True and resource.get("commercial_ready") is not True for resource in resources), "need_replacement": sum(resource.get("commercial_replacement_required") is True and resource.get("commercial_ready") is not True for resource in resources), "need_review": sum(resource.get("usage_status") == "LICENSE_REVIEW_REQUIRED" for resource in resources)}, "by_resource_type": by_type, "resources": results, "commercial_replacements": registry.get("commercial_replacements", []), "inventory_reconciliation": reconciliation, "validation_errors": validation_errors, "admin_only": True}
