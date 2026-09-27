from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.lesson_packages import get_lesson_package, list_lesson_packages, validate_package_review_status


def make_client(tmp_path: Path, *, raise_server_exceptions: bool = True):
    import os
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "lesson_player.sqlite3")
    from app.main import app
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def _start_book1_listening_task(client: TestClient, name: str) -> tuple[int, dict, dict, dict]:
    from app.auth import issue_session

    child_resp = client.post("/api/children", json={"name": name})
    assert child_resp.status_code == 200, child_resp.text
    child_id = child_resp.json()["id"]
    parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
    placement = client.put(
        f"/api/children/{child_id}/placement-profile",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
    )
    assert placement.status_code == 200, placement.text
    started = client.post(
        f"/api/children/{child_id}/learning-sessions",
        json={"target_minutes": 18, "lesson_id": "book1-l01"},
    )
    assert started.status_code == 200, started.text
    current = started.json()
    task = next(task for task in current["tasks"] if task["taskType"] == "LISTENING")
    task_start = client.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/start")
    assert task_start.status_code == 200, task_start.text
    attempt_start = client.post(
        f"/api/children/{child_id}/listening-attempts",
        json={"item_id": task["itemId"], "lesson_id": task["lessonId"]},
    )
    assert attempt_start.status_code == 200, attempt_start.text
    return child_id, task_start.json(), task, attempt_start.json()


def _listening_flow_snapshot(child_id: int, session_id: str, task_id: str, attempt_id: str) -> dict:
    from app.database import connect

    with connect() as db:
        attempt = db.execute("SELECT status,completed_at,duration_ms FROM listening_attempts WHERE id=? AND child_id=?", (attempt_id, child_id)).fetchone()
        gate_rows = db.execute("SELECT id,gate_status,evidence_ref,evidence_type,evidence_item_id FROM curriculum_skill_gates WHERE child_id=? AND skill_domain='listening' AND evidence_ref=?", (child_id, attempt_id)).fetchall()
        task = db.execute("SELECT state,attempt_count,failure_count,evidence_ref,completed_at,elapsed_seconds FROM learning_flow_tasks WHERE id=? AND session_id=? AND child_id=?", (task_id, session_id, child_id)).fetchone()
        attempts = db.execute("SELECT result,assisted,evidence_ref,scorer_version FROM learning_flow_task_attempts WHERE session_id=? AND task_id=? AND child_id=? ORDER BY occurred_at,id", (session_id, task_id, child_id)).fetchall()
        telemetry = db.execute("SELECT event_type,task_id,details_json FROM learning_flow_telemetry WHERE session_id=? AND child_id=? AND task_id=? ORDER BY occurred_at,id", (session_id, child_id, task_id)).fetchall()
        provider_attempts = db.execute(
            """SELECT id,status FROM listening_attempts WHERE child_id=?
               AND item_id=(SELECT activity_item_id FROM learning_flow_tasks WHERE id=? AND session_id=? AND child_id=?)
               AND lesson_id=(SELECT lesson_id FROM learning_flow_tasks WHERE id=? AND session_id=? AND child_id=?)
               ORDER BY started_at,id""",
            (child_id, task_id, session_id, child_id, task_id, session_id, child_id),
        ).fetchall()
        return {
            "attempt": tuple(attempt) if attempt else None,
            "provider_attempts": [tuple(row) for row in provider_attempts],
            "gates": [tuple(row) for row in gate_rows],
            "task": tuple(task) if task else None,
            "flow_attempts": [tuple(row) for row in attempts],
            "telemetry": [tuple(row) for row in telemetry],
        }


def test_flow_owned_listening_evidence_is_atomic_and_replay_safe(tmp_path):
    from app.database import connect

    with make_client(tmp_path) as client:
        child_id, current, task, attempt = _start_book1_listening_task(client, "Listening Atomic")
        session_id, attempt_id = current["id"], attempt["id"]
        before = _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id)
        assert before["attempt"] == ("STARTED", None, None)
        assert before["gates"] == []
        assert before["task"][0] == "IN_PROGRESS"
        assert before["flow_attempts"] == []
        assert before["provider_attempts"] == [(attempt_id, "STARTED")]

        with connect() as db:
            db.execute(
                f"""CREATE TRIGGER fail_listening_evidence_telemetry
                    BEFORE INSERT ON learning_flow_telemetry
                    WHEN NEW.task_id='{task['id']}' AND NEW.event_type='task_evidence_attached'
                    BEGIN SELECT RAISE(ABORT, 'forced listening telemetry failure'); END"""
            )

        failure = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task['id']}/evidence",
            json={"evidence_ref": attempt_id, "duration_ms": 1500},
        )
        assert failure.status_code == 500, failure.text
        assert _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id) == before

        recovered_start = client.post(
            f"/api/children/{child_id}/listening-attempts",
            json={"item_id": task["itemId"], "lesson_id": task["lessonId"]},
        )
        assert recovered_start.status_code == 200, recovered_start.text
        assert recovered_start.json()["id"] == attempt_id
        assert _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id)["provider_attempts"] == [(attempt_id, "STARTED")]

        with connect() as db:
            db.execute("DROP TRIGGER fail_listening_evidence_telemetry")
        completed = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task['id']}/evidence",
            json={"evidence_ref": attempt_id, "duration_ms": 1500},
        )
        assert completed.status_code == 200, completed.text
        after = _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id)
        assert after["attempt"][0] == "COMPLETED"
        assert after["attempt"][2] == 1500
        assert len(after["gates"]) == 1
        assert after["gates"][0][1:] == ("ATTEMPTED_INDEPENDENTLY", attempt_id, "reference_audio_completed", task["itemId"])
        assert after["task"][0] == "COMPLETED"
        assert after["task"][1] == 1
        assert after["task"][3] == attempt_id
        assert len(after["flow_attempts"]) == 1
        assert after["flow_attempts"][0][2:] == (attempt_id, "listening_attempt")
        assert [row[0] for row in after["telemetry"]].count("task_evidence_attached") == 1
        assert completed.json()["status"] == "IN_PROGRESS"

        replay = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task['id']}/evidence",
            json={"evidence_ref": attempt_id, "duration_ms": 1500},
        )
        assert replay.status_code == 200, replay.text
        assert _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id) == after


