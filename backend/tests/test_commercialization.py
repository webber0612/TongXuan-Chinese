import json
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "commercialization.sqlite3")
    from app.main import app
    return TestClient(app)


def admin_headers():
    from app.auth import issue_session
    return {"Authorization": f"Bearer {issue_session(subject='architect', role='admin')}"}


def parent_headers():
    from app.auth import issue_session
    return {"Authorization": f"Bearer {issue_session(subject='parent-alice', role='parent')}"}


def test_registry_covers_resource_categories_and_complete_provenance():
    registry = json.loads((ROOT / "data" / "license-registry.json").read_text(encoding="utf-8"))
    types = {resource["resource_type"] for resource in registry["resources"]}
    assert {"technical_dependency", "family_learning_content", "image_asset", "audio_asset", "font_asset", "dataset", "third_party_api", "private_school_content"} <= types
    assert registry["commercial_replacements"]
    for resource in registry["resources"]:
        assert resource["source_name"] and resource["source_url"] and resource["license_name"]
        assert "usage_status" in resource and "technical_usable" in resource and "commercial_ready" in resource
        assert type(resource["technical_usable"]) is bool and type(resource["commercial_ready"]) is bool
        assert resource["commercial_evidence"]


def test_repository_inventory_manifest_is_registered_and_drift_is_detected(tmp_path):
    from app.commercialization import reconcile_inventory
    assert reconcile_inventory() == []
    (tmp_path / "frontend").mkdir(parents=True)
    (tmp_path / "backend").mkdir(parents=True)
    (tmp_path / "backend" / "app").mkdir(parents=True)
    (tmp_path / "data").mkdir(parents=True)
    (tmp_path / "frontend" / "package.json").write_text('{"dependencies": {}}', encoding="utf-8")
    (tmp_path / "backend" / "requirements.txt").write_text("", encoding="utf-8")
    (tmp_path / "backend" / "app" / "new_provider.py").write_text("class NewProvider: pass\n", encoding="utf-8")
    (tmp_path / "data" / "license-registry.json").write_text('{"resources": []}', encoding="utf-8")
    (tmp_path / "data" / "commercialization-inventory.json").write_text(json.dumps({"excluded_directories": [], "scopes": [{"scope_id": "providers", "include_globs": ["backend/app/*provider*.py"], "registered_paths": []}]}), encoding="utf-8")
    errors = reconcile_inventory(tmp_path)
    assert "unregistered_repository_resource:providers:backend/app/new_provider.py" in errors


def test_repository_inventory_manifest_registered_source_passes(tmp_path):
    from app.commercialization import reconcile_inventory
    (tmp_path / "frontend").mkdir(parents=True)
    (tmp_path / "backend").mkdir(parents=True)
    (tmp_path / "data").mkdir(parents=True)
    (tmp_path / "frontend" / "package.json").write_text('{"dependencies": {}}', encoding="utf-8")
    (tmp_path / "backend" / "requirements.txt").write_text("", encoding="utf-8")
    (tmp_path / "data" / "license-registry.json").write_text('{"resources": []}', encoding="utf-8")
    (tmp_path / "data" / "commercialization-inventory.json").write_text(json.dumps({"excluded_directories": [], "scopes": []}), encoding="utf-8")
    assert reconcile_inventory(tmp_path) == []


def test_family_gate_warns_and_admin_readiness_is_not_parent_dashboard(tmp_path):
    with client(tmp_path) as api:
        result = api.get("/api/admin/commercialization/readiness", params={"build_target": "family"}, headers=admin_headers())
        assert result.status_code == 200
        body = result.json()
        assert body["status"] == "WARNING"
        assert body["warnings"] > 0
        assert body["commercial_blockers"] == 0
        assert body["admin_only"] is True
        assert body["readiness"]["dependencies"] >= 8
        assert "commercial_replacements" in body
        assert body["inventory_reconciliation"]["status"] == "PASS"
        assert api.get("/api/admin/commercialization/readiness", headers=parent_headers()).status_code == 403
        assert api.get("/api/admin/commercialization/readiness").status_code == 401
        assert "commercial_blockers" not in api.get("/api/dashboard", params={"child_id": 999}).json()


def test_commercial_gate_fails_non_ready_resources_and_preserves_private_school_ownership(tmp_path):
    with client(tmp_path) as api:
        child_id = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        school = api.post("/api/school-queue", params={"child_id": child_id}, json={"character": "學", "school_source": "Parent worksheet", "private_content": True, "provenance_status": "PRIVATE_OK"}).json()
        gate = api.get("/api/admin/commercialization/readiness", params={"build_target": "commercial"}, headers=admin_headers())
        assert gate.status_code == 200
        assert gate.json()["status"] == "FAIL"
        assert gate.json()["commercial_blockers"] > 0
        assert school["private_content"] == 1
        assert school["provenance_status"] == "PRIVATE_OK"
        assert api.get("/api/admin/commercialization/readiness", params={"build_target": "invalid"}, headers=admin_headers()).status_code == 400


def test_school_queue_rejects_forged_public_or_shared_provenance_and_keeps_children_isolated(tmp_path):
    with client(tmp_path) as api:
        alice = api.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob = api.post("/api/children", json={"name": "Bob"}).json()["id"]
        for forged in (
            {"private_content": False},
            {"provenance_status": "COMMERCIAL_OK"},
            {"source_type": "PUBLIC_CURRICULUM"},
            {"public_curriculum_reuse": True},
            {"commercial_reuse": True},
        ):
            response = api.post("/api/school-queue", params={"child_id": alice}, json={"character": "學", "school_source": "worksheet", **forged})
            assert response.status_code == 400
        created = api.post("/api/school-queue", params={"child_id": alice}, json={"character": "學", "school_source": "worksheet"})
        assert created.status_code == 200
        body = created.json()
        assert body["source_type"] == "USER_PROVIDED_SCHOOL_CONTENT"
        assert body["private_content"] == 1 and body["provenance_status"] == "PRIVATE_OK"
        assert body["public_curriculum_reuse"] is False and body["commercial_reuse"] is False
        assert api.get("/api/daily-queue", params={"child_id": bob}).json() == []
