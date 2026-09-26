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
        pass_session = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "book1-l01"})
        assert pass_session.status_code == 200
        pass_session_id = pass_session.json()["id"]

        # Fast Track may only act on the exact active session and lesson.
        wrong_session = client.post(
            f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track",
            json={"session_id": "another-session", "answers": pass_answers},
        )
        assert wrong_session.status_code == 409
        wrong_lesson = client.post(
            f"/api/children/{child_id}/lesson-packages/starter-l01/fast-track",
            json={"session_id": pass_session_id, "answers": pass_answers},
        )
        assert wrong_lesson.status_code == 409
        res_pass = client.post(f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track", json={"session_id": pass_session_id, "answers": pass_answers})
        assert res_pass.status_code == 200
        data_pass = res_pass.json()
        assert data_pass["childId"] == child_id
        assert data_pass["sessionId"] == pass_session_id
        assert data_pass["lessonId"] == "book1-l01"
        assert data_pass["sessionStatus"] == "COMPLETED"
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
        fail_session = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "book1-l01"})
        assert fail_session.status_code == 200
        fail_session_id = fail_session.json()["id"]
        res_fail = client.post(f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track", json={"session_id": fail_session_id, "answers": fail_answers})
        assert res_fail.status_code == 200
        data_fail = res_fail.json()
        assert data_fail["childId"] == child_id
        assert data_fail["sessionId"] == fail_session_id
        assert data_fail["lessonId"] == "book1-l01"
        assert data_fail["sessionStatus"] == "PAUSED"
        assert data_fail["terminationReason"] == "FAST_TRACK_FAILED"
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
        ft_resp = client.post(f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track", json={"session_id": session_id, "answers": pass_answers})
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


def test_fast_track_failure_resumes_same_session_and_uses_exact_curriculum_task(tmp_path):
    from app.auth import issue_session
    from app.database import connect

    with make_client(tmp_path) as client:
        child_resp = client.post("/api/children", json={"name": "小禾"})
        assert child_resp.status_code == 200
        child_id = child_resp.json()["id"]
        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        placement = client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )
        assert placement.status_code == 200

        started = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "book1-l01"})
        assert started.status_code == 200
        initial = started.json()
        session_id = initial["id"]
        recognition_task = next(task for task in initial["tasks"] if task["sourceQueue"] == "CURRICULUM" and task["skillDomain"] == "recognition")
        pending_curriculum_ids = {
            task["id"] for task in initial["tasks"]
            if task["sourceQueue"] == "CURRICULUM" and task["required"] and task["state"] == "PENDING"
        }
        assert recognition_task["id"] in pending_curriculum_ids
        assert len(pending_curriculum_ids) > 1

        failed = client.post(
            f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track",
            json={
                "session_id": session_id,
                "answers": {"ft-q1": "c1", "ft-q2": "c2", "ft-q3": "c1", "ft-q4": "c1"},
            },
        )
        assert failed.status_code == 200
        failure = failed.json()
        assert failure["passed"] is False
        assert failure["childId"] == child_id
        assert failure["lessonId"] == "book1-l01"
        assert failure["sessionId"] == session_id
        assert failure["sessionStatus"] == "PAUSED"
        assert failure["terminationReason"] == "FAST_TRACK_FAILED"
        assert "recognition" in failure["weakDomains"]

        with connect() as db:
            paused = db.execute("SELECT status, lesson_id, termination_reason FROM learning_flow_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
            after_failure = db.execute("SELECT id, state FROM learning_flow_tasks WHERE session_id=? AND source_queue='CURRICULUM'", (session_id,)).fetchall()
        assert dict(paused) == {"status": "PAUSED", "lesson_id": "book1-l01", "termination_reason": "FAST_TRACK_FAILED"}
        assert {row["id"] for row in after_failure if row["state"] == "PENDING"} >= pending_curriculum_ids

        rejected_resume = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "expected_session_id": "another-session"},
        )
        assert rejected_resume.status_code == 409
        current_after_rejected_resume = client.get(f"/api/children/{child_id}/learning-sessions/current").json()
        assert current_after_rejected_resume["id"] == session_id
        assert current_after_rejected_resume["status"] == "PAUSED"

        resumed = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "expected_session_id": session_id},
        )
        assert resumed.status_code == 200
        resumed_data = resumed.json()
        assert resumed_data["id"] == session_id
        assert resumed_data["sessionId"] == session_id
        assert resumed_data["childId"] == child_id
        assert resumed_data["curriculumContext"]["lessonId"] == "book1-l01"
        assert resumed_data["status"] == "IN_PROGRESS"

        correct_choice = "opt-ni" if recognition_task["taskData"]["audioText"] == "你" else "opt-hao"
        answered = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{recognition_task['id']}/answer",
            json={"selected_option_id": correct_choice},
        )
        assert answered.status_code == 200
        final_session = answered.json()
        exact_task = next(task for task in final_session["tasks"] if task["id"] == recognition_task["id"])
        assert exact_task["state"] == "COMPLETED"
        assert exact_task["sourceQueue"] == "CURRICULUM"
        assert exact_task["skillDomain"] == "recognition"
        assert final_session["id"] == session_id
        assert final_session["status"] == "IN_PROGRESS"
        assert any(
            task["id"] in pending_curriculum_ids - {recognition_task["id"]} and task["state"] == "PENDING"
            for task in final_session["tasks"]
        )
        with connect() as db:
            attempt = db.execute("SELECT result, skill_domain FROM learning_flow_task_attempts WHERE session_id=? AND task_id=?", (session_id, recognition_task["id"])).fetchone()
            session_row = db.execute("SELECT status FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
        assert attempt is not None
        assert attempt["result"] == "correct"
        assert attempt["skill_domain"] == "recognition"
        assert session_row["status"] == "IN_PROGRESS"


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

        # Answering due review task persists exact attempt evidence and updates SRS state
        session_id = start_resp.json()["id"]
        review_task_id = review_tasks[0]["id"]
        answer_resp = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{review_task_id}/answer",
            json={"selected_option_id": "option-2"},
        )
        assert answer_resp.status_code == 200
        with connect() as db:
            srs_row = db.execute(
                "SELECT stage, due_at, last_result FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id='item-ni'",
                (child_id,),
            ).fetchone()
            assert srs_row["stage"] == 2
            assert srs_row["last_result"] == "correct"
            assert srs_row["due_at"] is not None
            assert srs_row["due_at"] > "2026-09-02T00:00:00Z"


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
                ev_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/evidence", json={"evidence_ref": attempt_id, "duration_ms": 2000})
                assert ev_resp.status_code == 200
            elif task_type == "PRONUNCIATION_ATTEMPT":
                pr_start = client.post(f"/api/reading-aloud/attempts/start?child_id={child_id}", json={
                    "text": "你好", "text_kind": "character", "locale": "zh-TW", "source_type": "CURRICULUM", "source_id": t["itemId"], "activity_domain": "pronunciation"
                })
                assert pr_start.status_code == 200
                attempt_id = pr_start.json()["id"]
                ev_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/evidence", json={"evidence_ref": attempt_id, "duration_ms": 2000})
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