def test_standalone_listening_finalize_rejects_active_learn_and_flow_evidence_recovers_completed_attempt(tmp_path):
    from app.database import connect
    from app.listening import complete_listening_attempt_in_transaction

    with make_client(tmp_path) as client:
        child_id, current, task, attempt = _start_book1_listening_task(client, "Listening Recovery")
        session_id, attempt_id = current["id"], attempt["id"]
        before = _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id)
        standalone = client.post(
            f"/api/children/{child_id}/listening-attempts/{attempt_id}/complete",
            json={"duration_ms": 1500},
        )
        assert standalone.status_code == 409
        assert standalone.json()["detail"] == "listening_attempt_bound_to_active_learning_task"
        assert _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id) == before

        paused = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/stop", json={"reason": "USER_EXIT"})
        assert paused.status_code == 200, paused.text
        assert paused.json()["status"] == "PAUSED"
        paused_snapshot = _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id)
        assert paused_snapshot["attempt"] == before["attempt"]
        standalone_paused = client.post(
            f"/api/children/{child_id}/listening-attempts/{attempt_id}/complete",
            json={"duration_ms": 1500},
        )
        assert standalone_paused.status_code == 409
        assert standalone_paused.json()["detail"] == "listening_attempt_bound_to_active_learning_task"
        assert _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id) == paused_snapshot
        paused_start_retry = client.post(
            f"/api/children/{child_id}/listening-attempts",
            json={"item_id": task["itemId"], "lesson_id": task["lessonId"]},
        )
        assert paused_start_retry.status_code == 409
        assert paused_start_retry.json()["detail"] == "learning_session_not_in_progress"
        assert _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id) == paused_snapshot

        resumed = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "expected_session_id": session_id},
        )
        assert resumed.status_code == 200, resumed.text
        assert resumed.json()["id"] == session_id
        assert resumed.json()["status"] == "IN_PROGRESS"
        resumed_start_retry = client.post(
            f"/api/children/{child_id}/listening-attempts",
            json={"item_id": task["itemId"], "lesson_id": task["lessonId"]},
        )
        assert resumed_start_retry.status_code == 200, resumed_start_retry.text
        assert resumed_start_retry.json()["id"] == attempt_id
        assert _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id)["provider_attempts"] == [(attempt_id, "STARTED")]

        # Simulate a durable provider completion from the former two-request flow.
        with connect() as db:
            complete_listening_attempt_in_transaction(
                db,
                child_id=child_id,
                attempt_id=attempt_id,
                duration_ms=1500,
                reject_active_learn_binding=False,
            )
        legacy_completed = _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id)
        assert legacy_completed["attempt"][0] == "COMPLETED"
        assert len(legacy_completed["gates"]) == 1
        assert legacy_completed["task"][0] == "PENDING"
        assert legacy_completed["flow_attempts"] == []

        recovered = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task['id']}/evidence",
            json={"evidence_ref": attempt_id, "duration_ms": 3000},
        )
        assert recovered.status_code == 200, recovered.text
        after = _listening_flow_snapshot(child_id, session_id, task["id"], attempt_id)
        assert after["attempt"] == legacy_completed["attempt"]  # replay does not rewrite provider completion
        assert len(after["gates"]) == 1
        assert after["task"][0] == "COMPLETED"
        assert after["task"][1] == 1
        assert len(after["flow_attempts"]) == 1
        assert [row[0] for row in after["telemetry"]].count("task_evidence_attached") == 1


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
            assert {(row["skill_domain"], row["item_id"]) for row in srs_rows} == {
                ("listening", f"lf_{child_id}_book1-l01_phrase"),
                ("recognition", f"lf_{child_id}_book1-l01_char_1"),
            }
            assert all(row["due_at"] is not None for row in srs_rows)
            assert db.execute("SELECT COUNT(*) FROM srs_review_events WHERE child_id=?", (child_id,)).fetchone()[0] == 2

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
        with connect() as db:
            after_failed_attempt_states = db.execute(
                "SELECT skill_domain,item_id,stage FROM srs_review_states WHERE child_id=? ORDER BY skill_domain,item_id",
                (child_id,),
            ).fetchall()
            after_failed_attempt_events = db.execute(
                "SELECT skill_domain,item_id,result FROM srs_review_events WHERE child_id=? ORDER BY occurred_at,id",
                (child_id,),
            ).fetchall()
        assert {(row["skill_domain"], row["item_id"], row["stage"]) for row in after_failed_attempt_states} == {
            ("listening", f"lf_{child_id}_book1-l01_phrase", 1),
            ("recognition", f"lf_{child_id}_book1-l01_char_1", 1),
        }
        assert len(after_failed_attempt_events) == 2
        assert all(row["result"] == "correct" for row in after_failed_attempt_events)


def test_fast_track_unknown_question_material_mapping_does_not_write_srs(tmp_path, monkeypatch):
    from copy import deepcopy
    from app.auth import issue_session
    from app.database import connect
    from app import lesson_packages

    original_get_package = lesson_packages.get_lesson_package
    package = deepcopy(original_get_package("book1-l01"))
    assert package is not None
    questions = [
        question
        for step in package["taskBlueprint"]["fastTrackSteps"]
        if step.get("stepKey") == "exit_ticket"
        for question in step.get("data", {}).get("questions", [])
    ]
    assert {question["id"] for question in questions} >= {"ft-q1", "ft-q2"}
    for question in questions:
        if question["id"] in {"ft-q1", "ft-q2"}:
            # The answer remains correct, but this score cannot be bound to the
            # lesson's exact listening phrase or recognition character.
            question["audioText"] = "unmapped-material"

    monkeypatch.setattr(
        lesson_packages,
        "get_lesson_package",
        lambda lesson_id: deepcopy(package) if lesson_id == "book1-l01" else original_get_package(lesson_id),
    )

    with make_client(tmp_path) as client:
        child_resp = client.post("/api/children", json={"name": "Fast Track Mapping"})
        assert child_resp.status_code == 200, child_resp.text
        child_id = child_resp.json()["id"]
        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        placement = client.put(
            f"/api/children/{child_id}/placement-profile",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )
        assert placement.status_code == 200, placement.text
        started = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01"},
        )
        assert started.status_code == 200, started.text

        response = client.post(
            f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track",
            json={
                "session_id": started.json()["id"],
                "answers": {"ft-q1": "c1", "ft-q2": "c1", "ft-q3": "c1", "ft-q4": "c1"},
            },
        )
        assert response.status_code == 200, response.text
        assert response.json()["passed"] is True

        with connect() as db:
            states = db.execute(
                "SELECT skill_domain,item_id FROM srs_review_states WHERE child_id=?",
                (child_id,),
            ).fetchall()
            events = db.execute(
                "SELECT skill_domain,item_id FROM srs_review_events WHERE child_id=?",
                (child_id,),
            ).fetchall()
        assert states == []
        assert events == []


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
                # Start listening; final provider completion is owned by task evidence.
                l_start = client.post(f"/api/children/{child_id}/listening-attempts", json={"item_id": t["itemId"]})
                assert l_start.status_code == 200
                attempt_id = l_start.json()["id"]
                ev_resp = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/evidence", json={"evidence_ref": attempt_id, "duration_ms": 1500})
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
        attached = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{listen_task['id']}/evidence", json={"evidence_ref": attempt_id, "duration_ms": 1500})
        assert attached.status_code == 200, attached.text

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


