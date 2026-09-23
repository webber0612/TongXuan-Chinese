"""Environment/configuration contract for production deployment."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

VALID_ENVIRONMENTS = {"development", "test", "staging", "production"}


@dataclass(frozen=True)
class Settings:
    environment: str
    db_path: Path
    backup_dir: Path | None
    allowed_origins: tuple[str, ...]
    auth_secret: str
    build_target: str
    parent_password: str


def load_settings() -> Settings:
    environment = os.getenv("TONGXUAN_ENV", "development").strip().lower()
    origins = tuple(item.strip() for item in os.getenv("TONGXUAN_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if item.strip())
    backup = os.getenv("TONGXUAN_BACKUP_DIR", "").strip()
    return Settings(
        environment=environment,
        db_path=Path(os.getenv("TONGXUAN_DB_PATH", "data/tongxuan.sqlite3")),
        backup_dir=Path(backup) if backup else None,
        allowed_origins=origins,
        auth_secret=os.getenv("TONGXUAN_AUTH_SECRET", ""),
        build_target=os.getenv("BUILD_TARGET", "family").strip().lower(),
        parent_password=os.getenv("TONGXUAN_PARENT_PASSWORD", "test-parent-password" if environment in {"development", "test"} else ""),
    )


def validate_settings(settings: Settings) -> list[str]:
    errors: list[str] = []
    if settings.environment not in VALID_ENVIRONMENTS:
        errors.append("invalid_environment")
    if settings.build_target not in {"family", "commercial"}:
        errors.append("invalid_build_target")
    if settings.environment == "production":
        if not settings.db_path.is_absolute():
            errors.append("production_db_path_must_be_absolute")
        if settings.backup_dir is None or not settings.backup_dir.is_absolute():
            errors.append("production_backup_dir_required")
        if settings.auth_secret == "" or len(settings.auth_secret) < 32:
            errors.append("production_auth_secret_required")
        if not settings.allowed_origins or "*" in settings.allowed_origins:
            errors.append("production_cors_origins_required")
        if settings.parent_password == "" or len(settings.parent_password) < 12:
            errors.append("production_parent_password_required")
    return errors
