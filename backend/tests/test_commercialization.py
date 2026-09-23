import json
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "commercialization.sqlite3")
    from app.main import app
    return TestClient(app)


def test_registry_covers_resource_categories_and_complete_provenance():
    registry = json.loads((ROOT / "data" / "license-registry.json").read_text(encoding="utf-8"))
    types = {resource["resource_type"] for resource in registry["resources"]}
    assert {"technical_dependency", "family_learning_content", "image_asset", "audio_asset", "font_asset", "dataset", "third_party_api", "private_school_content"} <= types
    assert registry["commercial_replacements"]
    for resource in registry["resources"]:
        assert resource["source_name"] and "usage_status" in resource and "technical_usable" in resource and "commercial_ready" in resource


def test_family_gate_warns_and_admin_readiness_is_not_parent_dashboard(tmp_path):
    with client(tmp_path) as api:
        result = api.get("/api/admin/commercialization/readiness", params={"build_target": "family"})
        assert result.status_code == 200
        body = result.json()
        assert body["status"] == "WARNING"
        assert body["warnings"] > 0
        assert body["commercial_blockers"] == 0
        assert body["admin_only"] is True
        assert body["readiness"]["dependencies"] >= 8
        assert "commercial_replacements" in body
        assert "commercial_blockers" not in api.get("/api/dashboard", params={"child_id": 999}).json()


def test_commercial_gate_fails_non_ready_resources_and_preserves_private_school_ownership(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        school = api.post("/api/school-queue", params={"child_id": child_id}, json={"character": "學", "school_source": "Parent worksheet", "private_content": True, "provenance_status": "PRIVATE_OK"}).json()
        gate = api.get("/api/admin/commercialization/readiness", params={"build_target": "commercial"})
        assert gate.status_code == 200
        assert gate.json()["status"] == "FAIL"
        assert gate.json()["commercial_blockers"] > 0
        assert school["private_content"] == 1
        assert school["provenance_status"] == "PRIVATE_OK"
        assert api.get("/api/admin/commercialization/readiness", params={"build_target": "invalid"}).status_code == 400
