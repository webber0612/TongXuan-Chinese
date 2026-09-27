from __future__ import annotations

import sqlite3
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def production_client(tmp_path: Path, monkeypatch) -> TestClient:
    import importlib
    monkeypatch.setenv("TONGXUAN_ENV", "production")
    monkeypatch.setenv("TONGXUAN_DB_PATH", str(tmp_path / "parent-auth.sqlite3"))
    monkeypatch.setenv("TONGXUAN_BACKUP_DIR", str(tmp_path / "backups"))
    monkeypatch.setenv("TONGXUAN_AUTH_SECRET", "issue66-production-secret-with-more-than-32-bytes")
    monkeypatch.setenv("TONGXUAN_PARENT_PASSWORD", "not-used-for-google-parent-auth")
    monkeypatch.setenv("TONGXUAN_ALLOWED_ORIGINS", "https://family.example")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "family-web-client.apps.googleusercontent.com")
    from app import main
    # CORS middleware captures allowed origins when the FastAPI application is
    # constructed. Rebuild it after applying the production test environment.
    main = importlib.reload(main)
    return TestClient(main.app, base_url="https://family.example")


def sign_in(api: TestClient, credential: str) -> dict:
    headers = {"Origin": "https://family.example"}
    csrf = api.get("/api/auth/google/csrf", headers=headers)
    assert csrf.status_code == 200, csrf.text
    result = api.post(
        "/api/auth/google",
        headers=headers,
        json={"credential": credential, "g_csrf_token": csrf.json()["csrfToken"]},
    )
    assert result.status_code == 200, result.text
    return result.json()


def cookie_write_headers(api: TestClient) -> dict[str, str]:
    session = api.get("/api/auth/session")
    assert session.status_code == 200
    token = session.json().get("csrfToken")
    assert isinstance(token, str) and token
    return {"Origin": "https://family.example", "X-CSRF-Token": token}


