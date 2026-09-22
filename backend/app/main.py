from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .database import connect, initialize_database
from .providers import OpenCCProvider


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="TongXuan Chinese API", version="0.1.0", lifespan=lifespan)
opencc_provider = OpenCCProvider()


class ConversionRequest(BaseModel):
    text: str = Field(min_length=1)
    direction: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/tools/convert")
def convert(request: ConversionRequest) -> dict[str, str]:
    try:
        converted = opencc_provider.convert(request.text, request.direction)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {"text": converted, "direction": request.direction}


@app.post("/api/diagnostics/sqlite")
def sqlite_diagnostic() -> dict[str, object]:
    name = "Phase 0 diagnostic child"
    with connect() as connection:
        cursor = connection.execute("INSERT INTO children (name) VALUES (?)", (name,))
        child_id = cursor.lastrowid
        created = connection.execute("SELECT name FROM children WHERE id = ?", (child_id,)).fetchone()
        connection.execute("UPDATE children SET name = ? WHERE id = ?", (name + " updated", child_id))
        updated = connection.execute("SELECT name FROM children WHERE id = ?", (child_id,)).fetchone()
        connection.execute("DELETE FROM children WHERE id = ?", (child_id,))
        deleted = connection.execute("SELECT 1 FROM children WHERE id = ?", (child_id,)).fetchone()
        connection.execute(
            "INSERT INTO diagnostic_events (name, status, details) VALUES (?, ?, ?)",
            ("sqlite-crud", "PASS", "create/read/update/delete"),
        )
    return {
        "status": "ok",
        "operations": {
            "create": child_id is not None,
            "read": created is not None and created["name"] == name,
            "update": updated is not None and updated["name"].endswith(" updated"),
            "delete": deleted is None,
        },
    }
