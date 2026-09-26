import json
from pathlib import Path

from fastapi.testclient import TestClient


def client(tmp_path: Path):
    import os
    os.environ["TONGXUAN_ENV"] = "development"
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "learning-flow.sqlite3")
    from app.main import app
    return TestClient(app)


def child(api: TestClient, name: str = "Learner") -> int:
    response = api.post("/api/children", json={"name": name})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def place(child_id: int, start: str, writing: str | None = None, age: int = 7) -> None:
    from app.placement import save_placement_profile
    domains = {key: start for key in ("recognition", "reading", "vocabulary", "grammar")}
    if writing:
        domains["writing"] = writing
    save_placement_profile(child_id=child_id, domain_levels=domains, assessment_method="PARENT_OBSERVATION", assessed_by="flow-test", age_hint_years=age)


def ensure_lesson_materials(child_id: int, lesson_id: str = "starter-l01") -> None:
    from app.curriculum_policy import _lesson_map
    from app.database import connect
    from app.learning_flow import _ensure_lesson_materials
    with connect() as db:
        _ensure_lesson_materials(db, child_id, _lesson_map()[lesson_id])


def session(api: TestClient, child_id: int) -> dict:
    response = api.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-20T08:00:00Z"})
    assert response.status_code == 200, response.text
    return response.json()


def start_task(api: TestClient, child_id: int, current: dict, task: dict) -> dict:
    response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/start")
    assert response.status_code == 200, response.text
    return response.json()


def answer_task(api: TestClient, child_id: int, current: dict, task: dict, option: str, assisted: bool = False) -> dict:
    response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/answer", json={"selected_option_id": option, "assisted": assisted})
    assert response.status_code == 200, response.text
    return response.json()


def complete_session(api: TestClient, child_id: int, current: dict, assisted_scores: bool = False, skip_writing: bool = False) -> dict:
    from app.database import connect

    for task in current["tasks"]:
        if task["taskType"] == "LESSON_WRAP_UP" or task["state"] in {"COMPLETED", "DEFERRED"}:
            continue
        if task["taskType"].startswith("WRITING_") and (skip_writing or not task["required"]):
            result = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/skip", json={})
            assert result.status_code == 200, result.text
            continue
        current = start_task(api, child_id, current, task)
        if task["taskType"] == "LISTENING":
            attempt = api.post(f"/api/children/{child_id}/listening-attempts", json={"item_id": task["itemId"]}).json()
            complete = api.post(f"/api/children/{child_id}/listening-attempts/{attempt['id']}/complete", json={"duration_ms": 500})
            assert complete.status_code == 200, complete.text
            response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json={"evidence_ref": attempt["id"]})
            assert response.status_code == 200, response.text
        elif task["taskType"] in {"SPEAKING_ATTEMPT", "PRONUNCIATION_ATTEMPT"}:
            domain = "pronunciation" if task["taskType"] == "PRONUNCIATION_ATTEMPT" else "speaking"
            attempt = api.post("/api/reading-aloud/attempts/start?child_id=" + str(child_id), json={"text": task["taskData"]["text"], "text_kind": "character", "locale": "zh-TW", "source_type": "CURRICULUM", "source_id": task["itemId"], "activity_domain": domain})
            assert attempt.status_code == 200, attempt.text
            attempt_id = attempt.json()["id"]
            response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json={"evidence_ref": attempt_id, "duration_ms": 500})
            assert response.status_code == 200, response.text
        elif task["taskType"] in {"RECOGNITION", "REVIEW_RECOGNITION", "MINI_CHECK", "VOCABULARY", "SENTENCE_PATTERN"}:
            if task["taskData"].get("mode") == "reflection":
                selected = "practiced"
            elif task["taskType"] == "VOCABULARY":
                selected = next(option["id"] for option in task["taskData"]["choices"] if option["id"] in {"greeting", "opt-hello"} or "打招呼" in option["label"])
            elif task["taskType"] == "SENTENCE_PATTERN":
                selected = next(option["id"] for option in task["taskData"]["choices"] if option["id"] in {"greeting", "opt-correct-order"} or option.get("isCorrect"))
            else:
                if task["taskType"] == "REVIEW_RECOGNITION":
                    expected = task["taskData"]["audioText"]
                else:
                    with connect() as db:
                        expected = db.execute("SELECT character FROM learning_items WHERE child_id=? AND id=?", (child_id, task["itemId"])).fetchone()[0]
                selected = next(option["id"] for option in task["taskData"]["choices"] if option["label"] == expected)
            current = answer_task(api, child_id, current, task, selected, assisted_scores and task["taskType"] in {"RECOGNITION", "REVIEW_RECOGNITION", "VOCABULARY", "MINI_CHECK"})
        elif task["taskType"] == "PHONETICS":
            answers = {}
            with connect() as db:
                for question in task["taskData"]["questions"]:
                    row = db.execute("SELECT notation FROM pronunciation_readings WHERE character=? AND script=? ORDER BY id LIMIT 1", (question["character"], question["script"])).fetchone()
                    answers[question["id"]] = next(option["id"] for option in question["choices"] if option["label"] == row["notation"])
            response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/answer", json={"answers": answers, "assisted": assisted_scores})
            assert response.status_code == 200, response.text
            current = response.json()
        else:
            raise AssertionError(f"Unhandled task type: {task['taskType']}")
        current = api.get(f"/api/children/{child_id}/learning-sessions/{current['id']}").json()
    completed = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/complete", json={})
    assert completed.status_code == 200, completed.text
    return completed.json()


