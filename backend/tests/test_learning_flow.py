import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def client(tmp_path: Path, raise_server_exceptions: bool = True):
    import os
    os.environ["TONGXUAN_ENV"] = "development"
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "learning-flow.sqlite3")
    from app.main import app
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


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


def complete_session(api: TestClient, child_id: int, current: dict, assisted_scores: bool = False, skip_writing: bool = False, finalize: bool = True) -> dict:
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
            response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json={"evidence_ref": attempt["id"], "duration_ms": 500})
            assert response.status_code == 200, response.text
        elif task["taskType"] in {"SPEAKING_ATTEMPT", "PRONUNCIATION_ATTEMPT"}:
            domain = "pronunciation" if task["taskType"] == "PRONUNCIATION_ATTEMPT" else "speaking"
            attempt = api.post("/api/reading-aloud/attempts/start?child_id=" + str(child_id), json={"text": task["taskData"]["text"], "text_kind": task["taskData"].get("textKind", "character"), "locale": "zh-TW", "source_type": task["taskData"].get("sourceType", "CURRICULUM"), "source_id": task["itemId"], "activity_domain": domain})
            assert attempt.status_code == 200, attempt.text
            attempt_id = attempt.json()["id"]
            response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json={"evidence_ref": attempt_id, "duration_ms": 500})
            assert response.status_code == 200, response.text
        elif task["taskType"] in {"RECOGNITION", "REVIEW_RECOGNITION", "MINI_CHECK", "VOCABULARY", "SENTENCE_PATTERN"}:
            if task["taskData"].get("mode") == "reflection":
                selected = next((option["id"] for option in task["taskData"]["choices"] if option["id"] == "practiced"), task["taskData"]["choices"][0]["id"])
            elif task["taskType"] == "VOCABULARY":
                selected = next(option["id"] for option in task["taskData"]["choices"] if option["id"] in {"greeting", "opt-hello", "age-seven", "family-parents", "younger-sister"} or "打招呼" in option["label"])
            elif task["taskType"] == "SENTENCE_PATTERN":
                selected = next(option["id"] for option in task["taskData"]["choices"] if option["id"] in {"greeting", "opt-correct-order", "has-dog"} or option.get("isCorrect"))
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
    if not finalize:
        return current
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


def test_each_supported_lesson_planner_task_set_reaches_authoritative_settlement(tmp_path):
    """Exercise actual planner output, not a client-shaped approximation."""
    with client(tmp_path) as api:
        for placement, lesson_id, writing_level in (
            ("STARTER", "starter-l01", None),
            ("BASIC", "basic-l01", None),
            ("BOOK_1", "book1-l01", None),
            # The same official lesson can also include a real optional task
            # when the placement profile makes writing a targeted gap.
            ("BOOK_1", "book1-l01", "BASIC"),
        ):
            child_id = child(api, lesson_id)
            place(child_id, placement, writing=writing_level)
            planned = session(api, child_id)

            assert planned["curriculumContext"]["lessonId"] == lesson_id
            assert planned["status"] == "IN_PROGRESS"
            assert planned["tasks"]
            assert not any(task["sourceQueue"] == "REVIEW" for task in planned["tasks"])
            assert len({task["id"] for task in planned["tasks"]}) == len(planned["tasks"])
            assert any(task["taskType"] == "LESSON_WRAP_UP" for task in planned["tasks"])

            # `complete_session` walks the real plan and submits each exact task
            # through its authoritative answer/evidence/skip endpoint before
            # asking the session settlement endpoint to commit.
            settled = complete_session(api, child_id, planned)
            final_by_id = {task["id"]: task for task in settled["tasks"]}
            assert settled["status"] == "COMPLETED"
            assert set(final_by_id) == {task["id"] for task in planned["tasks"]}
            assert all(
                final_by_id[task["id"]]["state"] in {"COMPLETED", "DEFERRED"}
                for task in planned["tasks"]
                if task["required"]
            )
            assert final_by_id[next(task["id"] for task in planned["tasks"] if task["taskType"] == "LESSON_WRAP_UP")]["state"] == "COMPLETED"


