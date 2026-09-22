import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ALLOWED = {
    "PRIVATE_OK",
    "COMMERCIAL_OK",
    "COMMERCIAL_LICENSE_REQUIRED",
    "LICENSE_REVIEW_REQUIRED",
    "REPLACE_BEFORE_COMMERCIAL",
    "PROHIBITED",
}
REQUIRED = {
    "resource_id",
    "resource_type",
    "source_name",
    "source_url",
    "license_name",
    "usage_status",
    "private_use_allowed",
    "commercial_use_allowed",
    "commercial_license_required",
    "commercial_replacement_required",
    "technical_usable",
    "commercial_ready",
    "commercial_action",
    "notes",
}


def test_license_registry_entries_are_complete():
    registry = json.loads((ROOT / "data" / "license-registry.json").read_text(encoding="utf-8"))
    assert set(registry["usage_statuses"]) == ALLOWED
    for resource in registry["resources"]:
        assert REQUIRED <= resource.keys()
        assert resource["usage_status"] in ALLOWED
        if resource["usage_status"] == "COMMERCIAL_OK":
            assert resource["commercial_ready"] is True
        if resource["commercial_ready"] is False:
            assert resource["commercial_action"]