def test_review_writing_and_word_srs_use_exact_flow_tasks_and_replay_once(tmp_path):
    from app.auth import issue_session
    from app.database import connect

    with make_client(tmp_path) as client:
        child = client.post("/api/children", json={"name": "Review Domains"})
        assert child.status_code == 200, child.text
        child_id = child.json()["id"]
        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        placement = client.put(
            f"/api/children/{child_id}/placement-profile",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={"domain_levels": {"recognition": "BASIC", "reading": "BASIC", "listening": "BASIC", "speaking": "BASIC", "writing": "BASIC"}},
        )
        assert placement.status_code == 200, placement.text

        # Seed a genuine prior HANZI_WRITER attempt and exact curriculum provenance.
        with connect() as db:
            db.execute(
                "INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,'writing','你','basic-l01')",
                (child_id,),
            )
        prior_writing = client.post(
            f"/api/sprint-b/writing/attempts?child_id={child_id}&character=%E4%BD%A0",
            json={"trace_result": "correct", "assisted": False, "provider": "HANZI_WRITER", "phase": "independent", "script_mode": "TRADITIONAL"},
        )
        assert prior_writing.status_code == 200, prior_writing.text

        # Start with no due REVIEW, then create the word SRS through the real scored task.
        started = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "basic-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert started.status_code == 200, started.text
        session = started.json()
        session_id = session["id"]
        pending_curriculum = next(t for t in session["tasks"] if t["sourceQueue"] == "CURRICULUM" and t["required"] and t["state"] == "PENDING")
        vocabulary = next(t for t in session["tasks"] if t["taskType"] == "VOCABULARY")
        answer = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{vocabulary['id']}/answer",
            json={"selected_option_id": "opt-hello"},
        )
        assert answer.status_code == 200, answer.text
        with connect() as db:
            vocabulary_evidence_count_before_review = db.execute(
                "SELECT COUNT(*) FROM curriculum_skill_evidence WHERE child_id=? AND skill_domain='vocabulary'",
                (child_id,),
            ).fetchone()[0]
            vocabulary_gate_count_before_review = db.execute(
                "SELECT COUNT(*) FROM curriculum_skill_gates WHERE child_id=? AND skill_domain='vocabulary'",
                (child_id,),
            ).fetchone()[0]

        writing_item_id = "traditional::你"
        word_item_id = vocabulary["itemId"]
        with connect() as db:
            db.execute(
                "UPDATE srs_review_states SET due_at='2026-09-02T00:00:00Z' WHERE child_id=? AND skill_domain='writing' AND item_id=?",
                (child_id, writing_item_id),
            )
            db.execute(
                "UPDATE srs_review_states SET due_at='2026-09-02T00:00:00Z' WHERE child_id=? AND skill_domain='word' AND item_id=?",
                (child_id, word_item_id),
            )

        as_of = "2026-09-05T00:00:00Z"
        queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of}")
        assert queue.status_code == 200, queue.text
        due = queue.json()["review"]["items"]
        assert {(item["skillDomain"], item["id"], item["lessonId"]) for item in due} == {
            ("writing", writing_item_id, "basic-l01"),
            ("word", word_item_id, "basic-l01"),
        }

        reconciled = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of}"
        )
        assert reconciled.status_code == 200, reconciled.text
        review_tasks = [t for t in reconciled.json()["tasks"] if t["sourceQueue"] == "REVIEW"]
        assert {(t["taskType"], t["skillDomain"], t["itemId"], t["lessonId"]) for t in review_tasks} == {
            ("REVIEW_WRITING", "writing", writing_item_id, "basic-l01"),
            ("REVIEW_VOCABULARY", "word", word_item_id, "basic-l01"),
        }
        review_by_type = {task["taskType"]: task for task in review_tasks}
        writing_task = review_by_type["REVIEW_WRITING"]
        word_task = review_by_type["REVIEW_VOCABULARY"]
        assert writing_task["taskData"]["character"] == "你"
        assert writing_task["taskData"]["scriptMode"] == "TRADITIONAL"
        assert word_task["taskData"]["word"] == "你好"

        generic_write = client.post(
            f"/api/sprint-b/writing/attempts?child_id={child_id}&character=%E4%BD%A0",
            json={"trace_result": "correct", "assisted": False, "provider": "HANZI_WRITER", "phase": "independent", "script_mode": "TRADITIONAL"},
        )
        assert generic_write.status_code == 400
        assert generic_write.json()["detail"] == "writing_flow_evidence_required"

        started_writing = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{writing_task['id']}/start")
        assert started_writing.status_code == 200, started_writing.text
        writing_attempt_id = f"flow-writing:{session_id}:{writing_task['id']}:0"
        evidence_body = {
            "evidence_ref": writing_attempt_id,
            "trace_result": "correct",
            "assisted": False,
            "provider": "HANZI_WRITER",
            "phase": "independent",
            "script_mode": "TRADITIONAL",
            "attempt_index": 0,
        }
        writing_done = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{writing_task['id']}/evidence",
            json=evidence_body,
        )
        assert writing_done.status_code == 200, writing_done.text
        assert next(t for t in writing_done.json()["tasks"] if t["id"] == writing_task["id"])["state"] == "COMPLETED"

        word_done = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{word_task['id']}/answer",
            json={"selected_option_id": "opt-hello"},
        )
        assert word_done.status_code == 200, word_done.text
        assert next(t for t in word_done.json()["tasks"] if t["id"] == word_task["id"])["state"] == "COMPLETED"
        assert word_done.json()["status"] == "IN_PROGRESS"
        assert next(t for t in word_done.json()["tasks"] if t["id"] == pending_curriculum["id"])["state"] == "PENDING"

        # Exact write/answer replay and reconciliation do not create duplicate SRS or flow evidence.
        writing_replay = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{writing_task['id']}/evidence",
            json=evidence_body,
        )
        word_replay = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{word_task['id']}/answer",
            json={"selected_option_id": "opt-hello"},
        )
        reconcile_replay = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of}"
        )
        assert writing_replay.status_code == word_replay.status_code == reconcile_replay.status_code == 200
        assert {(t["taskType"], t["id"]) for t in reconcile_replay.json()["tasks"] if t["sourceQueue"] == "REVIEW"} == {
            ("REVIEW_WRITING", writing_task["id"]),
            ("REVIEW_VOCABULARY", word_task["id"]),
        }
        assert reconcile_replay.json()["status"] == "IN_PROGRESS"
        assert next(t for t in reconcile_replay.json()["tasks"] if t["id"] == pending_curriculum["id"])["state"] == "PENDING"

        with connect() as db:
            for domain, item_id in (("writing", writing_item_id), ("word", word_item_id)):
                srs = db.execute(
                    "SELECT stage,due_at,last_result FROM srs_review_states WHERE child_id=? AND skill_domain=? AND item_id=?",
                    (child_id, domain, item_id),
                ).fetchone()
                assert srs is not None and srs["stage"] == 2 and srs["last_result"] == "correct"
                assert srs["due_at"] > as_of
                assert db.execute(
                    "SELECT COUNT(*) FROM srs_review_events WHERE child_id=? AND skill_domain=? AND item_id=?",
                    (child_id, domain, item_id),
                ).fetchone()[0] == 2  # one original scored event + one exact REVIEW event
            assert db.execute("SELECT COUNT(*) FROM writing_attempts WHERE id=?", (writing_attempt_id,)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM learning_flow_task_attempts WHERE task_id=?", (writing_task["id"],)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM learning_flow_task_attempts WHERE task_id=?", (word_task["id"],)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM curriculum_skill_gates WHERE child_id=? AND skill_domain='writing' AND evidence_ref=?", (child_id, writing_attempt_id)).fetchone()[0] == 0
            assert db.execute(
                "SELECT COUNT(*) FROM curriculum_skill_evidence WHERE child_id=? AND skill_domain='vocabulary'",
                (child_id,),
            ).fetchone()[0] == vocabulary_evidence_count_before_review
            assert db.execute(
                "SELECT COUNT(*) FROM curriculum_skill_gates WHERE child_id=? AND skill_domain='vocabulary'",
                (child_id,),
            ).fetchone()[0] == vocabulary_gate_count_before_review
            assert db.execute("SELECT status FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()[0] == "IN_PROGRESS"


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


def test_review_cross_lesson_items_reconcile_complete_exact_set(tmp_path):
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
        pending_curriculum = next(
            task for task in start_resp.json()["tasks"]
            if task["sourceQueue"] == "CURRICULUM" and task["required"] and task["state"] == "PENDING"
        )

        # 2. 讓前一冊的 basic-l01 對本 child 可用，並插入兩個不同 lesson 的 due rows。
        with connect() as db:
            db.execute(
                "INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status,created_at) "
                "VALUES('item-book1-ni',?,'你','OFFICIAL_OCAC','VERIFIED_OFFICIAL_TITLE','2026-09-01T00:00:00Z'),"
                "('item-basic-hao',?,'好','OFFICIAL_OCAC','VERIFIED_OFFICIAL_TITLE','2026-09-01T00:00:00Z')",
                (child_id, child_id),
            )
            db.execute(
                "INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) "
                "VALUES(?,'recognition','item-book1-ni','book1-l01'),(?,'recognition','item-basic-hao','basic-l01')",
                (child_id, child_id),
            )
            db.execute(
                "INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) "
                "VALUES(?,'recognition','item-book1-ni',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z'),"
                "(?,'recognition','item-basic-hao',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z')",
                (child_id, child_id),
            )
            db.execute(
                "INSERT INTO curriculum_lesson_states(child_id,lesson_id,soft_unlocked) VALUES(?, 'basic-l01', 1)",
                (child_id,),
            )

        as_of_eval = "2026-09-05T00:00:00Z"

        # 3. Daily Queue 必須確認兩者皆 due
        dq_resp = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of_eval}")
        assert dq_resp.status_code == 200
        dq_review = dq_resp.json()["review"]
        dq_items = dq_review["items"]
        assert dq_review["dueCount"] == 2
        assert {(it["id"], it["lessonId"]) for it in dq_items} == {
            ("item-book1-ni", "book1-l01"),
            ("item-basic-hao", "basic-l01"),
        }

        # 4. 對 parent book1-l01 session reconcile the exact cross-lesson due set.
        reconcile_resp = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of_eval}"
        )
        assert reconcile_resp.status_code == 200
        reconciled = reconcile_resp.json()

        review_tasks = [t for t in reconciled["tasks"] if t["sourceQueue"] == "REVIEW"]
        assert len(review_tasks) == dq_review["dueCount"]
        by_item = {task["itemId"]: task for task in review_tasks}
        assert set(by_item) == {"item-book1-ni", "item-basic-hao"}
        assert (by_item["item-book1-ni"]["lessonId"], by_item["item-book1-ni"]["id"]) == (
            "book1-l01", f"{session_id}:review-recognition-2"
        )
        assert (by_item["item-basic-hao"]["lessonId"], by_item["item-basic-hao"]["id"]) == (
            "basic-l01", f"{session_id}:review-recognition-1"
        )
        assert by_item["item-book1-ni"]["taskData"]["audioText"] == "你"
        assert by_item["item-basic-hao"]["taskData"]["audioText"] == "好"
        assert all(task["childId"] == child_id and task["sessionId"] == session_id for task in review_tasks)
        assert by_item["item-book1-ni"]["taskData"]["choices"] == [
            {"id": "option-1", "label": "好"}, {"id": "option-2", "label": "你"}
        ]
        assert by_item["item-basic-hao"]["taskData"]["choices"] == [
            {"id": "option-1", "label": "你"}, {"id": "option-2", "label": "好"}
        ]
        assert reconciled["status"] == "IN_PROGRESS"
        assert next(t for t in reconciled["tasks"] if t["id"] == pending_curriculum["id"])["state"] == "PENDING"

        # Retry before answering must return the same authoritative rows without duplicates.
        retry_resp = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of_eval}"
        )
        assert retry_resp.status_code == 200
        retry_tasks = [t for t in retry_resp.json()["tasks"] if t["sourceQueue"] == "REVIEW"]
        assert {task["itemId"]: task["id"] for task in retry_tasks} == {
            "item-book1-ni": by_item["item-book1-ni"]["id"],
            "item-basic-hao": by_item["item-basic-hao"]["id"],
        }

        # Complete both exact task identities and verify per-item evidence/SRS settlement.
        for item_id in ("item-book1-ni", "item-basic-hao"):
            task_id = by_item[item_id]["id"]
            answer_resp = client.post(
                f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_id}/answer",
                json={"selected_option_id": "option-2"},
            )
            assert answer_resp.status_code == 200
            answer_data = answer_resp.json()
            assert next(task for task in answer_data["tasks"] if task["id"] == task_id)["state"] == "COMPLETED"
            assert answer_data["status"] == "IN_PROGRESS"
            assert next(task for task in answer_data["tasks"] if task["id"] == pending_curriculum["id"])["state"] == "PENDING"

        with connect() as db:
            rows = db.execute(
                "SELECT child_id,session_id,lesson_id,activity_item_id,state FROM learning_flow_tasks "
                "WHERE session_id=? AND source_queue='REVIEW' ORDER BY position",
                (session_id,),
            ).fetchall()
            assert {(row["child_id"], row["session_id"], row["lesson_id"], row["activity_item_id"], row["state"]) for row in rows} == {
                (child_id, session_id, "book1-l01", "item-book1-ni", "COMPLETED"),
                (child_id, session_id, "basic-l01", "item-basic-hao", "COMPLETED"),
            }
            assert len(rows) == 2
            for item_id in ("item-book1-ni", "item-basic-hao"):
                srs_row = db.execute(
                    "SELECT stage,due_at,last_result FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id=?",
                    (child_id, item_id),
                ).fetchone()
                assert srs_row["stage"] == 2
                assert srs_row["last_result"] == "correct"
                assert srs_row["due_at"] > as_of_eval
                assert db.execute(
                    "SELECT COUNT(*) AS count FROM srs_review_events WHERE child_id=? AND skill_domain='recognition' AND item_id=?",
                    (child_id, item_id),
                ).fetchone()["count"] == 1
                assert db.execute(
                    "SELECT COUNT(*) AS count FROM learning_flow_task_attempts WHERE task_id=?",
                    (by_item[item_id]["id"],),
                ).fetchone()["count"] == 1
            session_state = db.execute("SELECT status FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()
            curriculum_state = db.execute("SELECT state FROM learning_flow_tasks WHERE id=?", (pending_curriculum["id"],)).fetchone()
            assert session_state["status"] == "IN_PROGRESS"
            assert curriculum_state["state"] == "PENDING"

        # A post-completion retry cannot create tasks/evidence or advance either SRS row twice.
        final_retry = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of_eval}"
        )
        assert final_retry.status_code == 200
        final_tasks = [t for t in final_retry.json()["tasks"] if t["sourceQueue"] == "REVIEW"]
        assert {task["itemId"]: task["id"] for task in final_tasks} == {
            "item-book1-ni": by_item["item-book1-ni"]["id"],
            "item-basic-hao": by_item["item-basic-hao"]["id"],
        }
        with connect() as db:
            assert db.execute("SELECT COUNT(*) AS count FROM srs_review_events WHERE child_id=? AND skill_domain='recognition'", (child_id,)).fetchone()["count"] == 2
            assert db.execute("SELECT COUNT(*) AS count FROM learning_flow_task_attempts WHERE session_id=?", (session_id,)).fetchone()["count"] == 2


