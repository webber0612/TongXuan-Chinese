import os
from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    os.environ["TONGXUAN_ENV"] = "development"
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "ui-audit.sqlite3")
    os.environ.pop("TONGXUAN_PARENT_PASSWORD", None)
    from app.main import app
    return TestClient(app)


def test_reward_redemption_requires_server_verified_password_and_never_echoes_it(tmp_path):
    with client(tmp_path) as api:
        child = api.post("/api/children", json={"name": "Alice"}).json()
        child_id = child["id"]
        api.post(f"/api/children/{child_id}/learning-items/seed", json={})
        session = api.post("/api/recognition/sessions", params={"child_id": child_id}).json()
        item = api.get(f"/api/recognition/sessions/{session['id']}/next", params={"child_id": child_id}).json()["item"]
        api.post(f"/api/recognition/sessions/{session['id']}/attempts", params={"child_id": child_id}, json={"item_id": item["id"], "result": "correct"})
        api.post(f"/api/recognition/sessions/{session['id']}/complete", params={"child_id": child_id})
        reward = api.get("/api/points", params={"child_id": child_id}).json()["rewards"][0]
        invalid = api.post(f"/api/points/redeem/{reward['id']}", params={"child_id": child_id}, json={"parent_password": "wrong-password"})
        assert invalid.status_code == 403
        assert "wrong-password" not in invalid.text
        valid = api.post(f"/api/points/redeem/{reward['id']}", params={"child_id": child_id}, json={"parent_password": "test-parent-password"})
        assert valid.status_code == 400  # points are insufficient in this setup; password passed the server gate


def test_production_redemption_requires_parent_or_privileged_session_and_password(tmp_path, monkeypatch):
    monkeypatch.setenv("TONGXUAN_ENV", "production")
    monkeypatch.setenv("TONGXUAN_DB_PATH", str(tmp_path / "production.sqlite3"))
    monkeypatch.setenv("TONGXUAN_BACKUP_DIR", str(tmp_path / "backups"))
    monkeypatch.setenv("TONGXUAN_AUTH_SECRET", "production-ui-audit-secret-01234567890123456789")
    monkeypatch.setenv("TONGXUAN_PARENT_PASSWORD", "production-parent-password")
    monkeypatch.setenv("TONGXUAN_ALLOWED_ORIGINS", "https://family.example")
    from app.auth import issue_session
    from app.main import app
    with TestClient(app) as api:
        admin = {"Authorization": f"Bearer {issue_session(subject='admin', role='admin')}"}
        child = api.post("/api/children", headers=admin, json={"name": "Alice"}).json()
        child_id = child["id"]
        reward = api.get("/api/points", headers=admin, params={"child_id": child_id}).json()["rewards"][0]
        unauthenticated = api.post(f"/api/points/redeem/{reward['id']}", params={"child_id": child_id}, json={"parent_password": "production-parent-password"})
        assert unauthenticated.status_code == 401
        parent = {"Authorization": f"Bearer {issue_session(subject='parent', role='parent', child_ids=[child_id])}"}
        wrong = api.post(f"/api/points/redeem/{reward['id']}", headers=parent, params={"child_id": child_id}, json={"parent_password": "wrong-password"})
        assert wrong.status_code == 403
        ok = api.post(f"/api/points/redeem/{reward['id']}", headers=parent, params={"child_id": child_id}, json={"parent_password": "production-parent-password"})
        assert ok.status_code == 400