def test_task_answer_attempt_count_and_wrong_answer_semantics(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        child_resp = client.post("/api/children", json={"name": "小智"})
        assert child_resp.status_code == 200
        child_id = child_resp.json()["id"]

        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )

        # 1. Test SENTENCE_PATTERN task on book1-l01
        start_resp = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "book1-l01"})
        assert start_resp.status_code == 200
        session_id = start_resp.json()["id"]
        sent_task = next(t for t in start_resp.json()["tasks"] if t["taskType"] == "SENTENCE_PATTERN")
        sent_id = sent_task["id"]

        # Initial state: 0 attempts
        assert sent_task["attemptCount"] == 0
        assert sent_task["failureCount"] == 0

        # Attempt 1: WRONG answer 'opt-wrong-order'
        resp1 = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{sent_id}/answer", json={"selected_option_id": "opt-wrong-order"})
        assert resp1.status_code == 200
        t1 = next(t for t in resp1.json()["tasks"] if t["id"] == sent_id)
        assert t1["state"] == "IN_PROGRESS"
        assert t1["attemptCount"] == 1
        assert t1["failureCount"] == 1

        with connect() as db:
            attempts = db.execute("SELECT * FROM learning_flow_task_attempts WHERE task_id=? ORDER BY rowid", (sent_id,)).fetchall()
            assert len(attempts) == 1
            assert attempts[0]["result"] == "incorrect"
            assert attempts[0]["score"] == 0.0

        # Attempt 2: CORRECT answer 'opt-correct-order'
        resp2 = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{sent_id}/answer", json={"selected_option_id": "opt-correct-order"})
        assert resp2.status_code == 200
        t2 = next(t for t in resp2.json()["tasks"] if t["id"] == sent_id)
        assert t2["state"] == "COMPLETED"
        assert t2["attemptCount"] == 2
        assert t2["failureCount"] == 1
        assert t2["completedAt"] is not None

        with connect() as db:
            attempts = db.execute("SELECT * FROM learning_flow_task_attempts WHERE task_id=? ORDER BY rowid", (sent_id,)).fetchall()
            assert len(attempts) == 2
            assert attempts[0]["result"] == "incorrect"
            assert attempts[1]["result"] == "correct"
            assert attempts[1]["score"] == 1.0