def test_review_unsupported_due_item_fails_before_partial_reconciliation(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    with make_client(tmp_path) as client:
        child_resp = client.post("/api/children", json={"name": "小安"})
        child_id = child_resp.json()["id"]
        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers=parent_headers,
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )
        start_resp = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert start_resp.status_code == 200
        session_id = start_resp.json()["id"]
        pending_curriculum = next(task for task in start_resp.json()["tasks"] if task["sourceQueue"] == "CURRICULUM" and task["required"] and task["state"] == "PENDING")

        with connect() as db:
            db.execute(
                "INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status,created_at) VALUES "
                "('item-a-supported',?,'你','OFFICIAL_OCAC','VERIFIED_OFFICIAL_TITLE','2026-09-01T00:00:00Z'),"
                "('item-b-unsupported',?,'家','OFFICIAL_OCAC','VERIFIED_OFFICIAL_TITLE','2026-09-01T00:00:00Z')",
                (child_id, child_id),
            )
            db.execute(
                "INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES "
                "(?,'recognition','item-a-supported','book1-l01'),(?,'recognition','item-b-unsupported','book1-l02')",
                (child_id, child_id),
            )
            db.execute(
                "INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES "
                "(?,'recognition','item-a-supported',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z'),"
                "(?,'recognition','item-b-unsupported',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z')",
                (child_id, child_id),
            )
            db.execute("INSERT INTO curriculum_lesson_states(child_id,lesson_id,soft_unlocked) VALUES(?, 'book1-l02', 1)", (child_id,))

        queue_response = client.get(
            f"/api/children/{child_id}/learning-daily-queue?as_of=2026-09-05T00:00:00Z"
        )
        assert queue_response.status_code == 400
        assert queue_response.json()["detail"] == "learning_flow_review_lesson_not_supported"

        response = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of=2026-09-05T00:00:00Z"
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "learning_flow_review_lesson_not_supported"
        with connect() as db:
            assert db.execute("SELECT COUNT(*) AS count FROM learning_flow_tasks WHERE session_id=? AND source_queue='REVIEW'", (session_id,)).fetchone()["count"] == 0
            assert db.execute("SELECT status FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()["status"] == "IN_PROGRESS"
            assert db.execute("SELECT state FROM learning_flow_tasks WHERE id=?", (pending_curriculum["id"],)).fetchone()["state"] == "PENDING"


def test_review_wrong_answers_sync_due_at_and_reconcile_same_recognition_and_word_tasks(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    from app.learning_flow import _characters, _lesson_map

    with make_client(tmp_path) as client:
        child = client.post("/api/children", json={"name": "Review Retry Identity"})
        assert child.status_code == 200, child.text
        child_id = child.json()["id"]
        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        placement = client.put(
            f"/api/children/{child_id}/placement-profile",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={"domain_levels": {"recognition": "BASIC", "reading": "BASIC", "listening": "BASIC", "speaking": "BASIC", "writing": "BASIC"}},
        )
        assert placement.status_code == 200, placement.text
        started = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "basic-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert started.status_code == 200, started.text
        session = started.json()
        session_id = session["id"]
        pending_curriculum = next(task for task in session["tasks"] if task["sourceQueue"] == "CURRICULUM" and task["required"] and task["state"] == "PENDING")
        recognition_character = _characters(_lesson_map()["basic-l01"])[0]
        vocabulary = next(task for task in session["tasks"] if task["taskType"] == "VOCABULARY")
        word_item_id = vocabulary["itemId"]
        with connect() as db:
            db.execute(
                "INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status,created_at) VALUES(?,?,?,?,?,?)",
                ("item-review-retry", child_id, recognition_character, "OFFICIAL_OCAC", "VERIFIED_OFFICIAL_TITLE", "2026-09-01T00:00:00Z"),
            )
            db.execute(
                "INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,'recognition','item-review-retry','basic-l01')",
                (child_id,),
            )
            db.execute(
                "INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES "
                "(?,'recognition','item-review-retry',1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z'),"
                "(?,'word',?,1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z')",
                (child_id, child_id, word_item_id),
            )

        as_of = "2099-09-05T00:00:00Z"
        queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of}")
        assert queue.status_code == 200, queue.text
        assert {(item["skillDomain"], item["id"]) for item in queue.json()["review"]["items"]} == {
            ("recognition", "item-review-retry"), ("word", word_item_id),
        }
        reconciled = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of}")
        assert reconciled.status_code == 200, reconciled.text
        review_tasks = [task for task in reconciled.json()["tasks"] if task["sourceQueue"] == "REVIEW"]
        task_by_domain = {task["skillDomain"]: task for task in review_tasks}
        assert set(task_by_domain) == {"recognition", "word"}

        wrong_recognition = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_by_domain['recognition']['id']}/answer",
            json={"selected_option_id": "option-1"},
        )
        assert wrong_recognition.status_code == 200, wrong_recognition.text
        wrong_word = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_by_domain['word']['id']}/answer",
            json={"selected_option_id": "opt-eat"},
        )
        assert wrong_word.status_code == 200, wrong_word.text
        assert wrong_recognition.json()["status"] == wrong_word.json()["status"] == "IN_PROGRESS"

        refreshed_queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of}")
        assert refreshed_queue.status_code == 200, refreshed_queue.text
        refreshed_due = {(item["skillDomain"], item["id"]): item for item in refreshed_queue.json()["review"]["items"]}
        assert set(refreshed_due) == {("recognition", "item-review-retry"), ("word", word_item_id)}
        retried_reconcile = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of}")
        assert retried_reconcile.status_code == 200, retried_reconcile.text
        retried_tasks = [task for task in retried_reconcile.json()["tasks"] if task["sourceQueue"] == "REVIEW"]
        assert {task["skillDomain"]: task["id"] for task in retried_tasks} == {
            domain: task["id"] for domain, task in task_by_domain.items()
        }
        for task in retried_tasks:
            assert task["state"] == "IN_PROGRESS"
            assert task["attemptCount"] == 1
            assert task["taskData"]["dueAt"] == refreshed_due[(task["skillDomain"], task["itemId"])]["dueAt"]
        assert retried_reconcile.json()["status"] == "IN_PROGRESS"
        assert next(task for task in retried_reconcile.json()["tasks"] if task["id"] == pending_curriculum["id"])["state"] == "PENDING"

        assisted_word = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task_by_domain['word']['id']}/answer",
            json={"selected_option_id": "opt-hello", "assisted": True},
        )
        assert assisted_word.status_code == 200, assisted_word.text
        assisted_task = next(task for task in assisted_word.json()["tasks"] if task["id"] == task_by_domain["word"]["id"])
        assert assisted_task["state"] == "COMPLETED"
        assert assisted_word.json()["status"] == "IN_PROGRESS"
        assert next(task for task in assisted_word.json()["tasks"] if task["id"] == pending_curriculum["id"])["state"] == "PENDING"
        with connect() as db:
            assisted_srs = db.execute(
                "SELECT stage,last_result,last_assisted FROM srs_review_states WHERE child_id=? AND skill_domain='word' AND item_id=?",
                (child_id, word_item_id),
            ).fetchone()
            assert assisted_srs is not None
            assert (assisted_srs["stage"], assisted_srs["last_result"], assisted_srs["last_assisted"]) == (0, "correct", 1)
            assert db.execute(
                "SELECT COUNT(*) FROM srs_review_events WHERE child_id=? AND skill_domain='word' AND item_id=?",
                (child_id, word_item_id),
            ).fetchone()[0] == 2

        assisted_queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of}")
        assert assisted_queue.status_code == 200, assisted_queue.text
        assisted_due = {(item["skillDomain"], item["id"]): item for item in assisted_queue.json()["review"]["items"]}
        assert ("word", word_item_id) in assisted_due
        assisted_reconcile = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of}")
        assert assisted_reconcile.status_code == 200, assisted_reconcile.text
        final_word = next(task for task in assisted_reconcile.json()["tasks"] if task["sourceQueue"] == "REVIEW" and task["skillDomain"] == "word")
        assert final_word["id"] == task_by_domain["word"]["id"]
        assert final_word["state"] == "COMPLETED"
        assert final_word["attemptCount"] == 2
        assert final_word["taskData"]["dueAt"] == assisted_due[("word", word_item_id)]["dueAt"]
        assert assisted_reconcile.json()["status"] == "IN_PROGRESS"
        assert next(task for task in assisted_reconcile.json()["tasks"] if task["id"] == pending_curriculum["id"])["state"] == "PENDING"