def test_starter_l02_unlocks_after_l01_and_settles_exact_child_scoped_authored_tasks(tmp_path):
    from app.database import connect

    with client(tmp_path) as api:
        child_id = child(api, "Starter L2 learner")
        sibling_id = child(api, "Sibling")
        place(child_id, "STARTER")
        place(sibling_id, "STARTER")

        before = api.get(f"/api/children/{child_id}/learning-daily-queue").json()
        assert before["newLesson"]["lessonId"] == "starter-l01"
        curriculum = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        starter_stage = next(stage for stage in curriculum["stages"] if stage["id"] == "starter")
        lesson2 = next(lesson for lesson in starter_stage["lessons"] if lesson["id"] == "starter-l02")
        assert lesson2["accessible"] is False
        locked = api.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"lesson_id": "starter-l02", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert locked.status_code == 409 and locked.json()["detail"] == "prerequisite_not_mastered"

        starter_l01 = session(api, child_id)
        completed_l01 = complete_session(api, child_id, starter_l01)
        assert completed_l01["status"] == "COMPLETED"
        queue = api.get(f"/api/children/{child_id}/learning-daily-queue").json()
        assert queue["newLesson"]["lessonId"] == "starter-l02"
        assert queue["newLesson"]["availableInLearningFlowV1"] is True
        assert queue["currentLessonComplete"] is False
        after_curriculum = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        lesson2 = next(lesson for stage in after_curriculum["stages"] for lesson in stage["lessons"] if lesson["id"] == "starter-l02")
        assert lesson2["accessible"] is True

        started = api.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"lesson_id": "starter-l02", "target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-20T08:00:00Z"},
        )
        assert started.status_code == 200, started.text
        planned = started.json()
        assert planned["childId"] == child_id
        assert planned["curriculumContext"]["lessonId"] == "starter-l02"
        assert planned["curriculumContext"]["official"]["title"] == "我七歲"
        assert planned["curriculumContext"]["tongxuan"]["authorship"] == "TONGXUAN_AUTHORED_PRACTICE"
        by_key = {task["key"]: task for task in planned["tasks"]}
        assert set(by_key) == {"listen", "vocabulary", "phonetics", "speaking", "mini-check-reflection", "wrap-up"}
        assert all(task["id"] == f"{planned['id']}:{task['key']}" for task in planned["tasks"])
        assert all(task["lessonId"] == "starter-l02" and task["taskData"]["authorship"] == "TONGXUAN_AUTHORED_PRACTICE" for task in planned["tasks"])
        assert by_key["listen"]["itemId"] == f"lf_{child_id}_starter-l02_phrase"
        assert by_key["vocabulary"]["itemId"] == f"lf_{child_id}_starter-l02_vocabulary"
        assert by_key["vocabulary"]["taskData"]["wordText"] == "七歲"
        assert by_key["vocabulary"]["taskData"]["choices"] == [
            {"id": "age-seven", "label": "我今年七歲。"},
            {"id": "age-eight", "label": "我今年八歲。"},
        ]
        phonetic_questions = by_key["phonetics"]["taskData"]["questions"]
        assert {(question["character"], question["script"]) for question in phonetic_questions} == {
            (character, script) for character in ("我", "七") for script in ("TRADITIONAL", "SIMPLIFIED")
        }
        assert by_key["speaking"]["taskData"]["text"] == "我今年七歲。"
        assert by_key["speaking"]["itemId"] == f"lf_{child_id}_starter-l02_sentence"
        assert by_key["speaking"]["taskData"]["sourceType"] == "SENTENCE"
        assert by_key["speaking"]["taskData"]["textKind"] == "sentence"

        with connect() as db:
            assert db.execute("SELECT 1 FROM learning_items WHERE id=? AND child_id=?", (by_key["listen"]["itemId"], child_id)).fetchone()
            assert db.execute("SELECT 1 FROM learning_items WHERE id=? AND child_id=?", (by_key["listen"]["itemId"], sibling_id)).fetchone() is None
            linked_readings = db.execute(
                "SELECT item_id FROM curriculum_item_links WHERE child_id=? AND lesson_id='starter-l02' AND skill_domain='phonetics' ORDER BY item_id",
                (child_id,),
            ).fetchall()
            assert len(linked_readings) == 4
            assert all(row["item_id"].startswith(f"lf_{child_id}_starter-l02_reading_") for row in linked_readings)
            sentence = db.execute("SELECT sentence,source_name,provenance_status,commercial_ready FROM sentences WHERE id=? AND child_id=?", (by_key["speaking"]["itemId"], child_id)).fetchone()
            assert sentence and sentence["sentence"] == "我今年七歲。"
            assert sentence["source_name"] == "TONGXUAN_AUTHORED_PRACTICE · starter-l02"
            assert sentence["provenance_status"] == "TONGXUAN_AUTHORED_INTERNAL_DRAFT" and sentence["commercial_ready"] == 0
            assert db.execute("SELECT 1 FROM curriculum_item_links WHERE child_id=? AND lesson_id='starter-l02' AND skill_domain='speaking' AND item_id=?", (child_id, by_key["speaking"]["itemId"])).fetchone()
            assert db.execute("SELECT 1 FROM sentences WHERE id=? AND child_id=?", (by_key["speaking"]["itemId"], sibling_id)).fetchone() is None
            assert db.execute("SELECT 1 FROM learning_flow_sessions WHERE child_id=? AND lesson_id='starter-l02'", (sibling_id,)).fetchone() is None

        sibling_queue = api.get(f"/api/children/{sibling_id}/learning-daily-queue").json()
        assert sibling_queue["newLesson"]["lessonId"] == "starter-l01"
        sibling_locked = api.post(
            f"/api/children/{sibling_id}/learning-sessions",
            json={"lesson_id": "starter-l02", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert sibling_locked.status_code == 409

        settled = complete_session(api, child_id, planned)
        assert settled["status"] == "COMPLETED"
        assert settled["assessment"]["status"] == "MASTERED"
        assert settled["reward"]["points"] == 5
        with connect() as db:
            l02_srs = db.execute(
                "SELECT skill_domain,item_id,stage FROM srs_review_states WHERE child_id=? AND item_id IN (SELECT item_id FROM curriculum_item_links WHERE child_id=? AND lesson_id='starter-l02') ORDER BY skill_domain,item_id",
                (child_id, child_id),
            ).fetchall()
            assert [tuple(row) for row in l02_srs] == [("word", f"lf_{child_id}_starter-l02_vocabulary", 1)]
            assert db.execute("SELECT 1 FROM srs_review_states WHERE child_id=? AND item_id LIKE 'lf_%_starter-l02_%'", (sibling_id,)).fetchone() is None
        finished_queue = api.get(f"/api/children/{child_id}/learning-daily-queue", params={"as_of": "2099-01-01T00:00:00Z"}).json()
        assert finished_queue["newLesson"]["lessonId"] == "starter-l03"
        assert finished_queue["completedLesson"]["lessonId"] == "starter-l02"
        assert finished_queue["currentLessonComplete"] is False


def test_starter_l03_unlocks_after_l02_and_settles_original_authored_tasks_exactly(tmp_path):
    from app.database import connect

    with client(tmp_path) as api:
        learner = child(api, "Starter L3 learner")
        sibling = child(api, "Starter L3 sibling")
        place(learner, "STARTER")
        place(sibling, "STARTER")

        assert api.get(f"/api/children/{learner}/learning-daily-queue").json()["newLesson"]["lessonId"] == "starter-l01"
        complete_session(api, learner, session(api, learner))
        assert api.get(f"/api/children/{learner}/learning-daily-queue").json()["newLesson"]["lessonId"] == "starter-l02"
        locked_l03 = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l03", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert locked_l03.status_code == 409 and locked_l03.json()["detail"] == "prerequisite_not_mastered"
        complete_session(api, learner, api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l02", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        ).json())

        queue = api.get(f"/api/children/{learner}/learning-daily-queue").json()
        assert queue["newLesson"]["lessonId"] == "starter-l03"
        curriculum = api.get(f"/api/children/{learner}/validated-curriculum").json()
        starter_l03 = next(lesson for stage in curriculum["stages"] for lesson in stage["lessons"] if lesson["id"] == "starter-l03")
        assert starter_l03["accessible"] is True
        sibling_queue = api.get(f"/api/children/{sibling}/learning-daily-queue").json()
        assert sibling_queue["newLesson"]["lessonId"] == "starter-l01"

        planned_response = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l03", "target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-20T08:00:00Z"},
        )
        assert planned_response.status_code == 200, planned_response.text
        planned = planned_response.json()
        by_key = {task["key"]: task for task in planned["tasks"]}
        assert planned["childId"] == learner
        assert planned["curriculumContext"]["lessonId"] == "starter-l03"
        assert planned["curriculumContext"]["official"]["title"] == "爸爸媽媽"
        assert planned["curriculumContext"]["tongxuan"]["authorship"] == "TONGXUAN_AUTHORED_PRACTICE"
        assert set(by_key) == {"listen", "vocabulary", "phonetics", "speaking", "mini-check-reflection", "wrap-up"}
        assert all(task["id"] == f"{planned['id']}:{task['key']}" for task in planned["tasks"])
        assert all(task["lessonId"] == "starter-l03" and task["taskData"]["authorship"] == "TONGXUAN_AUTHORED_PRACTICE" for task in planned["tasks"])
        assert by_key["listen"]["itemId"] == f"lf_{learner}_starter-l03_phrase"
        assert by_key["listen"]["taskData"]["text"] == "我有爸爸媽媽。"
        assert by_key["vocabulary"]["itemId"] == f"lf_{learner}_starter-l03_vocabulary"
        assert by_key["vocabulary"]["taskData"]["wordText"] == "爸爸媽媽"
        assert by_key["vocabulary"]["taskData"]["choices"] == [
            {"id": "family-parents", "label": "父親和母親"},
            {"id": "family-friends", "label": "朋友和同學"},
        ]
        assert {(question["character"], question["script"]) for question in by_key["phonetics"]["taskData"]["questions"]} == {
            (character, script) for character in ("爸", "媽") for script in ("TRADITIONAL", "SIMPLIFIED")
        }
        assert by_key["speaking"]["itemId"] == f"lf_{learner}_starter-l03_sentence"
        assert by_key["speaking"]["taskData"]["text"] == "我有爸爸媽媽。"
        assert by_key["speaking"]["taskData"]["sourceType"] == "SENTENCE"
        assert by_key["speaking"]["taskData"]["textKind"] == "sentence"

        with connect() as db:
            sentence = db.execute(
                "SELECT child_id,sentence,source_name,provenance_status,commercial_ready FROM sentences WHERE id=?",
                (by_key["speaking"]["itemId"],),
            ).fetchone()
            assert sentence and tuple(sentence) == (
                learner, "我有爸爸媽媽。", "TONGXUAN_AUTHORED_PRACTICE · starter-l03",
                "TONGXUAN_AUTHORED_INTERNAL_DRAFT", 0,
            )
            assert db.execute(
                "SELECT 1 FROM curriculum_item_links WHERE child_id=? AND lesson_id='starter-l03' AND skill_domain='vocabulary' AND item_id=?",
                (learner, by_key["vocabulary"]["itemId"]),
            ).fetchone()
            assert db.execute("SELECT 1 FROM sentences WHERE child_id=? AND id=?", (sibling, by_key["speaking"]["itemId"])).fetchone() is None

        locked_sibling = api.post(
            f"/api/children/{sibling}/learning-sessions",
            json={"lesson_id": "starter-l03", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert locked_sibling.status_code == 409 and locked_sibling.json()["detail"] == "prerequisite_not_mastered"

        settled = complete_session(api, learner, planned)
        assert settled["status"] == "COMPLETED"
        assert settled["assessment"]["status"] == "MASTERED"
        assert settled["reward"]["points"] == 5
        with connect() as db:
            srs = db.execute(
                "SELECT skill_domain,item_id,stage FROM srs_review_states WHERE child_id=? AND item_id=?",
                (learner, by_key["vocabulary"]["itemId"]),
            ).fetchone()
            assert srs and tuple(srs) == ("word", by_key["vocabulary"]["itemId"], 1)
            assert db.execute("SELECT 1 FROM srs_review_states WHERE child_id=? AND item_id LIKE 'lf_%_starter-l03_%'", (sibling,)).fetchone() is None
        finished_queue = api.get(f"/api/children/{learner}/learning-daily-queue", params={"as_of": "2099-01-01T00:00:00Z"}).json()
        assert finished_queue["completedLesson"]["lessonId"] == "starter-l03"
        assert finished_queue["newLesson"]["lessonId"] == "starter-l04"


def test_starter_l03_authored_word_reconciles_and_advances_exact_srs_during_active_learn(tmp_path):
    from app.database import connect

    with client(tmp_path) as api:
        learner = child(api, "Starter L3 review learner")
        place(learner, "STARTER")
        complete_session(api, learner, session(api, learner))
        complete_session(api, learner, api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l02", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        ).json())
        current = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l03", "target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-20T08:00:00Z"},
        ).json()
        vocabulary = next(task for task in current["tasks"] if task["key"] == "vocabulary")
        current = start_task(api, learner, current, vocabulary)
        current = answer_task(api, learner, current, vocabulary, "family-parents")
        item_id = vocabulary["itemId"]
        with connect() as db:
            srs_before = db.execute(
                "SELECT skill_domain,item_id,stage FROM srs_review_states WHERE child_id=? AND item_id=?",
                (learner, item_id),
            ).fetchone()
            assert srs_before and tuple(srs_before) == ("word", item_id, 1)
            db.execute(
                "UPDATE srs_review_states SET due_at='2026-09-20 07:00:00' WHERE child_id=? AND skill_domain='word' AND item_id=?",
                (learner, item_id),
            )

        queue = api.get(
            f"/api/children/{learner}/learning-daily-queue",
            params={"as_of": "2026-09-20T08:00:00Z"},
        ).json()
        due_words = [item for item in queue["review"]["items"] if item["skillDomain"] == "word"]
        assert [(item["id"], item["lessonId"], item["word"]) for item in due_words] == [(item_id, "starter-l03", "爸爸媽媽")]
        reconciled = api.post(
            f"/api/children/{learner}/learning-sessions/{current['id']}/reconcile-reviews",
            json={"as_of": "2026-09-20T08:00:00Z"},
        )
        assert reconciled.status_code == 200, reconciled.text
        current = reconciled.json()
        review = next(task for task in current["tasks"] if task["sourceQueue"] == "REVIEW" and task["skillDomain"] == "word")
        assert review["id"] == f"{current['id']}:{review['key']}"
        assert review["taskType"] == "REVIEW_VOCABULARY"
        assert review["lessonId"] == "starter-l03" and review["itemId"] == item_id
        assert review["taskData"]["word"] == "爸爸媽媽"
        assert {choice["id"] for choice in review["taskData"]["choices"]} == {"family-parents", "family-friends"}
        pending_curriculum = {task["id"]: task["state"] for task in current["tasks"] if task["sourceQueue"] == "CURRICULUM"}
        current = answer_task(api, learner, current, review, "family-parents")
        final = {task["id"]: task for task in current["tasks"]}
        assert current["status"] == "IN_PROGRESS"
        assert final[review["id"]]["state"] == "COMPLETED"
        assert {task_id: final[task_id]["state"] for task_id in pending_curriculum} == pending_curriculum
        with connect() as db:
            srs_after = db.execute(
                "SELECT skill_domain,item_id,stage,last_result,due_at FROM srs_review_states WHERE child_id=? AND item_id=?",
                (learner, item_id),
            ).fetchone()
        assert srs_after["skill_domain"] == "word" and srs_after["item_id"] == item_id
        assert srs_after["stage"] == 2 and srs_after["last_result"] == "correct"
        assert srs_after["due_at"] > "2026-09-20 08:00:00"


def test_starter_l04_unlocks_after_l03_and_settles_exact_original_authored_plan(tmp_path):
    from app.database import connect

    with client(tmp_path) as api:
        learner = child(api, "Starter L4 learner")
        sibling = child(api, "Starter L4 sibling")
        place(learner, "STARTER")
        place(sibling, "STARTER")
        for lesson_id in ("starter-l01", "starter-l02", "starter-l03"):
            current = api.post(
                f"/api/children/{learner}/learning-sessions",
                json={"lesson_id": lesson_id, "target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-20T08:00:00Z"},
            )
            assert current.status_code == 200, current.text
            complete_session(api, learner, current.json())

        assert api.get(f"/api/children/{learner}/learning-daily-queue").json()["newLesson"]["lessonId"] == "starter-l04"
        curriculum = api.get(f"/api/children/{learner}/validated-curriculum").json()
        l04 = next(lesson for stage in curriculum["stages"] for lesson in stage["lessons"] if lesson["id"] == "starter-l04")
        assert l04["accessible"] is True
        assert l04["prerequisiteLessonId"] == "starter-l03"
        assert l04["official"]["source"]["licenseStatus"] == "PERMISSION_REQUIRED"
        assert l04["official"]["source"]["commercialReady"] is False
        assert l04["tongxuan"]["domains"] == ["listening", "speaking", "phonetics", "recognition"]

        blocked_sibling = api.post(
            f"/api/children/{sibling}/learning-sessions",
            json={"lesson_id": "starter-l04", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert blocked_sibling.status_code == 409 and blocked_sibling.json()["detail"] == "prerequisite_not_mastered"
        assert api.get(f"/api/children/{sibling}/learning-daily-queue").json()["newLesson"]["lessonId"] == "starter-l01"

        started = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l04", "target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-20T08:00:00Z"},
        )
        assert started.status_code == 200, started.text
        planned = started.json()
        by_key = {task["key"]: task for task in planned["tasks"]}
        assert planned["childId"] == learner and planned["curriculumContext"]["lessonId"] == "starter-l04"
        assert planned["curriculumContext"]["official"]["title"] == "小狗"
        assert planned["curriculumContext"]["tongxuan"]["authorship"] == "TONGXUAN_AUTHORED_PRACTICE"
        assert set(by_key) == {"listen", "recognition-1", "recognition-2", "sentence-pattern", "phonetics", "speaking", "mini-check-reflection", "wrap-up"}
        assert all(task["id"] == f"{planned['id']}:{task['key']}" for task in planned["tasks"])
        assert all(task["lessonId"] == "starter-l04" and task["taskData"]["authorship"] == "TONGXUAN_AUTHORED_PRACTICE" for task in planned["tasks"])
        assert by_key["listen"]["itemId"] == f"lf_{learner}_starter-l04_phrase"
        assert by_key["listen"]["taskData"]["text"] == "我有一隻小狗。"
        assert by_key["listen"]["taskData"]["textKind"] == "sentence"
        assert [by_key[f"recognition-{index}"]["itemId"] for index in (1, 2)] == [
            f"lf_{learner}_starter-l04_char_1", f"lf_{learner}_starter-l04_char_2",
        ]
        assert [by_key[f"recognition-{index}"]["taskData"]["audioText"] for index in (1, 2)] == ["小", "狗"]
        assert by_key["sentence-pattern"]["skillDomain"] is None
        assert by_key["sentence-pattern"]["masteryImpact"] == "NONE"
        assert by_key["sentence-pattern"]["taskData"]["choices"] == [
            {"id": "has-dog", "label": "我有一隻小狗。"},
            {"id": "dog-has-me", "label": "小狗有一隻我。"},
        ]
        phonetics = by_key["phonetics"]["taskData"]["questions"]
        assert {(question["character"], question["script"]) for question in phonetics} == {
            (character, script) for character in ("小", "狗") for script in ("TRADITIONAL", "SIMPLIFIED")
        }
        assert by_key["speaking"]["itemId"] == f"lf_{learner}_starter-l04_sentence"
        assert by_key["speaking"]["taskData"]["text"] == "我有一隻小狗。"
        assert by_key["speaking"]["taskData"]["sourceType"] == "SENTENCE"
        assert by_key["speaking"]["taskData"]["textKind"] == "sentence"
        assert all(task["taskType"] != "VOCABULARY" for task in planned["tasks"])

        with connect() as db:
            sentence = db.execute(
                "SELECT child_id,sentence,source_name,provenance_status,commercial_ready FROM sentences WHERE id=?",
                (by_key["speaking"]["itemId"],),
            ).fetchone()
            assert sentence and tuple(sentence) == (
                learner, "我有一隻小狗。", "TONGXUAN_AUTHORED_PRACTICE · starter-l04",
                "TONGXUAN_AUTHORED_INTERNAL_DRAFT", 0,
            )
            assert db.execute(
                "SELECT 1 FROM curriculum_item_links WHERE child_id=? AND lesson_id='starter-l04' AND skill_domain='vocabulary'",
                (learner,),
            ).fetchone() is None
            assert db.execute("SELECT 1 FROM sentences WHERE child_id=? AND id=?", (sibling, by_key["speaking"]["itemId"])).fetchone() is None

        settled = complete_session(api, learner, planned)
        assert settled["status"] == "COMPLETED"
        assert settled["assessment"]["status"] == "MASTERED"
        assert settled["reward"]["points"] == 5
        with connect() as db:
            recognition_srs = db.execute(
                "SELECT skill_domain,item_id FROM srs_review_states WHERE child_id=? AND skill_domain='recognition' AND item_id IN (?,?)",
                (learner, by_key["recognition-1"]["itemId"], by_key["recognition-2"]["itemId"]),
            ).fetchall()
            assert {(row["skill_domain"], row["item_id"]) for row in recognition_srs} == {
                ("recognition", by_key["recognition-1"]["itemId"]),
                ("recognition", by_key["recognition-2"]["itemId"]),
            }
            assert db.execute(
                "SELECT 1 FROM srs_review_states WHERE child_id=? AND skill_domain='word' AND item_id LIKE 'lf_%_starter-l04_%'",
                (learner,),
            ).fetchone() is None
            assert db.execute(
                "SELECT 1 FROM srs_review_states WHERE child_id=? AND item_id LIKE 'lf_%_starter-l04_%'",
                (sibling,),
            ).fetchone() is None
        finished_queue = api.get(f"/api/children/{learner}/learning-daily-queue", params={"as_of": "2099-01-01T00:00:00Z"}).json()
        assert finished_queue["completedLesson"]["lessonId"] == "starter-l04"
        assert finished_queue["newLesson"]["lessonId"] == "starter-l05"
        assert finished_queue["newLesson"]["title"] == "我的妹妹"


def test_starter_l05_unlocks_after_l04_settles_exact_package_and_reconciles_exact_word_srs(tmp_path):
    from app.database import connect

    with client(tmp_path) as api:
        learner = child(api, "Starter L5 learner")
        sibling = child(api, "Starter L5 sibling")
        place(learner, "STARTER")
        place(sibling, "STARTER")
        for lesson_id in ("starter-l01", "starter-l02", "starter-l03"):
            response = api.post(
                f"/api/children/{learner}/learning-sessions",
                json={"lesson_id": lesson_id, "target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-19T08:00:00Z"},
            )
            assert response.status_code == 200, response.text
            complete_session(api, learner, response.json())

        before_l04_queue = api.get(f"/api/children/{learner}/learning-daily-queue").json()
        assert before_l04_queue["newLesson"]["lessonId"] == "starter-l04"
        blocked_before_l04 = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l05", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert blocked_before_l04.status_code == 409 and blocked_before_l04.json()["detail"] == "prerequisite_not_mastered"
        with connect() as db:
            assert db.execute("SELECT 1 FROM learning_flow_sessions WHERE child_id=? AND lesson_id='starter-l05'", (learner,)).fetchone() is None

        l04 = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l04", "target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-19T08:00:00Z"},
        )
        assert l04.status_code == 200, l04.text
        complete_session(api, learner, l04.json())
        queue = api.get(f"/api/children/{learner}/learning-daily-queue").json()
        assert queue["newLesson"]["lessonId"] == "starter-l05"
        assert queue["newLesson"]["title"] == "我的妹妹"
        curriculum = api.get(f"/api/children/{learner}/validated-curriculum").json()
        l05 = next(lesson for stage in curriculum["stages"] for lesson in stage["lessons"] if lesson["id"] == "starter-l05")
        assert l05["accessible"] is True and l05["prerequisiteLessonId"] == "starter-l04"
        assert l05["official"]["source"]["licenseStatus"] == "PERMISSION_REQUIRED"
        assert l05["official"]["source"]["commercialReady"] is False
        assert l05["tongxuan"]["domains"] == ["listening", "speaking", "phonetics", "vocabulary"]

        blocked = api.post(
            f"/api/children/{sibling}/learning-sessions",
            json={"lesson_id": "starter-l05", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert blocked.status_code == 409 and blocked.json()["detail"] == "prerequisite_not_mastered"
        assert api.get(f"/api/children/{sibling}/learning-daily-queue").json()["newLesson"]["lessonId"] == "starter-l01"

        with connect() as db:
            # Keep prior Starter word rows out of this review queue so the assertion
            # isolates the exact L5 vocabulary SRS identity.
            db.execute("UPDATE srs_review_states SET due_at='2999-01-01 00:00:00' WHERE child_id=? AND skill_domain='word'", (learner,))
        started = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l05", "target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-19T08:00:00Z"},
        )
        assert started.status_code == 200, started.text
        current = started.json()
        by_key = {task["key"]: task for task in current["tasks"]}
        assert current["childId"] == learner and current["curriculumContext"]["lessonId"] == "starter-l05"
        assert current["curriculumContext"]["official"]["title"] == "我的妹妹"
        assert current["curriculumContext"]["official"]["source"]["licenseStatus"] == "PERMISSION_REQUIRED"
        assert set(by_key) == {"listen", "vocabulary", "phonetics", "speaking", "mini-check-reflection", "wrap-up"}
        assert all(task["id"] == f"{current['id']}:{task['key']}" for task in current["tasks"])
        assert all(task["lessonId"] == "starter-l05" and task["childId"] == learner for task in current["tasks"])
        assert all(task["taskData"]["authorship"] == "TONGXUAN_AUTHORED_PRACTICE" for task in current["tasks"])
        assert by_key["listen"]["itemId"] == f"lf_{learner}_starter-l05_phrase"
        assert by_key["listen"]["taskData"]["text"] == "我有一個妹妹。"
        assert by_key["listen"]["taskData"]["textKind"] == "sentence"
        assert by_key["vocabulary"]["itemId"] == f"lf_{learner}_starter-l05_vocabulary"
        assert by_key["vocabulary"]["taskData"]["wordText"] == "妹妹"
        assert by_key["vocabulary"]["taskData"]["exampleSentence"] == "我有一個妹妹。"
        assert by_key["speaking"]["itemId"] == f"lf_{learner}_starter-l05_sentence"
        assert by_key["speaking"]["taskData"]["text"] == "我有一個妹妹。"
        assert by_key["phonetics"]["itemId"] is None
        assert {(question["character"], question["script"]) for question in by_key["phonetics"]["taskData"]["questions"]} == {
            ("妹", "TRADITIONAL"), ("妹", "SIMPLIFIED"),
        }
        with connect() as db:
            sentence = db.execute(
                "SELECT child_id,sentence,source_name,provenance_status,commercial_ready FROM sentences WHERE id=?",
                (by_key["speaking"]["itemId"],),
            ).fetchone()
            assert sentence and tuple(sentence) == (
                learner, "我有一個妹妹。", "TONGXUAN_AUTHORED_PRACTICE · starter-l05",
                "TONGXUAN_AUTHORED_INTERNAL_DRAFT", 0,
            )
            assert db.execute(
                "SELECT 1 FROM curriculum_item_links WHERE child_id=? AND skill_domain='vocabulary' AND item_id=? AND lesson_id='starter-l05'",
                (learner, by_key["vocabulary"]["itemId"]),
            ).fetchone()
            assert db.execute("SELECT 1 FROM sentences WHERE child_id=? AND id=?", (sibling, by_key["speaking"]["itemId"])).fetchone() is None
            assert db.execute("SELECT 1 FROM srs_review_states WHERE child_id=? AND item_id=?", (sibling, by_key["vocabulary"]["itemId"])).fetchone() is None

        current = start_task(api, learner, current, by_key["listen"])
        listen_attempt = api.post(f"/api/children/{learner}/listening-attempts", json={"item_id": by_key["listen"]["itemId"]}).json()
        listened = api.post(
            f"/api/children/{learner}/learning-sessions/{current['id']}/tasks/{by_key['listen']['id']}/evidence",
            json={"evidence_ref": listen_attempt["id"], "duration_ms": 500},
        )
        assert listened.status_code == 200, listened.text
        current = api.get(f"/api/children/{learner}/learning-sessions/{current['id']}").json()
        vocabulary_task = next(task for task in current["tasks"] if task["key"] == "vocabulary")
        current = start_task(api, learner, current, vocabulary_task)
        current = answer_task(api, learner, current, vocabulary_task, "younger-sister")

        due_at = "2026-09-19 07:00:00"
        with connect() as db:
            db.execute(
                "UPDATE srs_review_states SET due_at=? WHERE child_id=? AND skill_domain='word' AND item_id=?",
                (due_at, learner, vocabulary_task["itemId"]),
            )
            before_rows = [tuple(row) for row in db.execute(
                "SELECT skill_domain,item_id,stage,last_result,due_at FROM srs_review_states WHERE child_id=? AND skill_domain='word' ORDER BY item_id",
                (learner,),
            ).fetchall()]
            before_l05_evidence = db.execute(
                "SELECT COUNT(*) FROM curriculum_skill_evidence WHERE child_id=? AND lesson_id='starter-l05' AND skill_domain='vocabulary'",
                (learner,),
            ).fetchone()[0]
        daily = api.get(
            f"/api/children/{learner}/learning-daily-queue",
            params={"as_of": "2026-09-19T08:00:00Z"},
        ).json()
        assert daily["review"]["items"] == [{
            "id": vocabulary_task["itemId"], "skillDomain": "word", "character": None, "scriptMode": None,
            "word": "妹妹", "lessonId": "starter-l05", "dueAt": due_at,
        }]
        reconciled = api.post(
            f"/api/children/{learner}/learning-sessions/{current['id']}/reconcile-reviews",
            json={"as_of": "2026-09-19T08:00:00Z"},
        )
        assert reconciled.status_code == 200, reconciled.text
        current = reconciled.json()
        reviews = [task for task in current["tasks"] if task["sourceQueue"] == "REVIEW"]
        assert len(reviews) == 1
        review = reviews[0]
        assert review["id"] == f"{current['id']}:{review['key']}"
        assert review["taskType"] == "REVIEW_VOCABULARY" and review["masteryImpact"] == "NONE"
        assert review["childId"] == learner and review["lessonId"] == "starter-l05"
        assert review["itemId"] == vocabulary_task["itemId"]
        assert review["taskData"]["word"] == "妹妹"
        assert {choice["id"] for choice in review["taskData"]["choices"]} == {"younger-sister", "older-sister"}

        current = start_task(api, learner, current, review)
        current = answer_task(api, learner, current, review, "younger-sister")
        review_state = next(task for task in current["tasks"] if task["id"] == review["id"])
        pending_curriculum = next(task for task in current["tasks"] if task["key"] == "phonetics")
        assert current["status"] == "IN_PROGRESS" and review_state["state"] == "COMPLETED"
        assert pending_curriculum["state"] == "PENDING"
        with connect() as db:
            after_rows = [tuple(row) for row in db.execute(
                "SELECT skill_domain,item_id,stage,last_result,due_at FROM srs_review_states WHERE child_id=? AND skill_domain='word' ORDER BY item_id",
                (learner,),
            ).fetchall()]
            after_l05_evidence = db.execute(
                "SELECT COUNT(*) FROM curriculum_skill_evidence WHERE child_id=? AND lesson_id='starter-l05' AND skill_domain='vocabulary'",
                (learner,),
            ).fetchone()[0]
        before_by_item = {row[1]: row for row in before_rows}
        after_by_item = {row[1]: row for row in after_rows}
        exact_l05_row = after_by_item[vocabulary_task["itemId"]]
        assert exact_l05_row[2] == 2 and exact_l05_row[3] == "correct" and exact_l05_row[4] > due_at
        assert {item: row for item, row in after_by_item.items() if item != vocabulary_task["itemId"]} == {
            item: row for item, row in before_by_item.items() if item != vocabulary_task["itemId"]
        }
        assert after_l05_evidence == before_l05_evidence

        settled = complete_session(api, learner, current)
        assert settled["status"] == "COMPLETED" and settled["assessment"]["status"] == "MASTERED"
        assert settled["reward"]["points"] == 5
        final_queue = api.get(f"/api/children/{learner}/learning-daily-queue", params={"as_of": "2099-01-01T00:00:00Z"}).json()
        assert final_queue["completedLesson"]["lessonId"] == "starter-l05"
        assert final_queue["newLesson"] is None


def test_starter_l05_malformed_package_fails_closed_before_material_session_or_tasks(tmp_path, monkeypatch):
    import copy
    from app import learning_flow
    from app.database import connect

    with client(tmp_path) as api:
        learner = child(api, "Starter L5 malformed package")
        place(learner, "STARTER")
        for lesson_id in ("starter-l01", "starter-l02", "starter-l03", "starter-l04"):
            current = api.post(
                f"/api/children/{learner}/learning-sessions",
                json={"lesson_id": lesson_id, "target_minutes": 18, "script_mode": "TRADITIONAL"},
            ).json()
            complete_session(api, learner, current)

        original = learning_flow.get_lesson_package
        broken = copy.deepcopy(original("starter-l05"))
        broken["vocabulary"][0]["id"] = "unrelated-word"
        monkeypatch.setattr(learning_flow, "get_lesson_package", lambda lesson_id: broken if lesson_id == "starter-l05" else original(lesson_id))
        response = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l05", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert response.status_code == 400 and response.json()["detail"] == "learning_flow_starter_l05_package_invalid"
        with connect() as db:
            assert db.execute("SELECT 1 FROM learning_flow_sessions WHERE child_id=? AND lesson_id='starter-l05'", (learner,)).fetchone() is None
            assert db.execute("SELECT 1 FROM learning_flow_tasks WHERE child_id=? AND lesson_id='starter-l05'", (learner,)).fetchone() is None
            assert db.execute("SELECT 1 FROM sentences WHERE child_id=? AND source_name='TONGXUAN_AUTHORED_PRACTICE · starter-l05'", (learner,)).fetchone() is None


def test_starter_l04_fails_closed_when_authored_package_license_is_changed(tmp_path, monkeypatch):
    import copy
    from app import learning_flow

    with client(tmp_path) as api:
        learner = child(api, "Starter L4 malformed package")
        place(learner, "STARTER")
        for lesson_id in ("starter-l01", "starter-l02", "starter-l03"):
            complete_session(api, learner, api.post(
                f"/api/children/{learner}/learning-sessions",
                json={"lesson_id": lesson_id, "target_minutes": 18, "script_mode": "TRADITIONAL"},
            ).json())
        original = learning_flow.get_lesson_package
        broken = copy.deepcopy(original("starter-l04"))
        broken["curriculumSource"]["commercialReady"] = True
        monkeypatch.setattr(learning_flow, "get_lesson_package", lambda lesson_id: broken if lesson_id == "starter-l04" else original(lesson_id))
        response = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l04", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "learning_flow_starter_l04_package_invalid"


def test_starter_l04_rejects_malformed_choice_pairs_before_creating_session_or_tasks(tmp_path, monkeypatch):
    import copy
    from app import learning_flow
    from app.database import connect

    def step_data(package, key):
        return next(step["data"] for step in package["taskBlueprint"]["learnSteps"] if step["stepKey"] == key)

    def duplicate_phonetics_distractor_label(package):
        choices = step_data(package, "exit_ticket")["questions"][0]["choices"]
        choices[1]["label"] = choices[0]["label"]

    def duplicate_sentence_pattern_label(package):
        choices = step_data(package, "sentence_pattern")["choices"]
        choices[1]["label"] = choices[0]["label"]

    def omit_sentence_pattern_choices(package):
        step_data(package, "sentence_pattern").pop("choices")

    def empty_sentence_pattern_choices(package):
        step_data(package, "sentence_pattern")["choices"] = []

    def empty_sentence_pattern_label(package):
        step_data(package, "sentence_pattern")["choices"][1]["label"] = "  "

    def duplicate_reflection_choice_ids(package):
        choices = step_data(package, "mini_check")["choices"]
        choices[1]["id"] = choices[0]["id"]

    def omit_reflection_choice_id(package):
        step_data(package, "mini_check")["choices"][0].pop("id")

    def empty_reflection_choice_label(package):
        step_data(package, "mini_check")["choices"][1]["label"] = " "

    def duplicate_reflection_choice_labels(package):
        choices = step_data(package, "mini_check")["choices"]
        choices[1]["label"] = choices[0]["label"]

    cases = [
        ("phonetics duplicate distractor label", duplicate_phonetics_distractor_label),
        ("sentence pattern duplicate labels", duplicate_sentence_pattern_label),
        ("sentence pattern missing choices", omit_sentence_pattern_choices),
        ("sentence pattern empty choices", empty_sentence_pattern_choices),
        ("sentence pattern empty label", empty_sentence_pattern_label),
        ("reflection duplicate IDs", duplicate_reflection_choice_ids),
        ("reflection missing ID", omit_reflection_choice_id),
        ("reflection empty label", empty_reflection_choice_label),
        ("reflection duplicate labels", duplicate_reflection_choice_labels),
    ]

    with client(tmp_path) as api:
        learner = child(api, "Starter L4 malformed choices")
        place(learner, "STARTER")
        for lesson_id in ("starter-l01", "starter-l02", "starter-l03"):
            response = api.post(
                f"/api/children/{learner}/learning-sessions",
                json={"lesson_id": lesson_id, "target_minutes": 18, "script_mode": "TRADITIONAL"},
            )
            assert response.status_code == 200, response.text
            complete_session(api, learner, response.json())

        original = learning_flow.get_lesson_package
        selected_package = {"value": original("starter-l04")}
        monkeypatch.setattr(
            learning_flow,
            "get_lesson_package",
            lambda lesson_id: selected_package["value"] if lesson_id == "starter-l04" else original(lesson_id),
        )
        for name, corrupt in cases:
            selected_package["value"] = copy.deepcopy(original("starter-l04"))
            corrupt(selected_package["value"])
            response = api.post(
                f"/api/children/{learner}/learning-sessions",
                json={"lesson_id": "starter-l04", "target_minutes": 18, "script_mode": "TRADITIONAL"},
            )
            assert response.status_code == 400, name
            assert response.json()["detail"] == "learning_flow_starter_l04_package_invalid", name
            with connect() as db:
                assert db.execute(
                    "SELECT 1 FROM learning_flow_sessions WHERE child_id=? AND lesson_id='starter-l04'",
                    (learner,),
                ).fetchone() is None, name
                assert db.execute(
                    "SELECT 1 FROM learning_flow_tasks t JOIN learning_flow_sessions s ON s.id=t.session_id WHERE s.child_id=? AND s.lesson_id='starter-l04'",
                    (learner,),
                ).fetchone() is None, name


def test_starter_l03_fails_closed_when_authored_package_contract_is_broken(tmp_path, monkeypatch):
    import copy
    from app import learning_flow

    with client(tmp_path) as api:
        learner = child(api, "Starter L3 malformed package")
        place(learner, "STARTER")
        complete_session(api, learner, session(api, learner))
        complete_session(api, learner, api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l02", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        ).json())
        original = learning_flow.get_lesson_package
        broken = copy.deepcopy(original("starter-l03"))
        broken["curriculumSource"]["licenseStatus"] = "APPROVED"
        monkeypatch.setattr(learning_flow, "get_lesson_package", lambda lesson_id: broken if lesson_id == "starter-l03" else original(lesson_id))
        response = api.post(
            f"/api/children/{learner}/learning-sessions",
            json={"lesson_id": "starter-l03", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "learning_flow_starter_l03_package_invalid"


def test_starter_l02_vocabulary_review_advances_exact_word_srs_without_settling_learn(tmp_path):
    from app.database import connect
    from app.learning_flow import _review_task

    with client(tmp_path) as api:
        child_id = child(api, "Starter L2 REVIEW learner")
        place(child_id, "STARTER")
        complete_session(api, child_id, session(api, child_id))

        started = api.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"lesson_id": "starter-l02", "target_minutes": 18, "script_mode": "TRADITIONAL", "as_of": "2026-09-20T08:00:00Z"},
        )
        assert started.status_code == 200, started.text
        current = started.json()
        vocabulary = next(task for task in current["tasks"] if task["key"] == "vocabulary")
        current = start_task(api, child_id, current, vocabulary)
        current = answer_task(api, child_id, current, vocabulary, "age-seven")
        item_id = vocabulary["itemId"]

        with connect() as db:
            word_state = db.execute(
                "SELECT item_id,stage FROM srs_review_states WHERE child_id=? AND skill_domain='word' AND item_id=?",
                (child_id, item_id),
            ).fetchone()
            assert word_state and word_state["stage"] == 1
            db.execute(
                "UPDATE srs_review_states SET due_at='2026-09-20 07:00:00' WHERE child_id=? AND skill_domain='word' AND item_id=?",
                (child_id, item_id),
            )

        queue = api.get(
            f"/api/children/{child_id}/learning-daily-queue",
            params={"as_of": "2026-09-20T08:00:00Z"},
        ).json()
        due_words = [item for item in queue["review"]["items"] if item["skillDomain"] == "word"]
        assert [(item["id"], item["lessonId"], item["word"]) for item in due_words] == [(item_id, "starter-l02", "七歲")]

        reconciled = api.post(
            f"/api/children/{child_id}/learning-sessions/{current['id']}/reconcile-reviews",
            json={"as_of": "2026-09-20T08:00:00Z"},
        )
        assert reconciled.status_code == 200, reconciled.text
        current = reconciled.json()
        reviews = [task for task in current["tasks"] if task["sourceQueue"] == "REVIEW" and task["skillDomain"] == "word"]
        assert len(reviews) == 1
        review = reviews[0]
        assert review["id"] == f"{current['id']}:{review['key']}"
        assert review["taskType"] == "REVIEW_VOCABULARY"
        assert review["lessonId"] == "starter-l02" and review["itemId"] == item_id
        assert review["taskData"]["word"] == "七歲"
        assert {choice["id"] for choice in review["taskData"]["choices"]} == {"age-seven", "age-eight"}

        # Keep the pre-existing Starter L1 vocabulary REVIEW answer key intact.
        legacy_l1_review = _review_task({
            "skill_domain": "word", "lesson_id": "starter-l01",
            "item_id": f"lf_{child_id}_starter-l01_vocabulary", "due_at": "2026-09-20 07:00:00",
            "word": "你好", "prompt": "選出問候語的意思。",
            "choices": [{"id": "opt-hello", "label": "打招呼問好"}, {"id": "opt-eat", "label": "問對方吃飽沒"}],
        }, "review-word-l1-compat")
        assert legacy_l1_review["_answerKey"] == "opt-hello"

        current = answer_task(api, child_id, current, review, "age-seven")
        assert current["status"] == "IN_PROGRESS"
        current_tasks = {task["id"]: task for task in current["tasks"]}
        assert current_tasks[review["id"]]["state"] == "COMPLETED"
        assert current_tasks[f"{current['id']}:listen"]["state"] == "PENDING"
        with connect() as db:
            advanced = db.execute(
                "SELECT item_id,stage,last_result,due_at FROM srs_review_states WHERE child_id=? AND skill_domain='word' AND item_id=?",
                (child_id, item_id),
            ).fetchone()
        assert advanced["item_id"] == item_id
        assert advanced["stage"] == 2 and advanced["last_result"] == "correct"
        assert advanced["due_at"] > "2026-09-20 08:00:00"


def test_starter_l02_fails_closed_when_authored_package_metadata_does_not_match(tmp_path, monkeypatch):
    import copy
    import app.learning_flow as learning_flow

    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "STARTER")
        complete_session(api, child_id, session(api, child_id))
        original = learning_flow.get_lesson_package
        broken = copy.deepcopy(original("starter-l02"))
        broken["curriculumSource"]["title"] = "替代標題"
        monkeypatch.setattr(learning_flow, "get_lesson_package", lambda lesson_id: broken if lesson_id == "starter-l02" else original(lesson_id))
        response = api.post(
            f"/api/children/{child_id}/learning-sessions",
            json={"lesson_id": "starter-l02", "target_minutes": 18, "script_mode": "TRADITIONAL"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "learning_flow_starter_l02_package_invalid"
        assert api.get(f"/api/children/{child_id}/learning-sessions/current").json() is None


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


def test_partial_recognition_planner_contract_reaches_settlement_for_basic_and_book1(tmp_path):
    from app.database import connect

    contract_path = Path(__file__).resolve().parents[2] / "shared" / "test-fixtures" / "partial-recognition-contract.json"
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    task_contract = contract["task"]

    with client(tmp_path) as api:
        for placement, lesson_id in (("BASIC", "basic-l01"), ("BOOK_1", "book1-l01")):
            assert lesson_id in contract["lessonIds"]
            child_id = child(api, lesson_id)
            place(child_id, placement)
            ensure_lesson_materials(child_id, lesson_id)
            weak_item_id = task_contract["itemIdTemplate"].format(
                child_id=child_id, lesson_id=lesson_id, index=contract["expectedFreshCharacterIndex"]
            )
            strong_item_id = task_contract["itemIdTemplate"].format(
                child_id=child_id, lesson_id=lesson_id, index=contract["strongSeedCharacterIndex"]
            )
            with connect() as db:
                weak_character = db.execute("SELECT character FROM learning_items WHERE child_id=? AND id=?", (child_id, weak_item_id)).fetchone()[0]
                strong_character = db.execute("SELECT character FROM learning_items WHERE child_id=? AND id=?", (child_id, strong_item_id)).fetchone()[0]
                db.execute(
                    "INSERT INTO recognition_states(child_id,item_id,correct_count,incorrect_count,assisted_count,last_result) VALUES(?,?,2,0,0,'correct')",
                    (child_id, strong_item_id),
                )
                assert db.execute("SELECT 1 FROM recognition_states WHERE child_id=? AND item_id=?", (child_id, weak_item_id)).fetchone() is None

            planned_response = api.post(f"/api/children/{child_id}/learning-sessions/plan", json={"as_of": "2026-09-20T08:00:00Z"})
            assert planned_response.status_code == 200, planned_response.text
            planned = planned_response.json()
            recognition_tasks = [task for task in planned["tasks"] if task["skillDomain"] == "recognition"]
            assert len(recognition_tasks) == 1
            partial_task = recognition_tasks[0]
            assert partial_task["key"] == task_contract["key"]
            assert partial_task["taskType"] == task_contract["taskType"]
            assert partial_task["sourceQueue"] == task_contract["sourceQueue"]
            assert partial_task["lessonId"] == lesson_id
            assert partial_task["skillDomain"] == task_contract["skillDomain"]
            assert partial_task["required"] is task_contract["required"]
            assert partial_task["itemId"] == weak_item_id
            assert partial_task["state"] in task_contract["allowedStates"]
            assert partial_task["taskData"]["audioText"] == weak_character
            assert len(partial_task["taskData"]["choices"]) >= task_contract["minimumChoices"]
            assert strong_character != weak_character

            current = session(api, child_id)
            session_recognition_tasks = [task for task in current["tasks"] if task["skillDomain"] == "recognition"]
            assert len(session_recognition_tasks) == 1
            assert session_recognition_tasks[0]["key"] == task_contract["key"]
            assert session_recognition_tasks[0]["taskType"] == task_contract["taskType"]
            assert session_recognition_tasks[0]["itemId"] == weak_item_id

            settled = complete_session(api, child_id, current)
            assert settled["status"] == "COMPLETED"
            completed_task = next(task for task in settled["tasks"] if task["id"] == session_recognition_tasks[0]["id"])
            assert completed_task["state"] == "COMPLETED"
            with connect() as db:
                weak_state = db.execute("SELECT correct_count,last_result FROM recognition_states WHERE child_id=? AND item_id=?", (child_id, weak_item_id)).fetchone()
                strong_state = db.execute("SELECT correct_count,last_result FROM recognition_states WHERE child_id=? AND item_id=?", (child_id, strong_item_id)).fetchone()
                assert weak_state["correct_count"] == 1
                assert weak_state["last_result"] == "correct"
                assert strong_state["correct_count"] == 2
                assert strong_state["last_result"] == "correct"


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


@pytest.mark.parametrize("failure_point", ["assessment_event", "late_settlement_telemetry"])
def test_session_settlement_failure_rolls_back_and_retry_replay_is_idempotent(tmp_path, failure_point):
    from app.database import connect

    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1")
        current = complete_session(api, child_id, session(api, child_id), finalize=False)
        session_id = current["id"]
        lesson_id = current["curriculumContext"]["lessonId"]
        completion_url = f"/api/children/{child_id}/learning-sessions/{session_id}/complete"

        def settlement_snapshot():
            with connect() as db:
                lesson_state = db.execute(
                    "SELECT status FROM curriculum_lesson_states WHERE child_id=? AND lesson_id=?",
                    (child_id, lesson_id),
                ).fetchone()
                lesson_events = {
                    row["event_type"]: row["count"]
                    for row in db.execute(
                        "SELECT event_type,COUNT(*) count FROM curriculum_lesson_events WHERE child_id=? AND lesson_id=? AND event_type IN ('PROGRESS','ASSESSMENT') GROUP BY event_type",
                        (child_id, lesson_id),
                    )
                }
                reward = db.execute(
                    "SELECT COUNT(*) count,COALESCE(SUM(points_delta),0) points FROM points_ledger WHERE child_id=? AND event_key=?",
                    (child_id, f"learning-session:{session_id}"),
                ).fetchone()
                session_row = db.execute(
                    "SELECT status,completed_at,reward_points,mastery_status FROM learning_flow_sessions WHERE id=? AND child_id=?",
                    (session_id, child_id),
                ).fetchone()
                wrap_up = db.execute(
                    "SELECT state FROM learning_flow_tasks WHERE session_id=? AND task_type='LESSON_WRAP_UP'",
                    (session_id,),
                ).fetchone()
                settlement_telemetry = {
                    row["event_type"]: row["count"]
                    for row in db.execute(
                        "SELECT event_type,COUNT(*) count FROM learning_flow_telemetry WHERE session_id=? AND event_type IN ('session_completed','mastery_transition','next_lesson_unlocked') GROUP BY event_type",
                        (session_id,),
                    )
                }
            return {
                "lesson_state": lesson_state["status"] if lesson_state else None,
                "lesson_events": lesson_events,
                "reward": (reward["count"], reward["points"]),
                "session": tuple(session_row[key] for key in ("status", "completed_at", "reward_points", "mastery_status")),
                "wrap_up": wrap_up["state"],
                "telemetry": settlement_telemetry,
            }

        before_failure = settlement_snapshot()
        assert before_failure["lesson_state"] is None
        assert before_failure["lesson_events"] == {}
        assert before_failure["reward"] == (0, 0)
        assert before_failure["session"][0] == "IN_PROGRESS"
        assert before_failure["wrap_up"] == "PENDING"
        assert before_failure["telemetry"] == {}
        before_curriculum = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        next_lesson = next(lesson for stage in before_curriculum["stages"] for lesson in stage["lessons"] if lesson["id"] == "book1-l02")
        assert next_lesson["accessible"] is False

        trigger = "fail_assessment_event" if failure_point == "assessment_event" else "fail_late_settlement_telemetry"
        with connect() as db:
            if failure_point == "assessment_event":
                db.execute(
                    """CREATE TRIGGER fail_assessment_event BEFORE INSERT ON curriculum_lesson_events
                       WHEN NEW.event_type='ASSESSMENT'
                       BEGIN SELECT RAISE(ABORT, 'injected_assessment_event_failure'); END"""
                )
            else:
                db.execute(
                    """CREATE TRIGGER fail_late_settlement_telemetry BEFORE INSERT ON learning_flow_telemetry
                       WHEN NEW.event_type='session_completed'
                       BEGIN SELECT RAISE(ABORT, 'injected_late_settlement_failure'); END"""
                )

        failed_response = api.post(completion_url, json={})
        assert failed_response.status_code == 500, failed_response.text
        assert settlement_snapshot() == before_failure
        after_failure_curriculum = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        next_lesson = next(lesson for stage in after_failure_curriculum["stages"] for lesson in stage["lessons"] if lesson["id"] == "book1-l02")
        assert next_lesson["accessible"] is False

        with connect() as db:
            db.execute(f"DROP TRIGGER {trigger}")

        retry_response = api.post(completion_url, json={})
        assert retry_response.status_code == 200, retry_response.text
        completed = retry_response.json()
        assert completed["status"] == "COMPLETED"
        assert completed["masteryStatus"] == "MASTERED"
        assert completed["assessment"]["status"] == "MASTERED"
        after_retry = settlement_snapshot()
        assert after_retry["lesson_state"] == "MASTERED"
        assert after_retry["lesson_events"] == {"PROGRESS": 1, "ASSESSMENT": 1}
        assert after_retry["reward"] == (1, 5)
        assert after_retry["session"][0] == "COMPLETED"
        assert after_retry["session"][2:] == (5, "MASTERED")
        assert after_retry["wrap_up"] == "COMPLETED"
        assert after_retry["telemetry"] == {
            "session_completed": 1,
            "mastery_transition": 1,
            "next_lesson_unlocked": 1,
        }
        after_retry_curriculum = api.get(f"/api/children/{child_id}/validated-curriculum").json()
        next_lesson = next(lesson for stage in after_retry_curriculum["stages"] for lesson in stage["lessons"] if lesson["id"] == "book1-l02")
        assert next_lesson["accessible"] is True

        replay_response = api.post(completion_url, json={})
        assert replay_response.status_code == 200, replay_response.text
        assert replay_response.json()["status"] == "COMPLETED"
        assert settlement_snapshot() == after_retry


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


@pytest.mark.parametrize("scorer_kind", ["recognition", "vocabulary", "phonetics"])
def test_scored_learn_answer_is_atomic_across_activity_evidence_srs_and_flow(tmp_path, scorer_kind):
    from app.database import connect

    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "STARTER" if scorer_kind == "phonetics" else "BASIC")
        current = session(api, child_id)
        if scorer_kind == "recognition":
            task = next(t for t in current["tasks"] if t["taskType"] in {"RECOGNITION", "MINI_CHECK"})
            with connect() as db:
                private_task = json.loads(db.execute("SELECT task_json FROM learning_flow_tasks WHERE id=?", (task["id"],)).fetchone()["task_json"])
            assert private_task["_answerKind"] == "recognition"
            answer_body = {"selected_option_id": private_task["_answerKey"], "assisted": True}
            item_ids = [task["itemId"]]
            srs_domain = "recognition"
        elif scorer_kind == "vocabulary":
            task = next(t for t in current["tasks"] if t["taskType"] == "VOCABULARY")
            with connect() as db:
                private_task = json.loads(db.execute("SELECT task_json FROM learning_flow_tasks WHERE id=?", (task["id"],)).fetchone()["task_json"])
            assert private_task["_answerKind"] == "vocabulary"
            answer_body = {"selected_option_id": private_task["_answerKey"], "assisted": True}
            item_ids = [task["itemId"]]
            srs_domain = "word"
        else:
            task = next(t for t in current["tasks"] if t["taskType"] == "PHONETICS")
            with connect() as db:
                private_task = json.loads(db.execute("SELECT task_json FROM learning_flow_tasks WHERE id=?", (task["id"],)).fetchone()["task_json"])
            answer_body = {"answers": private_task["_answerKeys"], "assisted": True}
            item_ids = list(private_task["_readingIds"].values())
            srs_domain = None

        current = start_task(api, child_id, current, task)
        flow_session_id = current["id"]
        with connect() as db:
            recognition_session_id = db.execute("SELECT recognition_session_id FROM learning_flow_sessions WHERE id=?", (flow_session_id,)).fetchone()[0]

        def authoritative_snapshot():
            placeholders = ",".join("?" for _ in item_ids)
            with connect() as db:
                task_row = db.execute("SELECT state,attempt_count,failure_count,completed_at,evidence_ref,elapsed_seconds FROM learning_flow_tasks WHERE id=?", (task["id"],)).fetchone()
                flow_attempts = [tuple(row) for row in db.execute("SELECT result,score,assisted,evidence_ref,scorer_version FROM learning_flow_task_attempts WHERE task_id=? ORDER BY rowid", (task["id"],))]
                telemetry = [tuple(row) for row in db.execute("SELECT event_type,details_json FROM learning_flow_telemetry WHERE task_id=? ORDER BY rowid", (task["id"],))]
                domain = "recognition" if scorer_kind == "recognition" else "vocabulary" if scorer_kind == "vocabulary" else "phonetics"
                linked_evidence = [tuple(row) for row in db.execute(f"SELECT skill_domain,evidence_ref,score,assisted,script_mode FROM curriculum_skill_evidence WHERE child_id=? AND skill_domain=? AND evidence_item_id IN ({placeholders}) ORDER BY rowid", (child_id, domain, *item_ids))]
                if scorer_kind == "recognition":
                    scorer_attempts = [tuple(row) for row in db.execute("SELECT id,result,assisted,item_id FROM recognition_attempts WHERE session_id=? AND item_id=? ORDER BY rowid", (recognition_session_id, item_ids[0]))]
                    scorer_states = [tuple(row) for row in db.execute("SELECT item_id,correct_count,incorrect_count,assisted_count,last_result FROM recognition_states WHERE child_id=? AND item_id=?", (child_id, item_ids[0]))]
                elif scorer_kind == "phonetics":
                    scorer_attempts = [tuple(row) for row in db.execute(f"SELECT id,reading_id,correct,assisted FROM pronunciation_attempts WHERE child_id=? AND reading_id IN ({placeholders}) ORDER BY rowid", (child_id, *item_ids))]
                    scorer_states = [tuple(row) for row in db.execute(f"SELECT reading_id,correct_count,incorrect_count,assisted_count FROM pronunciation_states WHERE child_id=? AND reading_id IN ({placeholders}) ORDER BY reading_id", (child_id, *item_ids))]
                else:
                    scorer_attempts = []
                    scorer_states = []
                if srs_domain:
                    srs_states = [tuple(row) for row in db.execute(f"SELECT skill_domain,item_id,stage,last_result,last_assisted FROM srs_review_states WHERE child_id=? AND skill_domain=? AND item_id IN ({placeholders}) ORDER BY item_id", (child_id, srs_domain, *item_ids))]
                    srs_events = [tuple(row) for row in db.execute(f"SELECT skill_domain,item_id,result,assisted,previous_stage,next_stage FROM srs_review_events WHERE child_id=? AND skill_domain=? AND item_id IN ({placeholders}) ORDER BY rowid", (child_id, srs_domain, *item_ids))]
                else:
                    srs_states = []
                    srs_events = []
                return {
                    "task": tuple(task_row), "flow_attempts": flow_attempts, "telemetry": telemetry,
                    "linked_evidence": linked_evidence, "scorer_attempts": scorer_attempts,
                    "scorer_states": scorer_states, "srs_states": srs_states, "srs_events": srs_events,
                }

        before = authoritative_snapshot()
        assert before["task"][0] == "IN_PROGRESS"
        assert before["flow_attempts"] == before["linked_evidence"] == []
        assert [entry[0] for entry in before["telemetry"]] == ["task_started"]
        assert before["scorer_attempts"] == before["scorer_states"] == before["srs_states"] == before["srs_events"] == []

        with connect() as db:
            db.execute(f"""CREATE TRIGGER fail_scored_task_telemetry
                BEFORE INSERT ON learning_flow_telemetry
                WHEN NEW.session_id='{flow_session_id}' AND NEW.task_id='{task['id']}' AND NEW.event_type='task_attempted'
                BEGIN SELECT RAISE(ABORT, 'injected_scored_task_persistence_failure'); END""")
        failed = api.post(f"/api/children/{child_id}/learning-sessions/{flow_session_id}/tasks/{task['id']}/answer", json=answer_body)
        assert failed.status_code == 500
        assert authoritative_snapshot() == before

        with connect() as db:
            db.execute("DROP TRIGGER fail_scored_task_telemetry")
        retry = api.post(f"/api/children/{child_id}/learning-sessions/{flow_session_id}/tasks/{task['id']}/answer", json=answer_body)
        assert retry.status_code == 200, retry.text
        completed = next(t for t in retry.json()["tasks"] if t["id"] == task["id"])
        assert completed["state"] == "COMPLETED"
        after_success = authoritative_snapshot()
        expected_attempts = len(item_ids) if scorer_kind == "phonetics" else 1
        assert after_success["task"][0] == "COMPLETED" and after_success["task"][2] == 0
        assert after_success["task"][1] == expected_attempts
        assert len(after_success["flow_attempts"]) == expected_attempts
        assert len(after_success["linked_evidence"]) == len(item_ids)
        assert len([entry for entry in after_success["telemetry"] if entry[0] == "task_attempted"]) == 1
        assert len([entry for entry in after_success["telemetry"] if entry[0] == "hint_used"]) == 1
        assert all(entry[0] == "correct" and entry[1] == 1.0 and entry[2] == 1 for entry in after_success["flow_attempts"])
        assert all(entry[2:4] == (1.0, 1) for entry in after_success["linked_evidence"])
        flow_refs = {entry[3] for entry in after_success["flow_attempts"]}
        assert flow_refs == {entry[1] for entry in after_success["linked_evidence"]}
        task_attempt_event = next(json.loads(entry[1]) for entry in after_success["telemetry"] if entry[0] == "task_attempted")
        hint_event = next(json.loads(entry[1]) for entry in after_success["telemetry"] if entry[0] == "hint_used")
        assert task_attempt_event["assisted"] is True and task_attempt_event["correct"] is True
        assert hint_event["attemptCount"] == expected_attempts
        if scorer_kind == "recognition":
            assert len(after_success["scorer_attempts"]) == len(after_success["scorer_states"]) == len(after_success["srs_events"]) == len(after_success["srs_states"]) == 1
            assert after_success["scorer_attempts"][0][1:3] == ("correct", 1)
            assert after_success["scorer_states"][0][1:4] == (0, 0, 1)
            assert after_success["srs_states"][0][2:] == (0, "correct", 1)
            assert after_success["srs_events"][0][2:6] == ("correct", 1, 0, 0)
        elif scorer_kind == "vocabulary":
            assert len(after_success["srs_events"]) == len(after_success["srs_states"]) == 1
            assert after_success["srs_states"][0][2:] == (0, "correct", 1)
            assert after_success["srs_events"][0][2:6] == ("correct", 1, 0, 0)
        else:
            assert len(after_success["scorer_attempts"]) == len(after_success["scorer_states"]) == len(item_ids)
            assert all(row[2:] == (1, 1) for row in after_success["scorer_attempts"])
            assert all(row[1:] == (0, 0, 1) for row in after_success["scorer_states"])
            assert after_success["srs_states"] == after_success["srs_events"] == []

        replay = api.post(f"/api/children/{child_id}/learning-sessions/{flow_session_id}/tasks/{task['id']}/answer", json=answer_body)
        assert replay.status_code == 200, replay.text
        assert authoritative_snapshot() == after_success


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


def _flow_writing_evidence(api: TestClient, child_id: int, current: dict, task: dict, result: str, attempt_index: int, **overrides):
    evidence_ref = f"flow-writing:{current['id']}:{task['id']}:{attempt_index}"
    body = {
        "evidence_ref": evidence_ref,
        "trace_result": result,
        "assisted": False,
        "provider": "HANZI_WRITER",
        "phase": task["taskData"]["phase"],
        "script_mode": task["taskData"]["scriptMode"],
        "attempt_index": attempt_index,
        **overrides,
    }
    response = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json=body)
    return response, body


def _writing_flow_snapshot(child_id: int, session_id: str, task_id: str, character: str, srs_item: str):
    from app.database import connect

    with connect() as db:
        return {
            "attempts": [tuple(row) for row in db.execute("SELECT id,child_id,character,trace_result,assisted,provider,phase,script_mode FROM writing_attempts WHERE child_id=? AND character=? ORDER BY id", (child_id, character))],
            "links": [tuple(row) for row in db.execute("SELECT child_id,skill_domain,item_id,lesson_id FROM curriculum_item_links WHERE child_id=? AND skill_domain='writing' AND item_id=?", (child_id, character))],
            "gates": [tuple(row) for row in db.execute("SELECT id,lesson_id,gate_status,assisted,evidence_ref,evidence_type,evidence_item_id FROM curriculum_skill_gates WHERE child_id=? AND skill_domain='writing' AND evidence_item_id=? ORDER BY id", (child_id, character))],
            "states": [tuple(row) for row in db.execute("SELECT child_id,character,independent_success_count,assisted_count FROM writing_states WHERE child_id=? AND character=?", (child_id, character))],
            "srs_state": [tuple(row) for row in db.execute("SELECT child_id,skill_domain,item_id,stage,last_result,last_assisted FROM srs_review_states WHERE child_id=? AND skill_domain='writing' AND item_id=?", (child_id, srs_item))],
            "srs_events": [tuple(row) for row in db.execute("SELECT id,item_id,result,assisted,previous_stage,next_stage FROM srs_review_events WHERE child_id=? AND skill_domain='writing' AND item_id=? ORDER BY id", (child_id, srs_item))],
            "flow_attempts": [tuple(row) for row in db.execute("SELECT session_id,task_id,result,assisted,evidence_ref,scorer_version FROM learning_flow_task_attempts WHERE child_id=? AND session_id=? AND task_id=? ORDER BY evidence_ref", (child_id, session_id, task_id))],
            "task": [tuple(row) for row in db.execute("SELECT state,attempt_count,failure_count,deferred_reason,evidence_ref FROM learning_flow_tasks WHERE id=?", (task_id,))],
            "telemetry": [tuple(row) for row in db.execute("SELECT event_type,task_id FROM learning_flow_telemetry WHERE child_id=? AND session_id=? AND task_id=? ORDER BY rowid", (child_id, session_id, task_id))],
        }


def test_flow_writing_final_evidence_rolls_back_retry_replay_and_keeps_repeat_phase(tmp_path):
    from app.database import connect

    with client(tmp_path, raise_server_exceptions=False) as api:
        child_id = child(api)
        place(child_id, "BOOK_1", writing="BASIC")
        current = session(api, child_id)
        task = next(task for task in current["tasks"] if task["taskType"].startswith("WRITING_"))
        writing_task_id = task["id"]
        current = start_task(api, child_id, current, task)
        task = next(task for task in current["tasks"] if task["id"] == writing_task_id)
        assert task["state"] == "IN_PROGRESS" and task["attemptCount"] == 0
        assert task["taskData"]["repeatCount"] == 2

        # Identity and task metadata are checked before any provider or SRS write.
        standalone = api.post(
            "/api/sprint-b/writing/attempts",
            params={"child_id": child_id, "character": task["itemId"]},
            json={"trace_result": "correct", "provider": "HANZI_WRITER", "phase": "guided", "script_mode": "TRADITIONAL"},
        )
        assert standalone.status_code == 400
        invalid, _ = _flow_writing_evidence(api, child_id, current, task, "correct", 0, phase="independent")
        assert invalid.status_code == 409
        before = _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}")
        missing = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json={"evidence_ref": f"flow-writing:{current['id']}:{task['id']}:0"})
        assert missing.status_code == 409
        assert _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}") == before

        # Fail late, after the writing gate/state/SRS and flow task writes have run.
        with connect() as db:
            db.execute(f"""CREATE TRIGGER fail_writing_telemetry BEFORE INSERT ON learning_flow_telemetry
                WHEN NEW.event_type='writing_progressed' AND NEW.task_id='{task['id']}'
                BEGIN SELECT RAISE(ABORT, 'injected writing telemetry failure'); END""")
        failed, request_body = _flow_writing_evidence(api, child_id, current, task, "correct", 0)
        assert failed.status_code == 500
        assert _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}") == before

        with connect() as db:
            db.execute("DROP TRIGGER fail_writing_telemetry")
        retried = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json=request_body)
        assert retried.status_code == 200, retried.text
        after_first = _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}")
        replay = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json=request_body)
        assert replay.status_code == 200, replay.text
        assert _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}") == after_first
        assert after_first["attempts"] == [(f"flow-writing:{current['id']}:{task['id']}:0", child_id, task["itemId"], "correct", 0, "HANZI_WRITER", "guided", "TRADITIONAL")]
        assert after_first["links"] == [(child_id, "writing", task["itemId"], "book1-l01")]
        assert after_first["gates"][0][4] == f"flow-writing:{current['id']}:{task['id']}:0"
        assert len(after_first["srs_events"]) == len(after_first["flow_attempts"]) == 1
        assert after_first["task"][0][:3] == ("IN_PROGRESS", 1, 0)

        latest = retried.json()
        repeated, second_body = _flow_writing_evidence(api, child_id, latest, task, "correct", 1)
        assert repeated.status_code == 200, repeated.text
        final_snapshot = _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}")
        assert final_snapshot["task"][0][0:3] == ("COMPLETED", 2, 0)
        assert len(final_snapshot["attempts"]) == len(final_snapshot["gates"]) == len(final_snapshot["srs_events"]) == len(final_snapshot["flow_attempts"]) == 2
        assert {attempt[0] for attempt in final_snapshot["attempts"]} == {
            f"flow-writing:{current['id']}:{task['id']}:0",
            f"flow-writing:{current['id']}:{task['id']}:1",
        }
        second_replay = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json=second_body)
        assert second_replay.status_code == 200, second_replay.text
        assert _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}") == final_snapshot

        from app.learning_flow import _writing_phase
        with connect() as db:
            next_phase = _writing_phase(db, child_id, "book1-l01", task["itemId"], "TRADITIONAL")
        assert next_phase == ("reduced_hint", 1)