def test_plan_is_deterministic_and_does_not_disclose_answer_keys(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        body = {"as_of": "2026-09-20T08:00:00Z", "target_minutes": 18, "script_mode": "TRADITIONAL"}
        first = api.post(f"/api/children/{child_id}/learning-sessions/plan", json=body).json()
        second = api.post(f"/api/children/{child_id}/learning-sessions/plan", json=body).json()
        assert first == second
        assert all(not any(key.startswith("_") for key in task) for task in first["tasks"])


def test_equal_age_children_start_from_their_assessed_placement(tmp_path):
    with client(tmp_path) as api:
        starter, basic = child(api, "Starter"), child(api, "Basic")
        place(starter, "STARTER", age=7)
        place(basic, "BASIC", age=7)
        a = api.get(f"/api/children/{starter}/learning-daily-queue").json()
        b = api.get(f"/api/children/{basic}/learning-daily-queue").json()
        assert a["newLesson"]["lessonId"] == "starter-l01"
        assert b["newLesson"]["lessonId"] == "basic-l01"
        assert a["placementStart"] != b["placementStart"]


def test_due_reviews_precede_new_lesson_tasks(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        ensure_lesson_materials(child_id, "basic-l01")
        with connect() as db:
            item_id = db.execute("SELECT id FROM learning_items WHERE child_id=? AND character='你' ORDER BY id LIMIT 1", (child_id,)).fetchone()[0]
            db.execute("INSERT OR REPLACE INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'recognition', ?, 1, '2026-09-20 07:00:00','correct',0,'2026-09-20 06:00:00')", (child_id, item_id))
        plan = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        assert plan["tasks"][0]["sourceQueue"] == "REVIEW"
        assert plan["tasks"][0]["itemId"] == item_id


def test_future_due_content_from_locked_lesson_is_excluded(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        with connect() as db:
            item_id = "future-lesson-item"
            db.execute("INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status) VALUES(?,?,?,'test','TONGXUAN_AUTHORED_INTERNAL_DRAFT')", (item_id, child_id, "我"))
            db.execute("INSERT INTO curriculum_item_links(child_id,skill_domain,item_id,lesson_id) VALUES(?,?,?,?)", (child_id, "recognition", item_id, "starter-l02"))
            db.execute("INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'recognition', ?, 1, '2026-09-20 07:00:00','correct',0,'2026-09-20 06:00:00')", (child_id, item_id))
        plan = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        assert item_id not in {task["itemId"] for task in plan["tasks"]}


def test_strong_recognition_state_reduces_fresh_recognition_tasks(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        ensure_lesson_materials(child_id, "basic-l01")
        full = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={}).json()
        with connect() as db:
            item_id = db.execute("SELECT id FROM learning_items WHERE child_id=? AND character='你' ORDER BY id LIMIT 1", (child_id,)).fetchone()[0]
            db.execute("INSERT INTO recognition_states(child_id,item_id,correct_count,incorrect_count,assisted_count,last_result) VALUES(?,?,2,0,0,'correct')", (child_id, item_id))
        adapted = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={}).json()
        assert sum(task["taskType"] in {"RECOGNITION", "MINI_CHECK"} and task["skillDomain"] == "recognition" for task in adapted["tasks"]) < sum(task["taskType"] in {"RECOGNITION", "MINI_CHECK"} and task["skillDomain"] == "recognition" for task in full["tasks"])


def test_weaker_writing_placement_adds_only_optional_targeted_writing(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1", writing="BASIC")
        plan = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={"script_mode": "SIMPLIFIED"}).json()
        writing = [task for task in plan["tasks"] if task["taskType"].startswith("WRITING_")]
        assert len(writing) == 1
        assert writing[0]["required"] is False
        assert writing[0]["taskData"]["character"] == "你"
        assert writing[0]["taskData"]["scriptMode"] == "SIMPLIFIED"


def test_three_wrong_attempts_pause_and_defer_the_blocking_task(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        task = next(task for task in current["tasks"] if task["taskType"] == "RECOGNITION")
        wrong = next(option["id"] for option in task["taskData"]["choices"] if option["label"] != "你")
        for _ in range(3):
            current = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/answer", json={"selected_option_id": wrong}).json()
        assert current["status"] == "PAUSED"
        assert next(item for item in current["tasks"] if item["id"] == task["id"])["deferredReason"] == "REPEATED_FAILURES"


def test_session_can_finish_with_assisted_answers_without_mastery(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        result = complete_session(api, child_id, current, assisted_scores=True)
        assert result["status"] == "COMPLETED"
        assert result["masteryStatus"] == "NEEDS_REVIEW"
        assert result["reward"]["earned"] is True


def test_basic_secondary_golden_path_completes_with_linked_evidence(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        result = complete_session(api, child_id, session(api, child_id))
        assert result["status"] == "COMPLETED"
        assert result["masteryStatus"] == "MASTERED"
        assert result["curriculumContext"]["lessonId"] == "basic-l01"


def test_session_practice_and_mastery_are_persisted_separately(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        with connect() as db:
            assert db.execute("SELECT status FROM curriculum_lesson_states WHERE child_id=? AND lesson_id='book1-l01'", (child_id,)).fetchone() is None
        assert current["masteryStatus"] is None
        completed = complete_session(api, child_id, current, assisted_scores=True)
        with connect() as db:
            state = db.execute("SELECT status FROM curriculum_lesson_states WHERE child_id=? AND lesson_id='book1-l01'", (child_id,)).fetchone()
        assert state["status"] == "NEEDS_REVIEW"
        assert completed["reward"]["earned"] is True


def test_speaking_and_pronunciation_are_non_score_gates(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        complete_session(api, child_id, session(api, child_id))
        with connect() as db:
            score_rows = db.execute("SELECT COUNT(*) FROM curriculum_skill_evidence WHERE child_id=? AND skill_domain IN ('speaking','pronunciation')", (child_id,)).fetchone()[0]
            gate_rows = db.execute("SELECT skill_domain FROM curriculum_skill_gates WHERE child_id=? AND lesson_id='book1-l01'", (child_id,)).fetchall()
        assert score_rows == 0
        assert {row["skill_domain"] for row in gate_rows} >= {"speaking", "pronunciation", "listening"}


def test_speaking_evidence_operation_atomically_completes_provider_and_flow_task(tmp_path):
    from app.database import connect

    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        task = next(t for t in current["tasks"] if t["taskType"] == "SPEAKING_ATTEMPT")
        current = start_task(api, child_id, current, task)
        attempt_response = api.post("/api/reading-aloud/attempts/start", params={"child_id": child_id}, json={
            "text": task["taskData"]["text"], "text_kind": "character", "locale": "zh-TW",
            "source_type": "CURRICULUM", "source_id": task["itemId"], "activity_domain": "speaking",
        })
        assert attempt_response.status_code == 200, attempt_response.text
        attempt_id = attempt_response.json()["id"]
        assert attempt_response.json()["status"] == "STARTED"

        # Flow-owned curriculum attempts cannot be finalized outside the atomic evidence boundary.
        premature_complete = api.post(f"/api/reading-aloud/attempts/{attempt_id}/complete", params={"child_id": child_id}, json={"duration_ms": 500})
        assert premature_complete.status_code == 400
        assert premature_complete.json()["detail"] == "learning_flow_evidence_required"
        with connect() as db:
            assert db.execute("SELECT status FROM reading_aloud_attempts WHERE id=?", (attempt_id,)).fetchone()["status"] == "STARTED"
            assert db.execute("SELECT COUNT(*) FROM curriculum_skill_gates WHERE child_id=? AND evidence_ref=?", (child_id, attempt_id)).fetchone()[0] == 0

        final_response = api.post(
            f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence",
            json={"evidence_ref": attempt_id, "duration_ms": 500},
        )
        assert final_response.status_code == 200, final_response.text
        final_task = next(t for t in final_response.json()["tasks"] if t["id"] == task["id"])
        assert final_task["state"] == "COMPLETED"

        with connect() as db:
            provider = db.execute("SELECT status FROM reading_aloud_attempts WHERE id=?", (attempt_id,)).fetchone()
            gates = db.execute("SELECT skill_domain FROM curriculum_skill_gates WHERE child_id=? AND evidence_ref=?", (child_id, attempt_id)).fetchall()
            flow_attempts = db.execute("SELECT COUNT(*) FROM learning_flow_task_attempts WHERE task_id=? AND evidence_ref=?", (task["id"], attempt_id)).fetchone()[0]
        assert provider["status"] == "COMPLETED"
        assert [row["skill_domain"] for row in gates] == ["speaking"]
        assert flow_attempts == 1


def test_speaking_evidence_failure_rolls_back_all_writes_and_retry_commits_once(tmp_path, monkeypatch):
    from app import learning_flow
    from app.database import connect

    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        task = next(t for t in current["tasks"] if t["taskType"] == "SPEAKING_ATTEMPT")
        current = start_task(api, child_id, current, task)
        attempt_response = api.post("/api/reading-aloud/attempts/start", params={"child_id": child_id}, json={
            "text": task["taskData"]["text"], "text_kind": "character", "locale": "zh-TW",
            "source_type": "CURRICULUM", "source_id": task["itemId"], "activity_domain": "speaking",
        })
        assert attempt_response.status_code == 200, attempt_response.text
        attempt_id = attempt_response.json()["id"]
        assert attempt_response.json()["status"] == "STARTED"

        original_insert = learning_flow._insert_learning_flow_task_attempt

        def fail_after_flow_evidence_insert(db, **kwargs):
            original_insert(db, **kwargs)
            raise RuntimeError("injected_learning_flow_evidence_persistence_failure")

        with monkeypatch.context() as patcher:
            patcher.setattr(learning_flow, "_insert_learning_flow_task_attempt", fail_after_flow_evidence_insert)
            failed_response = api.post(
                f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence",
                json={"evidence_ref": attempt_id, "duration_ms": 500},
            )
            assert failed_response.status_code == 500

        with connect() as db:
            provider = db.execute("SELECT status FROM reading_aloud_attempts WHERE id=?", (attempt_id,)).fetchone()
            gate_count = db.execute("SELECT COUNT(*) FROM curriculum_skill_gates WHERE child_id=? AND evidence_ref=?", (child_id, attempt_id)).fetchone()[0]
            task_row = db.execute("SELECT state FROM learning_flow_tasks WHERE id=?", (task["id"],)).fetchone()
            evidence_count = db.execute("SELECT COUNT(*) FROM learning_flow_task_attempts WHERE task_id=? AND evidence_ref=?", (task["id"], attempt_id)).fetchone()[0]
        assert provider["status"] == "STARTED"
        assert gate_count == 0
        assert task_row["state"] != "COMPLETED"
        assert task_row["state"] == "IN_PROGRESS"
        assert evidence_count == 0

        retry_response = api.post(
            f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence",
            json={"evidence_ref": attempt_id, "duration_ms": 500},
        )
        assert retry_response.status_code == 200, retry_response.text
        retry_task = next(t for t in retry_response.json()["tasks"] if t["id"] == task["id"])
        assert retry_task["state"] == "COMPLETED"

        # Replaying the successful request is idempotent and produces a single final record.
        replay_response = api.post(
            f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence",
            json={"evidence_ref": attempt_id, "duration_ms": 500},
        )
        assert replay_response.status_code == 200, replay_response.text
        with connect() as db:
            provider = db.execute("SELECT status FROM reading_aloud_attempts WHERE id=?", (attempt_id,)).fetchone()
            gate_count = db.execute("SELECT COUNT(*) FROM curriculum_skill_gates WHERE child_id=? AND evidence_ref=?", (child_id, attempt_id)).fetchone()[0]
            final_task = db.execute("SELECT state FROM learning_flow_tasks WHERE id=?", (task["id"],)).fetchone()
            evidence_count = db.execute("SELECT COUNT(*) FROM learning_flow_task_attempts WHERE task_id=? AND evidence_ref=?", (task["id"], attempt_id)).fetchone()[0]
        assert provider["status"] == "COMPLETED"
        assert gate_count == 1
        assert final_task["state"] == "COMPLETED"
        assert evidence_count == 1


def test_day_one_correct_review_schedules_short_interval(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        ensure_lesson_materials(child_id, "basic-l01")
        with connect() as db:
            item_id = db.execute("SELECT id FROM learning_items WHERE child_id=? AND character='你' ORDER BY id LIMIT 1", (child_id,)).fetchone()[0]
            db.execute("INSERT OR REPLACE INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'recognition', ?, 0, '2026-09-20 07:00:00','incorrect',0,'2026-09-20 06:00:00')", (child_id, item_id))
        review = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={"as_of": "2026-09-20T08:00:00Z"}).json()["tasks"][0]
        assert review["taskType"] == "REVIEW_RECOGNITION"
        current = api.post(f"/api/children/{child_id}/learning-sessions", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        review = current["tasks"][0]
        correct = next(option["id"] for option in review["taskData"]["choices"] if option["label"] == "你")
        answer_task(api, child_id, current, review, correct)
        with connect() as db:
            state = db.execute("SELECT stage,due_at,last_result FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id=?", (child_id, item_id)).fetchone()
        assert state["stage"] == 1
        assert state["last_result"] == "correct"
        assert state["due_at"] > "2026-09-20 08:00:00"


def test_day_zero_evidence_enters_due_queue_then_day_one_review_expands_interval(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        completed = complete_session(api, child_id, session(api, child_id))
        assert completed["masteryStatus"] == "MASTERED"
        with connect() as db:
            due = db.execute("SELECT item_id,due_at,stage FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' ORDER BY item_id LIMIT 1", (child_id,)).fetchone()
            assert due and due["stage"] == 1
            db.execute("UPDATE srs_review_states SET due_at='2026-09-20 07:00:00' WHERE child_id=? AND skill_domain='recognition' AND item_id=?", (child_id, due["item_id"]))
        queue = api.get(f"/api/children/{child_id}/learning-daily-queue", params={"as_of": "2026-09-20T08:00:00Z"}).json()
        assert any(item["id"] == due["item_id"] for item in queue["review"]["items"])
        current = api.post(f"/api/children/{child_id}/learning-sessions", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        review = next(task for task in current["tasks"] if task["sourceQueue"] == "REVIEW")
        correct = next(option["id"] for option in review["taskData"]["choices"] if option["label"] == "你")
        answer_task(api, child_id, current, review, correct)
        with connect() as db:
            advanced = db.execute("SELECT stage,last_result,due_at FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id=?", (child_id, due["item_id"])).fetchone()
        assert advanced["stage"] == 2 and advanced["last_result"] == "correct"
        assert advanced["due_at"] > "2026-09-20 08:00:00"


def test_incorrect_and_assisted_reviews_do_not_advance_srs_stage(tmp_path):
    from app.database import connect
    from app.curriculum_policy import record_srs_review
    with client(tmp_path) as api:
        child_id = child(api)
        with connect() as db:
            record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id="item-x", result="correct", assisted=False, occurred_at="2026-01-01T00:00:00Z")
            incorrect = record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id="item-x", result="incorrect", assisted=False, occurred_at="2026-01-01T01:00:00Z")
            assert incorrect["stage"] == 0
            assisted = record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id="item-x", result="correct", assisted=True, occurred_at="2026-01-01T02:00:00Z")
            assert assisted["stage"] == 0
            assert assisted["last_assisted"] == 1


def test_recognition_attempt_changes_only_recognition_srs(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BASIC")
        ensure_lesson_materials(child_id, "basic-l01")
        with connect() as db:
            item_id = db.execute("SELECT id FROM learning_items WHERE child_id=? AND character='你' ORDER BY id LIMIT 1", (child_id,)).fetchone()[0]
            db.execute("INSERT OR REPLACE INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,last_assisted,updated_at) VALUES(?, 'recognition', ?, 0, '2026-09-20 07:00:00','incorrect',0,'2026-09-20 06:00:00')", (child_id, item_id))
        current = api.post(f"/api/children/{child_id}/learning-sessions", json={"as_of": "2026-09-20T08:00:00Z"}).json()
        review = current["tasks"][0]
        correct = next(option["id"] for option in review["taskData"]["choices"] if option["label"] == "你")
        answer_task(api, child_id, current, review, correct)
        with connect() as db:
            domains = {row["skill_domain"] for row in db.execute("SELECT skill_domain FROM srs_review_states WHERE child_id=?", (child_id,))}
        assert domains == {"recognition"}


def test_paused_session_resumes_without_duplicate_session_or_reward(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        original_id = current["id"]
        api.post(f"/api/children/{child_id}/learning-sessions/{original_id}/stop", json={"reason": "USER_EXIT"})
        resumed = api.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "script_mode": "TRADITIONAL"}).json()
        assert resumed["id"] == original_id and resumed["resumed"] is True
        completed = complete_session(api, child_id, resumed)
        again = api.post(f"/api/children/{child_id}/learning-sessions/{original_id}/complete", json={}).json()
        assert completed["reward"]["points"] == again["reward"]["points"] == 5
        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM learning_flow_sessions WHERE child_id=?", (child_id,)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM points_ledger WHERE child_id=? AND event_key=?", (child_id, f"learning-session:{original_id}")).fetchone()[0] == 1


def test_learning_session_is_child_scoped(tmp_path):
    with client(tmp_path) as api:
        alice, bob = child(api, "Alice"), child(api, "Bob")
        current = session(api, alice)
        response = api.get(f"/api/children/{bob}/learning-sessions/{current['id']}")
        assert response.status_code == 404
        assert api.get(f"/api/children/{bob}/learning-sessions/current").json() is None


def test_session_reward_does_not_imply_curriculum_mastery(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        result = complete_session(api, child_id, session(api, child_id), assisted_scores=True)
        assert result["reward"]["earned"] is True
        assert result["reward"]["points"] == 5
        assert result["masteryStatus"] != "MASTERED"


def test_telemetry_keeps_answers_and_audio_out_of_persisted_details(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        current = session(api, child_id)
        task = next(task for task in current["tasks"] if task["taskType"] == "PHONETICS")
        api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/answer", json={"answers": {}})
        with connect() as db:
            details = [row["details_json"] for row in db.execute("SELECT details_json FROM learning_flow_telemetry WHERE child_id=?", (child_id,))]
            tables = {row["name"] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        serialized = " ".join(details).lower()
        assert "audio" not in serialized and "blob" not in serialized
        assert "selected_option_id" not in serialized and "answer_key" not in serialized
        assert "learning_flow_telemetry" in tables


def test_optional_writing_can_be_skipped_without_becoming_a_mastery_gate(tmp_path):
    from app.database import connect
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1", writing="BASIC")
        current = session(api, child_id)
        writing = next(task for task in current["tasks"] if task["taskType"].startswith("WRITING_"))
        skipped = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{writing['id']}/skip", json={})
        assert skipped.status_code == 200
        current = complete_session(api, child_id, skipped.json(), skip_writing=True)
        with connect() as db:
            state = db.execute("SELECT state,deferred_reason FROM learning_flow_tasks WHERE id=?", (writing["id"],)).fetchone()
            writing_attempts = db.execute("SELECT COUNT(*) FROM writing_attempts WHERE child_id=?", (child_id,)).fetchone()[0]
        assert state["state"] == "DEFERRED" and state["deferred_reason"] == "OPTIONAL_SKIPPED"
        assert writing_attempts == 0
        assert current["masteryStatus"] == "MASTERED", f"missing={current.get('assessment', {}).get('missingDomains')} failed={current.get('assessment', {}).get('failedDomains')} scores={current.get('assessment', {}).get('scores')} gates={current.get('assessment', {}).get('gateStatuses')}"


def test_mastered_placement_lesson_unlocks_next_lesson_in_that_stage(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        before = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        before_lesson = next(lesson for stage in before["stages"] if stage["id"] == "book-1" for lesson in stage["lessons"] if lesson["id"] == "book1-l02")
        assert before_lesson["accessible"] is False
        complete_session(api, child_id, session(api, child_id))
        after = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        after_lesson = next(lesson for stage in after["stages"] if stage["id"] == "book-1" for lesson in stage["lessons"] if lesson["id"] == "book1-l02")
        assert after_lesson["accessible"] is True
        queue = api.get(f"/api/children/{child_id}/learning-daily-queue").json()
        assert queue["nextAccessibleLesson"]["lessonId"] == "book1-l02"
        assert queue["newLesson"] is None
        assert queue["currentLessonComplete"] is True
        assert queue["completedLesson"]["lessonId"] == "book1-l01"
        assert queue["nextLessonComingSoon"] is True


def test_parent_report_is_scoped_and_excludes_raw_audio(tmp_path):
    from app.auth import issue_session
    with client(tmp_path) as api:
        child_id, other_id = child(api, "Alice"), child(api, "Bob")
        unauthenticated = api.get(f"/api/children/{child_id}/learning-sessions/report")
        assert unauthenticated.status_code == 401
        parent = {"Authorization": f"Bearer {issue_session(subject='parent-a', role='parent', child_ids=[child_id])}"}
        forbidden = api.get(f"/api/children/{other_id}/learning-sessions/report", headers=parent)
        assert forbidden.status_code == 403
        report = api.get(f"/api/children/{child_id}/learning-sessions/report", headers=parent)
        assert report.status_code == 200, report.text
        assert report.json()["privacy"]["rawAudioStored"] is False
        assert "weakDomains" in report.json() and "deferredTasks" in report.json()
from app.auth import issue_session
from app.database import connect
from app.learning_flow import _parse_stamp
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi.testclient import TestClient
from tests.test_learning_flow import client, child, place, session


def test_parse_stamp_supports_persisted_formats():
    assert _parse_stamp(None) is None
    assert _parse_stamp("") is None
    assert _parse_stamp("   ") is None

    # Standard app format from now()
    parsed1 = _parse_stamp("2026-09-20 08:30:00")
    assert parsed1 == datetime(2026, 9, 20, 8, 30, 0)

    # ISO with Z
    parsed2 = _parse_stamp("2026-09-20T08:30:00Z")
    assert parsed2 == datetime(2026, 9, 20, 8, 30, 0)

    # ISO with offset
    parsed3 = _parse_stamp("2026-09-20T08:30:00+00:00")
    assert parsed3 == datetime(2026, 9, 20, 8, 30, 0)

    # ISO with microseconds
    parsed4 = _parse_stamp("2026-09-20 08:30:00.123456")
    assert parsed4 == datetime(2026, 9, 20, 8, 30, 0, 123456)

    # Datetime object
    dt = datetime(2026, 9, 20, 8, 30, 0)
    assert _parse_stamp(dt) == dt


def test_session_target_time_exceeded_pauses_before_accepting_task_or_evidence(tmp_path):
    """Regression 1: Set last_resumed_at > target_minutes ago and verify new task/evidence first pauses session with SESSION_TARGET_REACHED."""
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "STARTER")
        current = session(api, child_id)
        session_id = current["id"]

        # Backdate last_resumed_at to 20 minutes ago (> 18 target_minutes)
        past_stamp = (datetime.now(timezone.utc) - timedelta(minutes=20)).strftime("%Y-%m-%d %H:%M:%S")
        with connect() as db:
            db.execute("UPDATE learning_flow_sessions SET last_resumed_at=? WHERE id=?", (past_stamp, session_id))

        first_task = current["tasks"][0]

        # Submitting answer should be rejected because target time was exceeded and session is paused
        ans_resp = api.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{first_task['id']}/answer", json={"selected_option_id": "opt1"})
        assert ans_resp.status_code in (400, 409)

        # Verify session state transitioned to PAUSED with SESSION_TARGET_REACHED
        check_sess = api.get(f"/api/children/{child_id}/learning-sessions/{session_id}").json()
        assert check_sess["status"] == "PAUSED"
        assert check_sess["terminationReason"] == "SESSION_TARGET_REACHED"
        assert check_sess["activeSeconds"] >= 20 * 60

        # Incomplete tasks should be deferred with STOP_SESSION_TARGET_REACHED
        for t in check_sess["tasks"]:
            if t["state"] == "DEFERRED":
                assert t["deferredReason"] in ("STOP_SESSION_TARGET_REACHED", "SESSION_TARGET_REACHED")

        # Starting a task or attaching evidence on this paused session must also fail
        start_resp = api.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{first_task['id']}/start")
        assert start_resp.status_code in (400, 409)

        evidence_resp = api.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{first_task['id']}/evidence", json={"evidence_ref": "any-ref"})
        assert evidence_resp.status_code in (400, 409)


def test_session_pause_accumulates_active_seconds_and_preserves_across_resume(tmp_path):
    """Regressions 2 & 5: Pause after known interval verifies active_seconds > 0; resume preserves prior active time and adds only new segment."""
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "STARTER")
        current = session(api, child_id)
        session_id = current["id"]

        # Backdate last_resumed_at to 300 seconds ago (5 mins)
        stamp_300s_ago = (datetime.now(timezone.utc) - timedelta(seconds=300)).strftime("%Y-%m-%d %H:%M:%S")
        with connect() as db:
            db.execute("UPDATE learning_flow_sessions SET last_resumed_at=? WHERE id=?", (stamp_300s_ago, session_id))

        # Regression 2: Pause session after known interval
        stopped = api.post(f"/api/children/{child_id}/learning-sessions/{session_id}/stop", json={"reason": "FATIGUE"})
        assert stopped.status_code == 200
        paused_data = stopped.json()
        assert paused_data["status"] == "PAUSED"
        assert paused_data["terminationReason"] == "FATIGUE"
        assert 295 <= paused_data["activeSeconds"] <= 310
        first_segment_active = paused_data["activeSeconds"]

        # Regression 5: Resume paused session
        resumed = api.post(f"/api/children/{child_id}/learning-sessions", json={"target_minutes": 18, "script_mode": "TRADITIONAL"})
        assert resumed.status_code == 200
        resumed_data = resumed.json()
        assert resumed_data["status"] == "IN_PROGRESS"
        assert resumed_data["resumed"] is True
        # Prior active time is preserved
        assert resumed_data["activeSeconds"] == first_segment_active

        # Simulate second active segment of 120 seconds
        stamp_120s_ago = (datetime.now(timezone.utc) - timedelta(seconds=120)).strftime("%Y-%m-%d %H:%M:%S")
        with connect() as db:
            db.execute("UPDATE learning_flow_sessions SET last_resumed_at=? WHERE id=?", (stamp_120s_ago, session_id))

        stopped_again = api.post(f"/api/children/{child_id}/learning-sessions/{session_id}/stop", json={"reason": "PARENT_LIMIT"})
        assert stopped_again.status_code == 200
        second_paused_data = stopped_again.json()
        assert second_paused_data["status"] == "PAUSED"
        assert second_paused_data["terminationReason"] == "PARENT_LIMIT"
        # Total active time = prior segment + second segment
        assert first_segment_active + 115 <= second_paused_data["activeSeconds"] <= first_segment_active + 130


def test_task_start_and_completion_records_elapsed_seconds_and_telemetry(tmp_path):
    """Regression 3: Start/complete a task with known interval and verify elapsed_seconds > 0 and telemetry durationSeconds."""
    import json
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = session(api, child_id)
        session_id = current["id"]

        # Pick a task, start it
        task = next(t for t in current["tasks"] if t["taskType"] == "RECOGNITION")
        started = api.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task['id']}/start")
        assert started.status_code == 200

        # Backdate task started_at to 45 seconds ago
        task_start_stamp = (datetime.now(timezone.utc) - timedelta(seconds=45)).strftime("%Y-%m-%d %H:%M:%S")
        with connect() as db:
            db.execute("UPDATE learning_flow_tasks SET started_at=? WHERE id=?", (task_start_stamp, task["id"]))

        # Answer task correctly
        with connect() as db:
            expected_char = db.execute("SELECT character FROM learning_items WHERE child_id=? AND id=?", (child_id, task["itemId"])).fetchone()[0]
        choice = next(opt["id"] for opt in task["taskData"]["choices"] if opt["label"] == expected_char)

        answered = api.post(f"/api/children/{child_id}/learning-sessions/{session_id}/tasks/{task['id']}/answer", json={"selected_option_id": choice})
        assert answered.status_code == 200

        updated_task = next(t for t in answered.json()["tasks"] if t["id"] == task["id"])
        assert updated_task["state"] == "COMPLETED"
        assert 40 <= updated_task["elapsedSeconds"] <= 55

        # Check telemetry durationSeconds
        with connect() as db:
            attempt_row = db.execute("SELECT details_json FROM learning_flow_telemetry WHERE session_id=? AND task_id=? AND event_type='task_attempted'", (session_id, task["id"])).fetchone()
            assert attempt_row is not None
            details = json.loads(attempt_row["details_json"])
            assert 40 <= details["durationSeconds"] <= 55


def test_parent_report_reflects_persisted_session_duration(tmp_path):
    """Regression 4: Verify the parent report returns the persisted non-zero duration."""
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "STARTER")
        current = session(api, child_id)
        session_id = current["id"]

        # Backdate last_resumed_at by 240 seconds
        past_stamp = (datetime.now(timezone.utc) - timedelta(seconds=240)).strftime("%Y-%m-%d %H:%M:%S")
        with connect() as db:
            db.execute("UPDATE learning_flow_sessions SET last_resumed_at=? WHERE id=?", (past_stamp, session_id))

        # Pause session
        api.post(f"/api/children/{child_id}/learning-sessions/{session_id}/stop", json={"reason": "FATIGUE"})

        # Query parent report
        parent_headers = {"Authorization": f"Bearer {issue_session(subject='parent-a', role='parent', child_ids=[child_id])}"}
        report_resp = api.get(f"/api/children/{child_id}/learning-sessions/report", headers=parent_headers)
        assert report_resp.status_code == 200
        report = report_resp.json()

        session_summary = next(s for s in report["sessions"] if s["sessionId"] == session_id)
        assert 235 <= session_summary["durationSeconds"] <= 255


def test_mastered_book1_learner_daily_queue_and_session_safety(tmp_path):
    """Regression: When Book 1 Lesson 1 is mastered, daily queue reports completed state without newLesson, and sessions without due review do not restart L1 as new."""
    with client(tmp_path) as api:
        child_id = child(api, "MasteredLearner")
        place(child_id, "BOOK_1")

        # Initial queue has book1-l01 as newLesson
        init_queue = api.get(f"/api/children/{child_id}/learning-daily-queue").json()
        assert init_queue["newLesson"]["lessonId"] == "book1-l01"
        assert init_queue["currentLessonComplete"] is False

        # Complete session to master book1-l01
        sess = session(api, child_id)
        completed = complete_session(api, child_id, sess)
        assert completed["masteryStatus"] == "MASTERED"

        # After mastery, dailyQueue reflects completion and next lesson preview
        post_queue = api.get(f"/api/children/{child_id}/learning-daily-queue").json()
        assert post_queue["newLesson"] is None
        assert post_queue["currentLessonComplete"] is True
        assert post_queue["completedLesson"]["lessonId"] == "book1-l01"
        assert post_queue["completedLesson"]["title"] == "你好"
        assert post_queue["nextLessonComingSoon"] is True
        assert post_queue["nextAccessibleLesson"]["lessonId"] == "book1-l02"
        assert post_queue["nextAccessibleLesson"]["availableInLearningFlowV1"] is False

        # Attempting to start a new session when lesson is mastered and no reviews are due returns 409 Conflict
        start_attempt = api.post(f"/api/children/{child_id}/learning-sessions", json={})
        assert start_attempt.status_code == 409
        assert "no_eligible_learning_tasks" in start_attempt.text
