from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.lesson_packages import get_lesson_package, list_lesson_packages, validate_package_review_status


def make_client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "lesson_player.sqlite3")
    from app.main import app
    return TestClient(app)


def test_lesson_package_book1_l01_golden_content():
    pkg = get_lesson_package("book1-l01")
    assert pkg is not None
    assert pkg["lessonId"] == "book1-l01"
    assert pkg["curriculumSource"]["title"] == "你好"
    assert pkg["curriculumSource"]["provenanceStatus"] == "VERIFIED_OFFICIAL_TITLE"

    # Strict content containment: strictly 你 and 好, no 日/月/星/光
    chars = [c["char"] for c in pkg["characters"]]
    assert chars == ["你", "好"]
    assert "日" not in chars
    assert "月" not in chars
    assert "星" not in chars
    assert "光" not in chars

    # Vocab: strictly 你好
    vocab = [v["written"] for v in pkg["vocabulary"]]
    assert vocab == ["你好"]
    assert "日月星辰" not in vocab


def test_lesson_packages_fixtures_exist():
    packages = list_lesson_packages()
    assert len(packages) >= 3
    ids = [p["lessonId"] for p in packages]
    assert "starter-l01" in ids
    assert "basic-l01" in ids
    assert "book1-l01" in ids


def test_review_status_validation():
    pkg = get_lesson_package("book1-l01")
    assert pkg is not None
    valid, errors = validate_package_review_status(pkg)
    assert valid is True
    assert errors == []

    # Corrupt draft flagged as approved
    corrupt = {
        **pkg,
        "nativeLanguageSupport": {
            "entries": {
                "bad_entry": {
                    "naturalMeaning": "test",
                    "reviewStatus": "GENERATED_DRAFT",
                    "approved": True,
                }
            }
        }
    }
    valid, errors = validate_package_review_status(corrupt)
    assert valid is False
    assert len(errors) == 1
    assert "GENERATED_DRAFT" in errors[0]


def test_lesson_package_api_endpoints(tmp_path):
    with make_client(tmp_path) as client:
        # Get existing package
        resp = client.get("/api/curriculum/lesson-packages/book1-l01")
        assert resp.status_code == 200
        data = resp.json()
        assert data["lessonId"] == "book1-l01"
        assert len(data["taskBlueprint"]["learnSteps"]) == 9

        # 404 for unknown package
        assert client.get("/api/curriculum/lesson-packages/unknown-lesson").status_code == 404

        # List packages
        resp_list = client.get("/api/curriculum/lesson-packages")
        assert resp_list.status_code == 200
        assert len(resp_list.json()) >= 3


def test_fast_track_endpoint_pass_and_fail(tmp_path):
    from app.auth import issue_session
    with make_client(tmp_path) as client:
        # Create child
        child_resp = client.post("/api/children", json={"name": "小華"})
        assert child_resp.status_code == 200
        child_id = child_resp.json()["id"]

        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}

        # Set placement to BOOK_1 so book1-l01 is accessible
        put_resp = client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )
        assert put_resp.status_code == 200

        # 1. Test passing fast track
        pass_answers = {
            "ft-q1": "c1",
            "ft-q2": "c1",
            "ft-q3": "c1",
            "ft-q4": "c1",
        }
        res_pass = client.post(f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track", json={"answers": pass_answers})
        assert res_pass.status_code == 200
        data_pass = res_pass.json()
        assert data_pass["passed"] is True
        assert data_pass["weakDomains"] == []
        assert data_pass["nextMode"] == "REVIEW"
        assert data_pass["masteryStatus"] == "READY_FOR_CHECK"  # Does not directly set unverified MASTERED

        # 2. Test failing one domain (e.g. recognition ft-q2)
        fail_answers = {
            "ft-q1": "c1",
            "ft-q2": "c2",  # wrong!
            "ft-q3": "c1",
            "ft-q4": "c1",
        }
        res_fail = client.post(f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track", json={"answers": fail_answers})
        assert res_fail.status_code == 200
        data_fail = res_fail.json()
        assert data_fail["passed"] is False
        assert "recognition" in data_fail["weakDomains"]
        assert data_fail["nextMode"] == "REPAIR"
