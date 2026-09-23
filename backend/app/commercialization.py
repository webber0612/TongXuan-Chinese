"""Phase 18 deterministic Commercialization Gate read model."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ALLOWED_STATUSES = {"PRIVATE_OK", "COMMERCIAL_OK", "COMMERCIAL_LICENSE_REQUIRED", "LICENSE_REVIEW_REQUIRED", "REPLACE_BEFORE_COMMERCIAL", "PROHIBITED"}
BUILD_TARGETS = {"family", "commercial"}
REQUIRED_FIELDS = {"resource_id", "resource_type", "source_name", "source_url", "license_name", "usage_status", "private_use_allowed", "commercial_use_allowed", "commercial_license_required", "commercial_replacement_required", "technical_usable", "commercial_ready", "commercial_action", "notes"}
ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "data" / "license-registry.json"


def load_registry() -> dict[str, Any]:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def _validate(registry: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if set(registry.get("usage_statuses", [])) != ALLOWED_STATUSES:
        errors.append("usage_statuses_mismatch")
    seen: set[str] = set()
    for resource in registry.get("resources", []):
        resource_id = resource.get("resource_id", "<missing>")
        if resource_id in seen:
            errors.append(f"duplicate_resource:{resource_id}")
        seen.add(resource_id)
        missing = sorted(REQUIRED_FIELDS - resource.keys())
        if missing:
            errors.append(f"missing_fields:{resource_id}:{','.join(missing)}")
            continue
        if resource["usage_status"] not in ALLOWED_STATUSES:
            errors.append(f"invalid_usage_status:{resource_id}")
        if resource["usage_status"] == "COMMERCIAL_OK" and not resource["commercial_ready"]:
            errors.append(f"commercial_ok_not_ready:{resource_id}")
        if resource["commercial_ready"] is False and not str(resource["commercial_action"]).strip():
            errors.append(f"missing_commercial_action:{resource_id}")
    for replacement in registry.get("commercial_replacements", []):
        for field in ("resource_id", "current_source", "current_license", "commercial_issue", "replacement_candidate", "license_option", "estimated_work", "status"):
            if not str(replacement.get(field, "")).strip():
                errors.append(f"replacement_missing:{replacement.get('resource_id', '<missing>')}:{field}")
    return errors


def audit_registry(build_target: str = "family") -> dict[str, Any]:
    if build_target not in BUILD_TARGETS:
        raise ValueError("invalid_build_target")
    registry = load_registry()
    validation_errors = _validate(registry)
    resources = registry.get("resources", [])
    warnings: list[dict[str, Any]] = []
    blockers: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []
    for resource in resources:
        status = resource.get("usage_status")
        ready = bool(resource.get("commercial_ready"))
        if build_target == "family":
            if status == "PROHIBITED":
                result, reason = "FAIL", "resource is prohibited for the current usage"
            elif status != "COMMERCIAL_OK" or not ready:
                result, reason = "WARNING", resource.get("commercial_action", "commercial review required")
            else:
                result, reason = "PASS", "commercially ready"
        elif status == "COMMERCIAL_OK" and ready:
            result, reason = "PASS", "commercially ready"
        else:
            result, reason = "FAIL", resource.get("commercial_action", "commercial blocker")
        entry = {"resource_id": resource.get("resource_id"), "resource_type": resource.get("resource_type"), "source_name": resource.get("source_name"), "usage_status": status, "commercial_ready": ready, "result": result, "reason": reason}
        results.append(entry)
        if result == "WARNING":
            warnings.append(entry)
        if result == "FAIL":
            blockers.append(entry)
    for error in validation_errors:
        blockers.append({"resource_id": "registry", "resource_type": "registry", "source_name": "license-registry.json", "usage_status": "LICENSE_REVIEW_REQUIRED", "commercial_ready": False, "result": "FAIL", "reason": error})
    by_type: dict[str, dict[str, int]] = {}
    for resource in resources:
        bucket = by_type.setdefault(resource.get("resource_type", "unknown"), {"total": 0, "commercial_ready": 0, "blockers": 0})
        bucket["total"] += 1
        bucket["commercial_ready"] += int(bool(resource.get("commercial_ready")))
    for blocker in blockers:
        if blocker.get("resource_type") in by_type:
            by_type[blocker["resource_type"]]["blockers"] += 1
    return {"build_target": build_target, "status": "FAIL" if blockers else "WARNING" if warnings else "PASS", "commercial_blockers": len(blockers), "warnings": len(warnings), "readiness": {"dependencies": len(resources), "commercial_ready": sum(bool(r.get("commercial_ready")) for r in resources), "need_license": sum(bool(r.get("commercial_license_required")) and not bool(r.get("commercial_ready")) for r in resources), "need_replacement": sum(bool(r.get("commercial_replacement_required")) and not bool(r.get("commercial_ready")) for r in resources), "need_review": sum(r.get("usage_status") == "LICENSE_REVIEW_REQUIRED" for r in resources)}, "by_resource_type": by_type, "resources": results, "commercial_replacements": registry.get("commercial_replacements", []), "validation_errors": validation_errors, "admin_only": True}