def test_review_writing_retry_cap_deferred_reconciles_exactly_and_keeps_parent_active(tmp_path):
    from app.auth import issue_session
    from app.database import connect

    with make_client(tmp_path) as client:
        child = client.post("/api/children", json={"name": "Review Writing Retry Cap"})
        assert child.status_code == 200, child.text
        child_id = child.json()["id"]
        parent_token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        placement = client.put(
            f"/api/children/{child_id}/placement-profile",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={"domain_levels": {"recognition": "BASIC", "reading": "BASIC", "listening": "BASIC", "speaking": "BASIC", "writing": "BASIC"}},
        )
        assert placement.status_code == 200, placement.text
        with connect() as db:
            db.execute(
                "INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,'writing','你','basic-l01')",
                (child_id,),
            )
        prior_writing = client.post(
            f"/api/sprint-b/writing/attempts?child_id={child_id}&character=%E4%BD%A0",
            json={"trace_result": "correct", "assisted": False, "provider": "HANZI_WRITER", "phase": "independent", "script_mode": "TRADITIONAL"},
        )
        assert prior_writing.status_code == 200, prior_writing.text
        started = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "basic-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert started.status_code == 200, started.text
        session_id = started.json()["id"]
        pending_curriculum = next(task for task in started.json()["tasks"] if task["sourceQueue"] == "CURRICULUM" and task["required"] and task["state"] == "PENDING")
        with connect() as db:
            db.execute(
                "UPDATE srs_review_states SET due_at='2026-09-02T00:00:00Z' WHERE child_id=? AND skill_domain='writing' AND item_id='traditional::你'",
                (child_id,),
            )

        as_of = "2099-09-05T00:00:00Z"
        queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of}")
        assert queue.status_code == 200, queue.text
        assert queue.json()["review"]["items"] == [{
            "id": "traditional::你", "skillDomain": "writing", "character": "你", "scriptMode": "TRADITIONAL",
            "word": None, "lessonId": "basic-l01", "dueAt": "2026-09-02T00:00:00Z",
        }]
        reconciled = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of}")
        assert reconciled.status_code == 200, reconciled.text
        task = next(item for item in reconciled.json()["tasks"] if item["taskType"] == "REVIEW_WRITING")
        assert task["required"] is True
        started_task = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task['id']}/start")
        assert started_task.status_code == 200, started_task.text

        def evidence(index: int) -> dict[str, object]:
            return {
                "evidence_ref": f"flow-writing:{session_id}:{task['id']}:{index}",
                "trace_result": "incorrect", "assisted": False, "provider": "HANZI_WRITER",
                "phase": "independent", "script_mode": "TRADITIONAL", "attempt_index": index,
            }

        first = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task['id']}/evidence",
            json=evidence(0),
        )
        assert first.status_code == 200, first.text
        first_task = next(item for item in first.json()["tasks"] if item["id"] == task["id"])
        assert (first_task["state"], first_task["failureCount"], first_task["deferredReason"]) == ("IN_PROGRESS", 1, None)
        second = client.post(
            f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task['id']}/evidence",
            json=evidence(1),
        )
        assert second.status_code == 200, second.text
        deferred_task = next(item for item in second.json()["tasks"] if item["id"] == task["id"])
        assert (deferred_task["state"], deferred_task["failureCount"], deferred_task["deferredReason"]) == ("DEFERRED", 2, "WRITING_RETRY_CAP")
        assert deferred_task["required"] is True

        refreshed_queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of}")
        assert refreshed_queue.status_code == 200, refreshed_queue.text
        writing_due = refreshed_queue.json()["review"]["items"][0]
        assert writing_due["id"] == deferred_task["itemId"]
        assert deferred_task["taskData"]["dueAt"] == writing_due["dueAt"]
        retried = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of}")
        assert retried.status_code == 200, retried.text
        retried_task = next(item for item in retried.json()["tasks"] if item["id"] == task["id"])
        assert retried_task["state"] == "DEFERRED"
        assert retried_task["deferredReason"] == "WRITING_RETRY_CAP"
        assert retried.json()["status"] == "IN_PROGRESS"
        assert next(item for item in retried.json()["tasks"] if item["id"] == pending_curriculum["id"])["state"] == "PENDING"
        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM learning_flow_tasks WHERE session_id=? AND source_queue='REVIEW'", (session_id,)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM learning_flow_task_attempts WHERE task_id=?", (task["id"],)).fetchone()[0] == 2
            assert db.execute("SELECT COUNT(*) FROM curriculum_skill_gates WHERE child_id=? AND skill_domain='writing' AND evidence_ref LIKE ?", (child_id, f"flow-writing:{session_id}:{task['id']}:%")).fetchone()[0] == 0