def test_recognition_task_wrong_answer_attempt_counts(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        child_resp = client.post("/api/children", json={"name": "小晴"})
        assert child_resp.status_code == 200
        child_id = child_resp.json()["id"]

        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )

        start_resp = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "book1-l01"})
        assert start_resp.status_code == 200
        session_id = start_resp.json()["id"]
        recog_task = next(t for t in start_resp.json()["tasks"] if t["taskType"] == "RECOGNITION")
        recog_id = recog_task["id"]

        # Attempt 1: wrong choice 'opt-hao' for character '你'
        resp1 = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{recog_id}/answer", json={"selected_option_id": "opt-hao"})
        assert resp1.status_code == 200
        t1 = next(t for t in resp1.json()["tasks"] if t["id"] == recog_id)
        assert t1["state"] == "IN_PROGRESS"
        assert t1["attemptCount"] == 1
        assert t1["failureCount"] == 1

        # Attempt 2: correct choice 'opt-ni' for character '你'
        resp2 = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{recog_id}/answer", json={"selected_option_id": "opt-ni"})
        assert resp2.status_code == 200
        t2 = next(t for t in resp2.json()["tasks"] if t["id"] == recog_id)
        assert t2["state"] == "COMPLETED"
        assert t2["attemptCount"] == 2
        assert t2["failureCount"] == 1

        with connect() as db:
            attempts = db.execute("SELECT * FROM learning_flow_task_attempts WHERE task_id=? ORDER BY rowid", (recog_id,)).fetchall()
            assert len(attempts) == 2
            assert attempts[0]["result"] == "incorrect"
            assert attempts[1]["result"] == "correct"


