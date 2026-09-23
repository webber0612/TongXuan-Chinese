"""Small server-verified session boundary for privileged read models.

The application does not expose a role-setting header or a public admin-login
endpoint.  A deployment/auth adapter provisions an opaque, HMAC-signed session
token and sends it as a bearer token or HttpOnly cookie.  The commercialization
route only accepts server-verified developer/admin sessions.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass

from fastapi import HTTPException, Request

_PROCESS_SECRET = secrets.token_bytes(32)
ALLOWED_ROLES = {"parent", "developer", "admin"}


@dataclass(frozen=True)
class Session:
    subject: str
    role: str
    expires_at: int
    child_ids: frozenset[int] = frozenset()


def _secret() -> bytes:
    configured = os.getenv("TONGXUAN_AUTH_SECRET")
    return configured.encode("utf-8") if configured else _PROCESS_SECRET


def issue_session(*, subject: str, role: str, ttl_seconds: int = 3600, child_ids: list[int] | None = None) -> str:
    """Provision a token for an external auth adapter or tests; never an API route."""
    if role not in ALLOWED_ROLES:
        raise ValueError("invalid_role")
    payload = {"subject": subject, "role": role, "exp": int(time.time()) + ttl_seconds, "child_ids": child_ids or []}
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(_secret(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def _read_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "")
    if authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()
    return request.cookies.get("tongxuan_session")


def authenticate(request: Request) -> Session:
    token = _read_token(request)
    if not token or "." not in token:
        raise HTTPException(status_code=401, detail="authentication_required")
    encoded, signature = token.rsplit(".", 1)
    expected = hmac.new(_secret(), encoded.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="invalid_session")
    try:
        padding = "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode((encoded + padding).encode()))
        session = Session(str(payload["subject"]), str(payload["role"]), int(payload["exp"]), frozenset(int(item) for item in payload.get("child_ids", [])))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=401, detail="invalid_session") from error
    if session.role not in ALLOWED_ROLES or session.expires_at <= int(time.time()):
        raise HTTPException(status_code=401, detail="invalid_session")
    return session


def require_commercialization_admin(request: Request) -> Session:
    session = authenticate(request)
    if session.role not in {"developer", "admin"}:
        raise HTTPException(status_code=403, detail="commercialization_admin_required")
    return session


def require_child_access(request: Request, child_id: int) -> Session | None:
    """Enforce child scope only in production; development remains local/no-auth compatible."""
    from .config import load_settings
    if load_settings().environment != "production":
        return None
    session = authenticate(request)
    if session.role == "parent" and child_id not in session.child_ids:
        raise HTTPException(status_code=403, detail="child_access_denied")
    return session


def require_production_session(request: Request) -> Session | None:
    from .config import load_settings
    return authenticate(request) if load_settings().environment == "production" else None