def _start_fast_track_listening_review(client: TestClient, name: str) -> tuple[int, dict, dict, str, str]:
    """Create a listening SRS row through the real Fast Track API, then make it due."""
    from app.auth import issue_session
    from app.database import connect

    child_resp = client.post("/api/children", json={"name": name})
    assert child_resp.status_code == 200, child_resp.text
    child_id = child_resp.json()["id"]
    token = issue_session(subject="parent", role="parent", child_ids=[child_id])
    placement = client.put(
        f"/api/children/{child_id}/placement-profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
    )
    assert placement.status_code == 200, placement.text

    fast_track_parent = client.post(
        f"/api/children/{child_id}/learning-sessions",
        json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": "2026-09-01T00:00:00Z"},
    )
    assert fast_track_parent.status_code == 200, fast_track_parent.text
    fast_track_session_id = fast_track_parent.json()["id"]
    fast_track = client.post(
        f"/api/children/{child_id}/lesson-packages/book1-l01/fast-track",
        json={"session_id": fast_track_session_id, "answers": {"ft-q1": "c1", "ft-q2": "c1", "ft-q3": "c1", "ft-q4": "c1"}},
    )
    assert fast_track.status_code == 200, fast_track.text
    assert fast_track.json()["passed"] is True

    phrase_id = f"lf_{child_id}_book1-l01_phrase"
    as_of = "2026-09-05T00:00:00Z"
    with connect() as db:
        listening_srs = db.execute(
            "SELECT stage FROM srs_review_states WHERE child_id=? AND skill_domain='listening' AND item_id=?",
            (child_id, phrase_id),
        ).fetchone()
        phrase_link = db.execute(
            "SELECT lesson_id FROM curriculum_item_links WHERE child_id=? AND skill_domain='listening' AND item_id=?",
            (child_id, phrase_id),
        ).fetchone()
        assert listening_srs is not None and listening_srs["stage"] == 1
        assert phrase_link is not None and phrase_link["lesson_id"] == "book1-l01"
        db.execute(
            "UPDATE srs_review_states SET due_at=? WHERE child_id=? AND skill_domain='listening' AND item_id=?",
            ("2026-09-02T00:00:00Z", child_id, phrase_id),
        )
        db.execute(
            "UPDATE srs_review_states SET due_at=? WHERE child_id=? AND skill_domain='recognition'",
            ("2099-01-01T00:00:00Z", child_id),
        )

    plan = client.post(
        f"/api/children/{child_id}/learning-sessions/plan",
        json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": as_of},
    )
    assert plan.status_code == 200, plan.text
    plan_review = [task for task in plan.json()["tasks"] if task["sourceQueue"] == "REVIEW"]
    assert len(plan_review) == 1

    started = client.post(
        f"/api/children/{child_id}/learning-sessions",
        json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": as_of},
    )
    assert started.status_code == 200, started.text
    session = started.json()
    task = next(task for task in session["tasks"] if task["sourceQueue"] == "REVIEW")
    assert task["taskType"] == "REVIEW_LISTENING"
    assert task["itemId"] == phrase_id
    assert task["lessonId"] == "book1-l01"
    assert plan_review[0]["taskType"] == task["taskType"] and plan_review[0]["itemId"] == task["itemId"]

    queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of}")
    assert queue.status_code == 200, queue.text
    due_items = queue.json()["review"]["items"]
    assert {(item["skillDomain"], item["id"], item["lessonId"]) for item in due_items} == {
        ("listening", phrase_id, "book1-l01")
    }
    assert due_items[0]["questionId"] == "ft-q1"
    assert due_items[0]["audioText"] == "你好"
    assert due_items[0]["prompt"] == task["taskData"]["prompt"]
    assert due_items[0]["choices"] == task["taskData"]["choices"]
    assert "correctChoiceId" not in due_items[0]
    assert all("isCorrect" not in choice for choice in task["taskData"]["choices"])

    reconciled = client.post(
        f"/api/children/{child_id}/learning-sessions/{session['id']}/reconcile-reviews?as_of={as_of}"
    )
    assert reconciled.status_code == 200, reconciled.text
    reconciled_task = next(item for item in reconciled.json()["tasks"] if item["sourceQueue"] == "REVIEW")
    assert reconciled_task["id"] == task["id"]
    assert reconciled_task["taskData"] == task["taskData"]
    assert reconciled.json()["status"] == "IN_PROGRESS"
    pending = next(item for item in session["tasks"] if item["sourceQueue"] == "CURRICULUM" and item["required"] and item["state"] == "PENDING")
    assert next(item for item in reconciled.json()["tasks"] if item["id"] == pending["id"])["state"] == "PENDING"
    return child_id, reconciled.json(), reconciled_task, phrase_id, as_of