def test_google_auth_identity_csrf_and_parent_owned_child_lifecycle(tmp_path, monkeypatch):
    from app import auth
    from app.database import connect

    monkeypatch.setattr(auth, "verify_google_id_token", lambda credential, client_id: {
        "sub": "google-sub-parent-a" if credential != "parent-b-token" else "google-sub-parent-b",
        "email": "same@example.com",
        "name": "Parent A" if credential != "parent-b-token" else "Parent B",
    })
    with production_client(tmp_path, monkeypatch) as api:
        preflight = api.options(
            "/api/children",
            headers={
                "Origin": "https://family.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,x-csrf-token",
            },
        )
        assert preflight.status_code == 200
        assert "x-csrf-token" in preflight.headers.get("access-control-allow-headers", "").lower()

        # A pre-migration learner remains present but is intentionally unowned.
        with connect() as db:
            legacy_id = int(db.execute("INSERT INTO children(name) VALUES('Legacy learner')").lastrowid)

        csrf = api.get("/api/auth/google/csrf", headers={"Origin": "https://family.example"})
        assert csrf.status_code == 200
        token = csrf.json()["csrfToken"]
        invalid_csrf = api.post(
            "/api/auth/google", headers={"Origin": "https://family.example"},
            json={"credential": "parent-a-token", "g_csrf_token": "mismatched-token"},
        )
        assert invalid_csrf.status_code == 403
        assert invalid_csrf.json()["detail"] == "csrf_validation_failed"
        assert api.get("/api/auth/session").json()["authenticated"] is False

        login = api.post(
            "/api/auth/google", headers={"Origin": "https://family.example"},
            json={"credential": "parent-a-token", "g_csrf_token": token},
        )
        assert login.status_code == 200, login.text
        cookie = login.headers["set-cookie"].lower()
        assert "tongxuan_session=" in cookie and "httponly" in cookie and "secure" in cookie and "samesite=none" in cookie
        assert "google-sub-parent-a" not in login.text
        session = api.get("/api/auth/session").json()
        assert session["authRequired"] is True
        assert session["authenticated"] is True
        assert session["role"] == "parent"
        parent_id = session["parent"]["id"]
        csrf = session["csrfToken"]
        assert isinstance(csrf, str) and csrf
        assert api.cookies.get("tongxuan_csrf") == csrf

        assert api.post("/api/children", json={"name": "No origin"}).status_code == 403
        assert api.post("/api/children", headers={"Origin": "https://attacker.example", "X-CSRF-Token": csrf}, json={"name": "Bad origin"}).status_code == 403
        assert api.post("/api/children", headers={"Origin": "https://family.example", "X-CSRF-Token": "wrong"}, json={"name": "Bad csrf"}).status_code == 403
        write_headers = cookie_write_headers(api)
        first = api.post("/api/children", headers=write_headers, json={"name": "Child A"})
        second = api.post("/api/children", headers=write_headers, json={"name": "Child B"})
        assert first.status_code == second.status_code == 200
        child_ids = {first.json()["id"], second.json()["id"]}
        assert {child["id"] for child in api.get("/api/children").json()} == child_ids
        assert legacy_id not in {child["id"] for child in api.get("/api/children").json()}
        assert api.get(f"/api/children/{first.json()['id']}/learning-daily-queue").status_code == 200
        assert api.get(f"/api/children/{first.json()['id']}/placement-profile").status_code == 200
        assert api.get(f"/api/children/{first.json()['id']}/learning-sessions/report").status_code == 200
        assert api.post("/api/children", headers=write_headers, json={"name": "Forged", "parent_id": parent_id}).status_code == 422

        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM children WHERE parent_id=?", (parent_id,)).fetchone()[0] == 2
            assert db.execute("SELECT parent_id FROM children WHERE id=?", (legacy_id,)).fetchone()[0] is None

        # Stable sub resolves the same parent even if the mutable email/name changes.
        assert api.post("/api/auth/logout").status_code == 403
        assert api.post("/api/auth/logout", headers={"Origin": "https://attacker.example"}).status_code == 403
        assert api.post("/api/auth/logout", headers={"Origin": "https://family.example"}).status_code == 200
        from app.parent_accounts import upsert_google_parent
        refreshed = upsert_google_parent(google_sub="google-sub-parent-a", email="changed@example.com", display_name="Updated Parent")
        assert refreshed["id"] == parent_id
        assert refreshed["email"] == "changed@example.com"

        api.post("/api/auth/logout", headers={"Origin": "https://family.example"})
        sign_in(api, "parent-b-token")
        second_parent_headers = cookie_write_headers(api)
        third = api.post("/api/children", headers=second_parent_headers, json={"name": "Child C"})
        assert third.status_code == 200
        assert [child["name"] for child in api.get("/api/children").json()] == ["Child C"]
        assert api.get(f"/api/children/{first.json()['id']}/learning-daily-queue").status_code == 403
        assert api.get(f"/api/children/{first.json()['id']}/placement-profile").status_code == 403
        assert api.get(f"/api/children/{first.json()['id']}/learning-sessions/report").status_code == 403
        assert api.get(f"/api/dashboard?child_id={first.json()['id']}").status_code == 403
        assert api.post(
            f"/api/children/{first.json()['id']}/learning-sessions",
            headers=second_parent_headers,
            json={"lessonId": "starter-l01"},
        ).status_code == 403
        assert api.post(
            "/api/tts/speak",
            headers=second_parent_headers,
            json={"text": "你好", "locale": "zh-TW", "text_kind": "sentence", "child_id": first.json()["id"]},
        ).status_code == 403
        assert api.get(f"/api/children/{third.json()['id']}/learning-daily-queue").status_code == 200
        api.post("/api/auth/logout", headers={"Origin": "https://family.example"})
        assert api.get("/api/auth/session").json()["authenticated"] is False
        assert api.get("/api/children").status_code == 401


