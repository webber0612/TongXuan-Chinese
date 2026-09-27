"""Persistent parent identity and child ownership data access."""
from __future__ import annotations

from typing import Any

from .database import connect, initialize_database


def upsert_google_parent(*, google_sub: str, email: str = "", display_name: str = "") -> dict[str, Any]:
    """Resolve a Google identity by its immutable subject, never by email."""
    initialize_database()
    with connect() as db:
        row = db.execute("SELECT id FROM google_parents WHERE google_sub=?", (google_sub,)).fetchone()
        if row is None:
            cursor = db.execute(
                "INSERT INTO google_parents(google_sub,email,display_name) VALUES(?,?,?)",
                (google_sub, email, display_name),
            )
            parent_id = int(cursor.lastrowid)
        else:
            parent_id = int(row["id"])
            db.execute(
                "UPDATE google_parents SET email=?,display_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (email, display_name, parent_id),
            )
        parent = db.execute(
            "SELECT id,google_sub,email,display_name,created_at,updated_at FROM google_parents WHERE id=?",
            (parent_id,),
        ).fetchone()
        return dict(parent)


def get_parent(parent_id: int) -> dict[str, Any] | None:
    initialize_database()
    with connect() as db:
        row = db.execute(
            "SELECT id,google_sub,email,display_name,created_at,updated_at FROM google_parents WHERE id=?",
            (parent_id,),
        ).fetchone()
        return dict(row) if row else None


def list_owned_children(parent_id: int) -> list[dict[str, Any]]:
    initialize_database()
    with connect() as db:
        return [dict(row) for row in db.execute(
            "SELECT id,name,created_at FROM children WHERE parent_id=? ORDER BY id",
            (parent_id,),
        )]


def create_owned_child(*, parent_id: int, name: str) -> dict[str, Any]:
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("child_name_required")
    initialize_database()
    with connect() as db:
        if db.execute("SELECT 1 FROM google_parents WHERE id=?", (parent_id,)).fetchone() is None:
            raise ValueError("parent_not_found")
        cursor = db.execute("INSERT INTO children(name,parent_id) VALUES(?,?)", (clean_name, parent_id))
        row = db.execute("SELECT id,name,created_at FROM children WHERE id=?", (cursor.lastrowid,)).fetchone()
        return dict(row)


def parent_owns_child(parent_id: int, child_id: int) -> bool:
    initialize_database()
    with connect() as db:
        return db.execute(
            "SELECT 1 FROM children WHERE id=? AND parent_id=?",
            (child_id, parent_id),
        ).fetchone() is not None