def test_flow_writing_incorrect_attempt_retry_cap_and_replay_are_atomic(tmp_path):
    with client(tmp_path) as api:
        child_id = child(api)
        place(child_id, "BOOK_1", writing="BASIC")
        current = session(api, child_id)
        task = next(task for task in current["tasks"] if task["taskType"].startswith("WRITING_"))
        writing_task_id = task["id"]
        current = start_task(api, child_id, current, task)
        task = next(task for task in current["tasks"] if task["id"] == writing_task_id)

        first, first_body = _flow_writing_evidence(api, child_id, current, task, "incorrect", 0, assisted=True)
        assert first.status_code == 200, first.text
        first_snapshot = _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}")
        assert first_snapshot["task"][0][:4] == ("IN_PROGRESS", 1, 1, None)
        assert first_snapshot["states"][0][2:] == (0, 1)
        assert first_snapshot["srs_state"][0][-1] == 1 and first_snapshot["flow_attempts"][0][3] == 1
        first_replay = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json=first_body)
        assert first_replay.status_code == 200, first_replay.text
        assert _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}") == first_snapshot

        second, second_body = _flow_writing_evidence(api, child_id, first.json(), task, "incorrect", 1)
        assert second.status_code == 200, second.text
        deferred_snapshot = _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}")
        assert deferred_snapshot["task"][0][:4] == ("DEFERRED", 2, 2, "WRITING_RETRY_CAP")
        second_replay = api.post(f"/api/children/{child_id}/learning-sessions/{current['id']}/tasks/{task['id']}/evidence", json=second_body)
        assert second_replay.status_code == 200, second_replay.text
        assert _writing_flow_snapshot(child_id, current["id"], task["id"], task["itemId"], f"traditional::{task['itemId']}") == deferred_snapshot
        assert len(deferred_snapshot["attempts"]) == len(deferred_snapshot["srs_events"]) == len(deferred_snapshot["flow_attempts"]) == 2


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
