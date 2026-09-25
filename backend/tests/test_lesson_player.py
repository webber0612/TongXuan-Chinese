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
        assert data_pass["nextReviewDueAt"] is not None
        assert isinstance(data_pass["nextReviewDueAt"], str)

        # Verify real SRS records in SQLite database
        from app.database import connect
        with connect() as db:
            srs_rows = db.execute("SELECT * FROM srs_review_states WHERE child_id=?", (child_id,)).fetchall()
            assert len(srs_rows) >= 1
            assert any(r["due_at"] is not None for r in srs_rows)

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
        assert data_fail["nextReviewDueAt"] is None


def test_fast_track_cleans_up_stale_active_session(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        # Create child & set placement
        child_resp = client.post("/api/children", json={"name": "小強"})
        assert child_resp.status_code == 200
        child_id = child_resp.json()["id"]

        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )

        # Start an active learning flow session
        start_resp = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "book1-l01"})
        assert start_resp.status_code == 200
        session_id = start_resp.json()["id"]

        # Call Fast Track pass
        pass_answers = {"ft-q1": "c1", "ft-q2": "c1", "ft-q3": "c1", "ft-q4": "c1"}
        ft_resp = client.post(f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track", json={"answers": pass_answers})
        assert ft_resp.status_code == 200
        assert ft_resp.json()["passed"] is True

        # Verify active session in DB was cleaned up / completed
        with connect() as db:
            session_row = db.execute("SELECT status, mastery_status, termination_reason FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
            assert session_row["status"] == "COMPLETED"
            assert session_row["mastery_status"] == "READY_FOR_CHECK"
            assert session_row["termination_reason"] == "FAST_TRACK_BYPASS"

            # Check that pending tasks were marked DEFERRED with FAST_TRACK_BYPASS
            deferred_tasks = db.execute("SELECT state, deferred_reason FROM learning_flow_tasks WHERE session_id=?", (session_id,)).fetchall()
            assert len(deferred_tasks) > 0
            assert all(t["state"] == "DEFERRED" and t["deferred_reason"] == "FAST_TRACK_BYPASS" for t in deferred_tasks)

            # Check audit event
            event_row = db.execute("SELECT event_type FROM learning_flow_telemetry WHERE session_id=? AND event_type='session_fast_track_bypassed'", (session_id,)).fetchone()
            assert event_row is not None

            # Check that there are no lingering IN_PROGRESS sessions
            lingering = db.execute("SELECT COUNT(*) FROM learning_flow_sessions WHERE child_id=? AND status='IN_PROGRESS'", (child_id,)).fetchone()[0]
            assert lingering == 0


def test_due_driven_review_retrieval(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        child_resp = client.post("/api/children", json={"name": "小安"})
        assert child_resp.status_code == 200
        child_id = child_resp.json()["id"]

        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )

        # Seed learning item, link, and due SRS review state in the past
        with connect() as db:
            db.execute("INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status,created_at) VALUES('item-ni',?,'你','OFFICIAL_OCAC','VERIFIED_OFFICIAL_TITLE','2026-09-01T00:00:00Z')", (child_id,))
            db.execute("INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,'recognition','item-ni','book1-l01')", (child_id,))
            db.execute("INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?,'recognition','item-ni',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z')", (child_id,))

        # Start learning session as of a later date (2026-09-25)
        start_resp = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": "2026-09-25T12:00:00Z"})
        assert start_resp.status_code == 200
        tasks = start_resp.json()["tasks"]

        # Verify due review tasks are included
        review_tasks = [t for t in tasks if t["sourceQueue"] == "REVIEW"]
        assert len(review_tasks) >= 1
        assert review_tasks[0]["taskType"] == "REVIEW_RECOGNITION"
        assert review_tasks[0]["skillDomain"] == "recognition"


def test_real_book1_l01_end_to_end_completion_flow(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        # 1. Create child + BOOK_1 placement
        child_resp = client.post("/api/children", json={"name": "小明"})
        assert child_resp.status_code == 200
        child_id = child_resp.json()["id"]

        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )

        # 2. Start learning flow session for book1-l01
        start_resp = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "book1-l01"})
        assert start_resp.status_code == 200
        session_data = start_resp.json()
        session_id = session_data["id"]
        tasks = session_data["tasks"]

        # 3. Step through all tasks providing real provider evidence or answers
        for t in tasks:
            task_type = t["taskType"]
            task_id = t["id"]
            if task_type == "LISTENING":
                # Start and complete listening attempt
                l_start = client.post(f"/api/children/{child_id}/listening-attempts", json={"item_id": t["itemId"]})
                assert l_start.status_code == 200
                attempt_id = l_start.json()["id"]
                l_comp = client.post(f"/api/children/{child_id}/listening-attempts/{attempt_id}/complete", json={"duration_ms": 1500})
                assert l_comp.status_code == 200
                ev_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/evidence", json={"evidence_ref": attempt_id})
                assert ev_resp.status_code == 200
            elif task_type == "RECOGNITION":
                ans_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/answer", json={"selected_option_id": "option-2"})
                assert ans_resp.status_code == 200
            elif task_type == "MINI_CHECK" and t.get("taskData", {}).get("mode") != "reflection":
                ans_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/answer", json={"selected_option_id": "option-1"})
                assert ans_resp.status_code == 200
            elif task_type == "VOCABULARY":
                ans_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/answer", json={"selected_option_id": "greeting"})
                assert ans_resp.status_code == 200
            elif task_type == "SENTENCE_PATTERN":
                ans_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/answer", json={"selected_option_id": "greeting"})
                assert ans_resp.status_code == 200
            elif task_type == "SPEAKING_ATTEMPT":
                sp_start = client.post(f"/api/reading-aloud/attempts/start?child_id={child_id}", json={
                    "text": "你好", "text_kind": "character", "locale": "zh-TW", "source_type": "CURRICULUM", "source_id": t["itemId"], "activity_domain": "speaking"
                })
                assert sp_start.status_code == 200
                attempt_id = sp_start.json()["id"]
                sp_comp = client.post(f"/api/reading-aloud/attempts/{attempt_id}/complete?child_id={child_id}", json={"duration_ms": 2000})
                assert sp_comp.status_code == 200
                ev_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/evidence", json={"evidence_ref": attempt_id})
                assert ev_resp.status_code == 200
            elif task_type == "PRONUNCIATION_ATTEMPT":
                pr_start = client.post(f"/api/reading-aloud/attempts/start?child_id={child_id}", json={
                    "text": "你好", "text_kind": "character", "locale": "zh-TW", "source_type": "CURRICULUM", "source_id": t["itemId"], "activity_domain": "pronunciation"
                })
                assert pr_start.status_code == 200
                attempt_id = pr_start.json()["id"]
                pr_comp = client.post(f"/api/reading-aloud/attempts/{attempt_id}/complete?child_id={child_id}", json={"duration_ms": 2000})
                assert pr_comp.status_code == 200
                ev_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/evidence", json={"evidence_ref": attempt_id})
                assert ev_resp.status_code == 200
            elif task_type.startswith("WRITING_"):
                # Writing is optional in this flow, test skip
                skip_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/skip")
                assert skip_resp.status_code == 200
            elif task_type == "MINI_CHECK" and t.get("taskData", {}).get("mode") == "reflection":
                ans_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/answer", json={"selected_option_id": "practiced"})
                assert ans_resp.status_code == 200

        # 4. Call authoritative complete endpoint
        comp_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/complete")
        assert comp_resp.status_code == 200
        comp_data = comp_resp.json()
        assert comp_data["status"] == "COMPLETED"
        assert comp_data["reward"]["points"] == 5

        # 5. Verify DB state
        with connect() as db:
            session_row = db.execute("SELECT status, reward_points FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
            assert session_row["status"] == "COMPLETED"
            assert session_row["reward_points"] == 5


def test_incomplete_required_evidence_rejects_session_completion(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        # Create child + BOOK_1 placement
        child_resp = client.post("/api/children", json={"name": "小圓"})
        assert child_resp.status_code == 200
        child_id = child_resp.json()["id"]

        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )

        # Start session
        start_resp = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "book1-l01"})
        assert start_resp.status_code == 200
        session_id = start_resp.json()["id"]

        # Complete only listening task, leaving remaining required tasks unfinished
        listen_task = next(t for t in start_resp.json()["tasks"] if t["taskType"] == "LISTENING")
        l_start = client.post(f"/api/children/{child_id}/listening-attempts", json={"item_id": listen_task["itemId"]})
        assert l_start.status_code == 200
        attempt_id = l_start.json()["id"]
        client.post(f"/api/children/{child_id}/listening-attempts/{attempt_id}/complete", json={"duration_ms": 1500})
        client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{listen_task['id']}/evidence", json={"evidence_ref": attempt_id})

        # Try to complete session prematurely
        comp_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/complete")
        assert comp_resp.status_code == 409
        assert comp_resp.json()["detail"] == "required_learning_tasks_incomplete"

        # Verify session is still IN_PROGRESS in DB
        with connect() as db:
            session_row = db.execute("SELECT status, completed_at FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
            assert session_row["status"] == "IN_PROGRESS"
            assert session_row["completed_at"] is None