@pytest.mark.parametrize(
    ("answer_sequence", "assisted_final", "expected_stage", "expected_result", "expected_assisted"),
    [
        (["c2", "c1"], False, 1, "correct", 0),
        (["c1"], False, 2, "correct", 0),
        (["c1"], True, 1, "correct", 1),
    ],
)
def test_fast_track_listening_srs_reconciles_and_answers_exact_review_only(
    tmp_path, answer_sequence, assisted_final, expected_stage, expected_result, expected_assisted,
):
    from datetime import datetime, timedelta, timezone
    from app.database import connect

    with make_client(tmp_path) as client:
        child_id, session, task, phrase_id, _ = _start_fast_track_listening_review(client, "聆聽複習")
        pending = next(item for item in session["tasks"] if item["sourceQueue"] == "CURRICULUM" and item["required"] and item["state"] == "PENDING")
        assert task["masteryImpact"] == "NONE"
        assert "correctChoiceId" not in task["taskData"]
        with connect() as db:
            non_listening_states_before = [tuple(row) for row in db.execute(
                "SELECT skill_domain,item_id,stage,due_at,last_result,last_assisted FROM srs_review_states "
                "WHERE child_id=? AND skill_domain IN ('recognition','word','writing') ORDER BY skill_domain,item_id",
                (child_id,),
            ).fetchall()]
            non_listening_events_before = [tuple(row) for row in db.execute(
                "SELECT skill_domain,item_id,result,assisted,previous_stage,next_stage,interval_minutes,occurred_at "
                "FROM srs_review_events WHERE child_id=? AND skill_domain IN ('recognition','word','writing') ORDER BY id",
                (child_id,),
            ).fetchall()]

        for index, answer_id in enumerate(answer_sequence):
            answer = client.post(
                f"/api/children/{child_id}/learning-sessions/{session['id']}/tasks/{task['id']}/answer",
                json={"selected_option_id": answer_id, "assisted": assisted_final if index == len(answer_sequence) - 1 else False},
            )
            assert answer.status_code == 200, answer.text
            answer_session = answer.json()
            task_state = next(item for item in answer_session["tasks"] if item["id"] == task["id"])["state"]
            if index < len(answer_sequence) - 1:
                assert task_state == "IN_PROGRESS"
                fresh_as_of = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
                queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={fresh_as_of}")
                assert queue.status_code == 200, queue.text
                current_due = next(item for item in queue.json()["review"]["items"] if item["skillDomain"] == "listening")
                retry = client.post(
                    f"/api/children/{child_id}/learning-sessions/{session['id']}/reconcile-reviews?as_of={fresh_as_of}"
                )
                assert retry.status_code == 200, retry.text
                retry_task = next(item for item in retry.json()["tasks"] if item["id"] == task["id"])
                assert retry_task["taskData"]["dueAt"] == current_due["dueAt"]
                assert retry_task["id"] == task["id"]
            else:
                assert task_state == "COMPLETED"
                assert answer_session["status"] == "IN_PROGRESS"
                assert next(item for item in answer_session["tasks"] if item["id"] == pending["id"])["state"] == "PENDING"

        replay = client.post(
            f"/api/children/{child_id}/learning-sessions/{session['id']}/tasks/{task['id']}/answer",
            json={"selected_option_id": "c1", "assisted": assisted_final},
        )
        assert replay.status_code == 200, replay.text
        assert replay.json()["status"] == "IN_PROGRESS"
        with connect() as db:
            srs = db.execute(
                "SELECT stage,due_at,last_result,last_assisted FROM srs_review_states WHERE child_id=? AND skill_domain='listening' AND item_id=?",
                (child_id, phrase_id),
            ).fetchone()
            events = db.execute(
                "SELECT result,assisted FROM srs_review_events WHERE child_id=? AND skill_domain='listening' AND item_id=? ORDER BY occurred_at,id",
                (child_id, phrase_id),
            ).fetchall()
            flow_attempts = db.execute(
                "SELECT task_id,result,assisted,evidence_ref,scorer_version FROM learning_flow_task_attempts WHERE session_id=? AND task_id=?",
                (session["id"], task["id"]),
            ).fetchall()
            telemetry = db.execute(
                "SELECT COUNT(*) FROM learning_flow_telemetry WHERE session_id=? AND task_id=? AND event_type='review_result'",
                (session["id"], task["id"]),
            ).fetchone()[0]
            assert srs is not None
            assert (srs["stage"], srs["last_result"], srs["last_assisted"]) == (expected_stage, expected_result, expected_assisted)
            assert len(events) == len(answer_sequence) + 1  # Fast Track event plus actual REVIEW submissions.
            assert len(flow_attempts) == len(answer_sequence)
            assert telemetry == len(answer_sequence)
            assert all(row["scorer_version"] == "fast-track-listening-choice-v1" for row in flow_attempts)
            assert all(row["evidence_ref"] for row in flow_attempts)
            assert db.execute(
                "SELECT COUNT(*) FROM curriculum_skill_evidence WHERE child_id=? AND skill_domain='listening' AND lesson_id='book1-l01'",
                (child_id,),
            ).fetchone()[0] == 0
            assert db.execute(
                "SELECT COUNT(*) FROM curriculum_skill_gates WHERE child_id=? AND skill_domain='listening' AND evidence_item_id=?",
                (child_id, phrase_id),
            ).fetchone()[0] == 0
            assert db.execute("SELECT status FROM learning_flow_sessions WHERE id=?", (session["id"],)).fetchone()[0] == "IN_PROGRESS"
            assert db.execute("SELECT state FROM learning_flow_tasks WHERE id=?", (pending["id"],)).fetchone()[0] == "PENDING"
            assert [tuple(row) for row in db.execute(
                "SELECT skill_domain,item_id,stage,due_at,last_result,last_assisted FROM srs_review_states "
                "WHERE child_id=? AND skill_domain IN ('recognition','word','writing') ORDER BY skill_domain,item_id",
                (child_id,),
            ).fetchall()] == non_listening_states_before
            assert [tuple(row) for row in db.execute(
                "SELECT skill_domain,item_id,result,assisted,previous_stage,next_stage,interval_minutes,occurred_at "
                "FROM srs_review_events WHERE child_id=? AND skill_domain IN ('recognition','word','writing') ORDER BY id",
                (child_id,),
            ).fetchall()] == non_listening_events_before