def test_google_login_rejects_invalid_token_and_untrusted_origin_without_persisting_parent(tmp_path, monkeypatch):
    from app import auth
    from app.database import connect

    verifier_calls = []

    def reject(credential, client_id):
        verifier_calls.append((credential, client_id))
        raise ValueError("invalid token")

    monkeypatch.setattr(auth, "verify_google_id_token", reject)
    with production_client(tmp_path, monkeypatch) as api:
        csrf = api.get("/api/auth/google/csrf", headers={"Origin": "https://family.example"}).json()["csrfToken"]
        bad_origin = api.post(
            "/api/auth/google", headers={"Origin": "https://attacker.example"},
            json={"credential": "bad-token", "g_csrf_token": csrf},
        )
        assert bad_origin.status_code == 403
        bad_credential = api.post(
            "/api/auth/google", headers={"Origin": "https://family.example"},
            json={"credential": "bad-token", "g_csrf_token": csrf},
        )
        assert bad_credential.status_code == 401
        assert verifier_calls == [("bad-token", "family-web-client.apps.googleusercontent.com")]
        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM google_parents").fetchone()[0] == 0


def test_google_auth_library_verifier_checks_claim_contract(monkeypatch):
    from google.oauth2 import id_token
    from app.auth import verify_google_id_token

    now = int(time.time())
    observed = []
    claims = {"sub": "google-sub-1", "iss": "https://accounts.google.com", "aud": "client-1", "exp": now + 600, "email": "parent@example.com", "name": "Parent"}

    def verify(token, request, audience):
        observed.append((token, audience))
        return claims

    monkeypatch.setattr(id_token, "verify_oauth2_token", verify)
    assert verify_google_id_token("signed-token", "client-1")["sub"] == "google-sub-1"
    assert observed == [("signed-token", "client-1")]
    for invalid in [
        {**claims, "aud": "other-client"},
        {**claims, "iss": "https://attacker.example"},
        {**claims, "exp": now - 1},
        {**claims, "sub": ""},
    ]:
        monkeypatch.setattr(id_token, "verify_oauth2_token", lambda *_args, invalid=invalid: invalid)
        with pytest.raises(ValueError, match="invalid_google_credential"):
            verify_google_id_token("signed-token", "client-1")


def test_expired_parent_cookie_session_is_unauthorized_and_bearer_internal_adapter_stays_supported(tmp_path, monkeypatch):
    from app.auth import issue_session
    from app.database import connect

    with production_client(tmp_path, monkeypatch) as api:
        expired = issue_session(subject="expired-parent", role="parent", ttl_seconds=-1, parent_id=1)
        api.cookies.set("tongxuan_session", expired, domain="family.example", path="/api")
        assert api.get("/api/auth/session").json() == {
            "authRequired": True, "authenticated": False, "role": None, "parent": None,
        }
        assert api.get("/api/children").status_code == 401

        bearer = issue_session(subject="internal-tool", role="developer")
        response = api.post(
            "/api/children",
            headers={"Authorization": f"Bearer {bearer}"},
            json={"name": "Internal learner"},
        )
        assert response.status_code == 200, response.text
        with connect() as db:
            assert db.execute("SELECT name,parent_id FROM children WHERE id=?", (response.json()["id"],)).fetchone()[1] is None


def test_schema_v5_migration_keeps_legacy_children_unowned(tmp_path, monkeypatch):
    path = tmp_path / "legacy-v4.sqlite3"
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE children(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
        db.execute("INSERT INTO children(name) VALUES('Unclaimed child')")
        db.execute("PRAGMA user_version=4")
    monkeypatch.setenv("TONGXUAN_DB_PATH", str(path))
    from app.database import connect, initialize_database

    initialize_database()
    with connect() as db:
        row = db.execute("SELECT id,name,parent_id FROM children").fetchone()
        assert tuple(row) == (1, "Unclaimed child", None)
        assert db.execute("PRAGMA user_version").fetchone()[0] == 5
        assert db.execute("SELECT COUNT(*) FROM google_parents").fetchone()[0] == 0
        assert db.execute("SELECT description FROM schema_migrations WHERE version=5").fetchone()[0] == "Google parent identity and nullable child ownership"