def test_vocabulary_task_wrong_retry_correct_authoritative_trace(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        child_resp = client.post("/api/children", json={"name": "小樂"})
        assert child_resp.status_code == 200
        child_id = child_resp.json()["id"]

        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"recognition": "BASIC", "reading": "BASIC", "listening": "BASIC", "speaking": "BASIC", "writing": "STARTER"}},
        )

        start_resp = client.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "lesson_id": "basic-l01"})
        assert start_resp.status_code == 200
        session_id = start_resp.json()["id"]
        vocab_task = next(t for t in start_resp.json()["tasks"] if t["taskType"] == "VOCABULARY")
        vocab_id = vocab_task["id"]

        # 1. Attempt 1: wrong choice 'opt-eat' for vocabulary '你好'
        resp1 = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{vocab_id}/answer", json={"selected_option_id": "opt-eat"})
        assert resp1.status_code == 200
        t1 = next(t for t in resp1.json()["tasks"] if t["id"] == vocab_id)
        assert t1["state"] == "IN_PROGRESS"
        assert t1["attemptCount"] == 1
        assert t1["failureCount"] == 1
        assert t1.get("completedAt") is None

        with connect() as db:
            task_row = db.execute("SELECT state, attempt_count, failure_count, completed_at FROM learning_flow_tasks WHERE id=?", (vocab_id,)).fetchone()
            assert task_row["state"] == "IN_PROGRESS"
            assert task_row["attempt_count"] == 1
            assert task_row["failure_count"] == 1
            assert task_row["completed_at"] is None

        # 2. Attempt 2: correct choice 'opt-hello' for vocabulary '你好'
        resp2 = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{vocab_id}/answer", json={"selected_option_id": "opt-hello"})
        assert resp2.status_code == 200
        t2 = next(t for t in resp2.json()["tasks"] if t["id"] == vocab_id)
        assert t2["state"] == "COMPLETED"
        assert t2["attemptCount"] == 2
        assert t2["failureCount"] == 1
        assert t2.get("completedAt") is not None

        with connect() as db:
            task_row = db.execute("SELECT state, attempt_count, failure_count, completed_at FROM learning_flow_tasks WHERE id=?", (vocab_id,)).fetchone()
            assert task_row["state"] == "COMPLETED"
            assert task_row["attempt_count"] == 2
            assert task_row["failure_count"] == 1
            assert task_row["completed_at"] is not None

            attempts = db.execute("SELECT * FROM learning_flow_task_attempts WHERE task_id=? ORDER BY rowid", (vocab_id,)).fetchall()
            assert len(attempts) == 2
            assert attempts[0]["result"] == "incorrect"
            assert attempts[1]["result"] == "correct"


