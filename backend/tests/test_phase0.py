from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def make_client(tmp_path: Path):
    import os

    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "diagnostic.sqlite3")
    from app.main import app

    return TestClient(app)


def test_health(tmp_path):
    with make_client(tmp_path) as client:
        assert client.get("/api/health").json() == {"status": "ok"}


def test_sqlite_crud(tmp_path):
    with make_client(tmp_path) as client:
        result = client.post("/api/diagnostics/sqlite")
        assert result.status_code == 200
        assert all(result.json()["operations"].values())
        assert (tmp_path / "diagnostic.sqlite3").exists()


@pytest.mark.parametrize(
    ("direction", "expected"),
    [
        ("s2t", "學校環境保護"),
        ("s2tw", "學校環境保護"),
        ("t2s", "学校环境保护"),
    ],
)
def test_opencc_adapter(tmp_path, direction, expected):
    with make_client(tmp_path) as client:
        source = "学校环境保护" if direction != "t2s" else "學校環境保護"
        result = client.post("/api/tools/convert", json={"text": source, "direction": direction})
        assert result.status_code == 200
        assert result.json()["text"] == expected


def test_opencc_rejects_unknown_direction(tmp_path):
    with make_client(tmp_path) as client:
        assert client.post("/api/tools/convert", json={"text": "學", "direction": "bad"}).status_code == 400