def test_fast_track_listening_review_rolls_back_srs_and_flow_writes_then_retries(tmp_path):
    from app.database import connect

    with make_client(tmp_path, raise_server_exceptions=False) as client:
        child_id, session, task, phrase_id, _ = _start_fast_track_listening_review(client, "聆聽原子性")
        with connect() as db:
            event_count_before = db.execute(
                "SELECT COUNT(*) FROM srs_review_events WHERE child_id=? AND skill_domain='listening' AND item_id=?",
                (child_id, phrase_id),
            ).fetchone()[0]
            stage_before = db.execute(
                "SELECT stage FROM srs_review_states WHERE child_id=? AND skill_domain='listening' AND item_id=?",
                (child_id, phrase_id),
            ).fetchone()[0]
            db.execute(
                f"""CREATE TRIGGER fail_listening_review_telemetry
                    BEFORE INSERT ON learning_flow_telemetry
                    WHEN NEW.task_id='{task['id']}' AND NEW.event_type='task_attempted'
                    BEGIN SELECT RAISE(ABORT, 'forced listening review failure'); END"""
            )

        failed = client.post(
            f"/api/children/{child_id}/learning-sessions/{session['id']}/tasks/{task['id']}/answer",
            json={"selected_option_id": "c1"},
        )
        assert failed.status_code == 500
        with connect() as db:
            assert db.execute(
                "SELECT COUNT(*) FROM srs_review_events WHERE child_id=? AND skill_domain='listening' AND item_id=?",
                (child_id, phrase_id),
            ).fetchone()[0] == event_count_before
            assert db.execute(
                "SELECT stage FROM srs_review_states WHERE child_id=? AND skill_domain='listening' AND item_id=?",
                (child_id, phrase_id),
            ).fetchone()[0] == stage_before
            row = db.execute("SELECT state,attempt_count,evidence_ref FROM learning_flow_tasks WHERE id=?", (task["id"],)).fetchone()
            assert (row["state"], row["attempt_count"], row["evidence_ref"]) == ("PENDING", 0, None)
            assert db.execute("SELECT COUNT(*) FROM learning_flow_task_attempts WHERE task_id=?", (task["id"],)).fetchone()[0] == 0
            assert db.execute("SELECT COUNT(*) FROM learning_flow_telemetry WHERE task_id=? AND event_type='task_attempted'", (task["id"],)).fetchone()[0] == 0
            db.execute("DROP TRIGGER fail_listening_review_telemetry")

        retried = client.post(
            f"/api/children/{child_id}/learning-sessions/{session['id']}/tasks/{task['id']}/answer",
            json={"selected_option_id": "c1"},
        )
        assert retried.status_code == 200, retried.text
        assert next(item for item in retried.json()["tasks"] if item["id"] == task["id"])["state"] == "COMPLETED"
        replay = client.post(
            f"/api/children/{child_id}/learning-sessions/{session['id']}/tasks/{task['id']}/answer",
            json={"selected_option_id": "c1"},
        )
        assert replay.status_code == 200, replay.text
        with connect() as db:
            assert db.execute(
                "SELECT COUNT(*) FROM srs_review_events WHERE child_id=? AND skill_domain='listening' AND item_id=?",
                (child_id, phrase_id),
            ).fetchone()[0] == event_count_before + 1
            assert db.execute("SELECT COUNT(*) FROM learning_flow_task_attempts WHERE task_id=?", (task["id"],)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM learning_flow_telemetry WHERE task_id=? AND event_type='review_result'", (task["id"],)).fetchone()[0] == 1


def test_unsupported_listening_review_mapping_fails_before_partial_reconciliation(tmp_path):
    from app.auth import issue_session
    from app.database import connect
    from app.learning_flow import _ensure_lesson_materials, _lesson_map

    with make_client(tmp_path) as client:
        child = client.post("/api/children", json={"name": "不支援聆聽列"})
        child_id = child.json()["id"]
        other_child = client.post("/api/children", json={"name": "隔離聆聽列"})
        other_child_id = other_child.json()["id"]
        token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )
        started = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert started.status_code == 200, started.text
        session_id = started.json()["id"]
        other_token = issue_session(subject="parent", role="parent", child_ids=[other_child_id])
        other_placement = client.put(
            f"/api/children/{other_child_id}/placement-profile",
            headers={"Authorization": f"Bearer {other_token}"},
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )
        assert other_placement.status_code == 200, other_placement.text
        other_session = client.post(
            f"/api/children/{other_child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert other_session.status_code == 200, other_session.text
        with connect() as db:
            supported_phrase = _ensure_lesson_materials(db, child_id, _lesson_map()["book1-l01"])["phrase"]
            unsupported_phrase = _ensure_lesson_materials(db, child_id, _lesson_map()["basic-l01"])["phrase"]
            db.execute(
                "INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'listening', ?,1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z'), (?, 'listening', ?,1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z')",
                (child_id, supported_phrase, child_id, unsupported_phrase),
            )
        as_of = "2026-09-05T00:00:00Z"
        queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of={as_of}")
        assert queue.status_code == 400
        assert queue.json()["detail"] == "learning_flow_review_listening_identity_unsupported"
        reconcile = client.post(f"/api/children/{child_id}/learning-sessions/{session_id}/reconcile-reviews?as_of={as_of}")
        assert reconcile.status_code == 400
        assert reconcile.json()["detail"] == "learning_flow_review_listening_identity_unsupported"
        other_queue = client.get(f"/api/children/{other_child_id}/learning-daily-queue?as_of={as_of}")
        assert other_queue.status_code == 200, other_queue.text
        assert other_queue.json()["review"]["items"] == []
        assert other_queue.json()["review"]["dueCount"] == 0
        other_review = [item for item in other_session.json()["tasks"] if item["sourceQueue"] == "REVIEW"]
        assert other_review == []
        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM learning_flow_tasks WHERE session_id=? AND source_queue='REVIEW'", (session_id,)).fetchone()[0] == 0
            assert db.execute("SELECT status FROM learning_flow_sessions WHERE id=?", (session_id,)).fetchone()[0] == "IN_PROGRESS"
            assert db.execute(
                "SELECT COUNT(*) FROM srs_review_states WHERE child_id=? AND skill_domain='listening'",
                (other_child_id,),
            ).fetchone()[0] == 0
            other_listening_links = db.execute(
                "SELECT item_id,lesson_id FROM curriculum_item_links WHERE child_id=? AND skill_domain='listening'",
                (other_child_id,),
            ).fetchall()
            assert all(row["item_id"] != supported_phrase and row["item_id"] != unsupported_phrase for row in other_listening_links)
            assert all(row["item_id"] == f"lf_{other_child_id}_book1-l01_phrase" for row in other_listening_links)


def test_ambiguous_fast_track_listening_question_is_not_retrieved_for_review(tmp_path, monkeypatch):
    import copy
    from app.auth import issue_session
    from app.database import connect
    from app.lesson_packages import get_lesson_package as get_package

    with make_client(tmp_path) as client:
        child = client.post("/api/children", json={"name": "歧義聆聽列"})
        child_id = child.json()["id"]
        token = issue_session(subject="parent", role="parent", child_ids=[child_id])
        client.put(
            f"/api/children/{child_id}/placement-profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"domain_levels": {"listening": "BOOK_1", "recognition": "BOOK_1", "speaking": "BOOK_1", "writing": "STARTER"}},
        )
        started = client.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"target_minutes": 18, "lesson_id": "book1-l01", "as_of": "2026-09-01T00:00:00Z"},
        )
        assert started.status_code == 200, started.text
        phrase_id = f"lf_{child_id}_book1-l01_phrase"
        with connect() as db:
            db.execute(
                "INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'listening', ?,1,'2026-09-02T00:00:00Z','correct',0,'2026-09-01T00:00:00Z')",
                (child_id, phrase_id),
            )
        package = copy.deepcopy(get_package("book1-l01"))
        exit_ticket = next(step for step in package["taskBlueprint"]["fastTrackSteps"] if step["stepKey"] == "exit_ticket")
        exit_ticket["data"]["questions"].append(copy.deepcopy(exit_ticket["data"]["questions"][0]))
        monkeypatch.setattr("app.lesson_packages.get_lesson_package", lambda lesson_id: package if lesson_id == "book1-l01" else get_package(lesson_id))

        queue = client.get(f"/api/children/{child_id}/learning-daily-queue?as_of=2026-09-05T00:00:00Z")
        assert queue.status_code == 400
        assert queue.json()["detail"] == "learning_flow_review_listening_identity_unsupported"