def test_review_authoritative_reconciliation_integration(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        # 0. Setup child and placement
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

        # 1. 建立 active session (as of 2026-09-01, when no items are due)
        start_resp = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert start_resp.status_code == 200
        active_session = start_resp.json()
        session_id = active_session["id"]
        pending_curriculum = next(t for t in active_session["tasks"] if t["sourceQueue"] == "CURRICULUM" and t["required"] and t["state"] == "PENDING")

        # 2. 此時 session 沒有 REVIEW task
        initial_review_tasks = [t for t in active_session["tasks"] if t["sourceQueue"] == "REVIEW"]
        assert len(initial_review_tasks) == 0

        # 3. 在 session 建立後，讓 recognition SRS item 變成 due (due_at = 2026-09-02, evaluated as of 2026-09-05)
        with connect() as db:
            db.execute(
                "INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status,created_at) "
                "VALUES('item-ni',?,'你','OFFICIAL_OCAC','VERIFIED_OFFICIAL_TITLE','2026-09-01T00:00:00Z')",
                (child_id,),
            )
            db.execute(
                "INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) "
                "VALUES(?,'recognition','item-ni','book1-l01')",
                (child_id,),
            )
            db.execute(
                "INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) "
                "VALUES(?,'recognition','item-ni',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z')",
                (child_id,),
            )

        as_of_eval = "2026-09-05T00:00:00Z"

        # 4. Daily Queue 確認該 item due
        dq_resp = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of_eval}")
        assert dq_resp.status_code == 200
        dq_data = dq_resp.json()
        assert dq_data["review"]["dueCount"] == 1
        assert dq_data["review"]["items"][0]["character"] == "你"

        # 5. 執行 frontend 真正會使用的 reconciliation backend operation
        reconcile_resp = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of_eval}"
        )
        assert reconcile_resp.status_code == 200
        reconciled_session = reconcile_resp.json()

        # 6. 回傳 session 必須出現 exact REVIEW task
        reconciled_review_tasks = [t for t in reconciled_session["tasks"] if t["sourceQueue"] == "REVIEW"]
        assert len(reconciled_review_tasks) == 1
        review_task = reconciled_review_tasks[0]

        # 7. 驗證：
        #    - sourceQueue = REVIEW
        #    - taskType = REVIEW_RECOGNITION
        #    - itemId = exact due item
        #    - task.id 為 backend-issued
        assert review_task["sourceQueue"] == "REVIEW"
        assert review_task["taskType"] == "REVIEW_RECOGNITION"
        assert review_task["itemId"] == "item-ni"
        assert review_task["id"] == f"{session_id}:review-recognition-1"

        # 8. 對 exact task 作答
        answer_resp = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{review_task['id']}/answer",
            json={"selected_option_id": "option-2"},
        )
        assert answer_resp.status_code == 200
        answered_session = answer_resp.json()
        answered_review_task = next(t for t in answered_session["tasks"] if t["id"] == review_task["id"])
        assert answered_review_task["state"] == "COMPLETED"
        assert answered_session["status"] == "IN_PROGRESS"
        assert next(t for t in answered_session["tasks"] if t["id"] == pending_curriculum["id"])["state"] == "PENDING"

        # 9. 驗證 exact SRS row：
        #    - last_result 更新
        #    - stage 更新
        #    - due_at 更新
        with connect() as db:
            srs_row = db.execute(
                "SELECT * FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id='item-ni'",
                (child_id,),
            ).fetchone()
            assert srs_row is not None
            assert srs_row["last_result"] == "correct"
            assert srs_row["stage"] == 2
            assert srs_row["due_at"] > "2026-09-05T00:00:00Z"

        # 10. 再次執行 reconcile
        #     - 不得產生 duplicate REVIEW task
        second_reconcile_resp = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of_eval}"
        )
        assert second_reconcile_resp.status_code == 200
        second_session = second_reconcile_resp.json()
        second_review_tasks = [t for t in second_session["tasks"] if t["sourceQueue"] == "REVIEW"]
        assert len(second_review_tasks) == 1
        assert second_review_tasks[0]["id"] == review_task["id"]
        assert second_session["status"] == "IN_PROGRESS"
        assert next(t for t in second_session["tasks"] if t["id"] == pending_curriculum["id"])["state"] == "PENDING"


def test_review_paused_session_reconciliation_and_answer(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        # Setup child and placement
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

        # 1. 建立 active session
        start_resp = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert start_resp.status_code == 200
        session_id = start_resp.json()["id"]

        # 2. 注入 due SRS review item
        with connect() as db:
            db.execute(
                "INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status,created_at) "
                "VALUES('item-ni',?,'你','OFFICIAL_OCAC','VERIFIED_OFFICIAL_TITLE','2026-09-01T00:00:00Z')",
                (child_id,),
            )
            db.execute(
                "INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) "
                "VALUES(?,'recognition','item-ni','book1-l01')",
                (child_id,),
            )
            db.execute(
                "INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) "
                "VALUES(?,'recognition','item-ni',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z')",
                (child_id,),
            )

        as_of_eval = "2026-09-05T00:00:00Z"

        # 3. 將 session 設為 PAUSED (模擬中斷/暫停)
        with connect() as db:
            db.execute(
                "UPDATE learning_flow_sessions SET status='PAUSED', termination_reason='FATIGUE' WHERE id=?",
                (session_id,),
            )

        # 驗證 before session.status == PAUSED
        before_resp = client.get(f"/api/children/{child_id}/learning-sessions/{session_id}")
        assert before_resp.status_code == 200
        assert before_resp.json()["status"] == "PAUSED"

        # 4. 執行 reconcile
        reconcile_resp = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of_eval}"
        )
        assert reconcile_resp.status_code == 200
        reconciled_session = reconcile_resp.json()

        # 5. 驗證 after session.status == IN_PROGRESS (authoritative resume)
        assert reconciled_session["status"] == "IN_PROGRESS"

        # 6. 驗證 REVIEW task state 為 PENDING 且為 backend-issued ID
        review_tasks = [t for t in reconciled_session["tasks"] if t["sourceQueue"] == "REVIEW"]
        assert len(review_tasks) == 1
        review_task = review_tasks[0]
        assert review_task["state"] == "PENDING"
        assert review_task["itemId"] == "item-ni"
        assert review_task["id"] == f"{session_id}:review-recognition-1"

        # 7. 對 exact REVIEW task 作答，必須成功 answer (HTTP 200)
        answer_resp = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{review_task['id']}/answer",
            json={"selected_option_id": "option-2"},
        )
        assert answer_resp.status_code == 200
        answered_session = answer_resp.json()
        answered_task = next(t for t in answered_session["tasks"] if t["id"] == review_task["id"])
        assert answered_task["state"] == "COMPLETED"

        # 8. 驗證 SRS row 更新
        with connect() as db:
            srs_row = db.execute(
                "SELECT * FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id='item-ni'",
                (child_id,),
            ).fetchone()
            assert srs_row["last_result"] == "correct"
            assert srs_row["stage"] == 2


def test_review_cross_lesson_items_filtered(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        # Setup child and placement
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

        # 1. 建立 active session for book1-l01 (as of 2026-09-01)
        start_resp = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert start_resp.status_code == 200
        session_id = start_resp.json()["id"]

        # 2. 插入兩個 due items：
        #    due item A: lesson_id = book1-l01 (item-a, '你')
        #    due item B: lesson_id = starter-l01 (item-b, '字')
        with connect() as db:
            db.execute(
                "INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status,created_at) "
                "VALUES('item-a',?,'你','OFFICIAL_OCAC','VERIFIED_OFFICIAL_TITLE','2026-09-01T00:00:00Z'),"
                "('item-b',?,'字','OFFICIAL_OCAC','VERIFIED_OFFICIAL_TITLE','2026-09-01T00:00:00Z')",
                (child_id, child_id),
            )
            db.execute(
                "INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) "
                "VALUES(?,'recognition','item-a','book1-l01'),(?,'recognition','item-b','starter-l01')",
                (child_id, child_id),
            )
            db.execute(
                "INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) "
                "VALUES(?,'recognition','item-a',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z'),"
                "(?,'recognition','item-b',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z')",
                (child_id, child_id),
            )

        as_of_eval = "2026-09-05T00:00:00Z"

        # 3. Daily Queue 必須確認兩者皆 due
        dq_resp = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of_eval}")
        assert dq_resp.status_code == 200
        dq_items = dq_resp.json()["review"]["items"]
        assert len(dq_items) == 2
        assert any(it["id"] == "item-a" and it["lessonId"] == "book1-l01" for it in dq_items)
        assert any(it["id"] == "item-b" and it["lessonId"] == "starter-l01" for it in dq_items)

        # 4. 執行 reconcile on active session (book1-l01)
        reconcile_resp = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of_eval}"
        )
        assert reconcile_resp.status_code == 200
        reconciled = reconcile_resp.json()

        # 5. 驗證：
        #    - 只新增 A (item-a)
        #    - B 不得新增
        #    - B 不得被 relabel 成 book1-l01
        review_tasks = [t for t in reconciled["tasks"] if t["sourceQueue"] == "REVIEW"]
        assert len(review_tasks) == 1
        assert review_tasks[0]["itemId"] == "item-a"
        assert review_tasks[0]["lessonId"] == "book1-l01"

        # 確認 session 中沒有任何 task 的 itemId 是 item-b
        assert not any(t["itemId"] == "item-b" for t in reconciled["tasks"])

        # 6. Daily Queue 仍保留 B
        dq_after = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of_eval}").json()
        assert any(it["id"] == "item-b" and it["lessonId"] == "starter-l01" for it in dq_after["review"]["items"])

