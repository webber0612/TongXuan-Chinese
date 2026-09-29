from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def client(tmp_path: Path, *, raise_server_exceptions: bool = True) -> TestClient:
    os.environ["TONGXUAN_ENV"] = "development"
    os.environ["TONGXUAN_DB_PATH"] = str(tmp_path / "learner-evidence.sqlite3")
    from app.main import app
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def make_child(api: TestClient, name: str = "Evidence learner") -> int:
    result = api.post("/api/children", json={"name": name})
    assert result.status_code == 200, result.text
    return result.json()["id"]


def auth_headers(child_id: int) -> dict[str, str]:
    from app.auth import issue_session
    token = issue_session(subject="evidence-test-owner", role="admin", child_ids=[child_id])
    return {"Authorization": f"Bearer {token}"}


def _write_fact(db, *, child_id: int, target_id: str, target_script: str, script: str,
                dimension: str, outcome: str, source_ref: str, at: str,
                assistance: str = "INDEPENDENT", cue_type: str = "NONE",
                answer_exposed: bool = False, input_method: str = "NONE",
                target_kind: str = "ORTHOGRAPHIC_FORM", concept_id: str | None = None,
                retrieval_timing: str = "UNKNOWN", prior_exposure_at: str | None = None,
                handwriting_expectation: str | None = None, display_form: str | None = None,
                source_lesson_id: str | None = None, source_task_id: str | None = None):
    from app.learner_evidence import record_evidence_in_transaction
    return record_evidence_in_transaction(
        db, child_id=child_id, target_id=target_id, target_kind=target_kind,
        target_script=target_script, concept_id=concept_id, display_form=display_form, dimension=dimension,
        handwriting_expectation=handwriting_expectation,
        script=script, outcome=outcome, assistance=assistance,
        score=1.0 if outcome == "CORRECT" else 0.0 if outcome == "INCORRECT" else None,
        scorer="test-fixture", scorer_version="test-v1", cue_type=cue_type,
        answer_exposed=answer_exposed, input_method=input_method,
        retrieval_timing=retrieval_timing, prior_exposure_at=prior_exposure_at,
        source_type="TEST", source_ref=source_ref, occurred_at=at,
        source_lesson_id=source_lesson_id, source_task_id=source_task_id,
    )


def test_domains_cues_unknown_and_script_scope_are_validated(tmp_path):
    from app.database import connect
    from app.learner_evidence import record_evidence_in_transaction

    with client(tmp_path) as api:
        child_id = make_child(api)
        with connect() as db:
            _write_fact(db, child_id=child_id, target_id="hospital-trad", target_script="TRADITIONAL",
                        script="TRADITIONAL", dimension="ORTHOGRAPHIC_RECOGNITION", outcome="CORRECT",
                        source_ref="trad-1", at="2026-09-01T00:00:00Z", concept_id="lex-hospital",
                        handwriting_expectation="EXPOSURE_ONLY")
            _write_fact(db, child_id=child_id, target_id="hospital-simp", target_script="SIMPLIFIED",
                        script="SIMPLIFIED", dimension="ORTHOGRAPHIC_RECOGNITION", outcome="NOT_ASSESSED",
                        source_ref="simp-1", at="2026-09-01T00:00:00Z", concept_id="lex-hospital")
            with pytest.raises(ValueError, match="active_recall_answer_exposed"):
                record_evidence_in_transaction(
                    db, child_id=child_id, target_id="hospital-concept", target_kind="LEXICAL_CONCEPT",
                    target_script="SCRIPT_INDEPENDENT", dimension="RECALL", script="SCRIPT_INDEPENDENT",
                    outcome="CORRECT", assistance="INDEPENDENT", score=1.0, source_type="TEST",
                    source_ref="visible-recall", occurred_at="2026-09-02T00:00:00Z",
                    cue_type="CHINESE_TEXT", answer_exposed=True,
                )
            with pytest.raises(ValueError, match="orthographic_evidence_requires_script"):
                record_evidence_in_transaction(
                    db, child_id=child_id, target_id="hospital-concept", target_kind="LEXICAL_CONCEPT",
                    target_script="SCRIPT_INDEPENDENT", dimension="READ", script="SCRIPT_INDEPENDENT",
                    outcome="CORRECT", assistance="INDEPENDENT", score=1.0, source_type="TEST",
                    source_ref="scriptless-read", occurred_at="2026-09-02T00:00:00Z",
                )

        headers = auth_headers(child_id)
        profile = api.get(f"/api/children/{child_id}/learner-evidence/orthographic-profile", headers=headers)
        assert profile.status_code == 200, profile.text
        items = {item["target"]["id"]: item for item in profile.json()["items"]}
        assert items["hospital-trad"]["traditional"]["recognition"]["state"] == "OBSERVED"
        assert items["hospital-trad"]["simplified"]["recognition"]["state"] == "NOT_ASSESSED"
        assert items["hospital-trad"]["traditional"]["handwriting"]["state"] == "NOT_ASSESSED"
        assert items["hospital-trad"]["target"]["handwritingExpectation"] == "EXPOSURE_ONLY"
        assert items["hospital-simp"]["simplified"]["recognition"]["state"] == "NOT_ASSESSED"
        assert items["hospital-trad"]["target"]["conceptId"] == items["hospital-simp"]["target"]["conceptId"]
        summary = api.get(f"/api/children/{child_id}/learner-evidence/summary", headers=headers).json()
        assert summary["isMasteryJudgment"] is False
        assert api.post(f"/api/children/{child_id}/learner-evidence/targets", headers=headers, json={"outcome": "MASTERED"}).status_code == 404

        with connect() as db:
                with pytest.raises(ValueError, match="invalid_handwriting_expectation"):
                    _write_fact(db, child_id=child_id, target_id="bad-expectation", target_script="TRADITIONAL",
                                script="TRADITIONAL", dimension="READ", outcome="NOT_ASSESSED",
                                source_ref="invalid-expectation", at="2026-09-02T00:00:00Z",
                                handwriting_expectation="WRITE_WHEN_PREFERRED")


def test_canonical_orthographic_identity_reconverges_across_lessons_and_dimensions(tmp_path):
    from app.database import connect
    from app.learner_evidence import normalize_orthographic_form, orthographic_form_target_id

    assert normalize_orthographic_form("e\u0301") == "é"
    assert orthographic_form_target_id("TRADITIONAL", "é") == orthographic_form_target_id("TRADITIONAL", "e\u0301")
    assert orthographic_form_target_id("TRADITIONAL", "醫") != orthographic_form_target_id("SIMPLIFIED", "医")
    assert orthographic_form_target_id("TRADITIONAL", "醫") != orthographic_form_target_id("TRADITIONAL", " 醫")
    assert orthographic_form_target_id("TRADITIONAL", "醫") != orthographic_form_target_id("TRADITIONAL", "醫、")
    assert orthographic_form_target_id("TRADITIONAL", "醫院") == orthographic_form_target_id("TRADITIONAL", "醫院")
    assert orthographic_form_target_id("TRADITIONAL", "醫院") != orthographic_form_target_id("SIMPLIFIED", "医院")
    assert orthographic_form_target_id("TRADITIONAL", "醫院") != orthographic_form_target_id("TRADITIONAL", "醫")

    with client(tmp_path) as api:
        child_id = make_child(api)
        traditional_target = orthographic_form_target_id("TRADITIONAL", "醫")
        simplified_target = orthographic_form_target_id("SIMPLIFIED", "医")
        with connect() as db:
            with pytest.raises(ValueError, match="orthographic_form_target_id_mismatch"):
                _write_fact(db, child_id=child_id, target_id="learning-item:lesson-a-item:traditional",
                            target_script="TRADITIONAL", script="TRADITIONAL", dimension="READ",
                            outcome="CORRECT", source_ref="bad-form-identity", at="2026-09-01T00:00:00Z",
                            display_form="醫")
            _write_fact(db, child_id=child_id, target_id=traditional_target, target_script="TRADITIONAL",
                        script="TRADITIONAL", dimension="ORTHOGRAPHIC_RECOGNITION", outcome="CORRECT",
                        source_ref="lesson-a-recognition", at="2026-09-01T00:00:00Z", display_form="醫",
                        source_lesson_id="lesson-a", source_task_id="lesson-a-task")
            _write_fact(db, child_id=child_id, target_id=traditional_target, target_script="TRADITIONAL",
                        script="TRADITIONAL", dimension="ORTHOGRAPHIC_RECOGNITION", outcome="INCORRECT",
                        source_ref="lesson-b-recognition", at="2026-09-02T00:00:00Z", display_form="醫",
                        source_lesson_id="lesson-b", source_task_id="lesson-b-task")
            _write_fact(db, child_id=child_id, target_id=traditional_target, target_script="TRADITIONAL",
                        script="TRADITIONAL", dimension="HANDWRITING", outcome="NOT_ASSESSED",
                        source_ref="lesson-b-writing", at="2026-09-03T00:00:00Z", display_form="醫",
                        source_lesson_id="lesson-b", source_task_id="lesson-b-writing-task")
            _write_fact(db, child_id=child_id, target_id=traditional_target, target_script="TRADITIONAL",
                        script="TRADITIONAL", dimension="READ", outcome="CORRECT",
                        source_ref="lesson-b-read", at="2026-09-03T12:00:00Z", display_form="醫",
                        source_lesson_id="lesson-b", source_task_id="lesson-b-read-task")
            _write_fact(db, child_id=child_id, target_id=traditional_target, target_script="TRADITIONAL",
                        script="TRADITIONAL", dimension="INPUT", outcome="CORRECT", input_method="ZHUYIN",
                        source_ref="lesson-b-zhuyin", at="2026-09-04T00:00:00Z", display_form="醫")
            _write_fact(db, child_id=child_id, target_id=traditional_target, target_script="TRADITIONAL",
                        script="TRADITIONAL", dimension="INPUT", outcome="CORRECT", input_method="PINYIN",
                        source_ref="lesson-b-pinyin", at="2026-09-05T00:00:00Z", display_form="醫")
            _write_fact(db, child_id=child_id, target_id=simplified_target, target_script="SIMPLIFIED",
                        script="SIMPLIFIED", dimension="ORTHOGRAPHIC_RECOGNITION", outcome="CORRECT",
                        source_ref="lesson-c-simplified", at="2026-09-06T00:00:00Z", display_form="医",
                        source_lesson_id="lesson-c", source_task_id="lesson-c-task")

            target_rows = db.execute(
                "SELECT target_id,script,display_form,concept_id FROM learner_evidence_targets WHERE child_id=? ORDER BY target_id",
                (child_id,),
            ).fetchall()
            assert len(target_rows) == 2
            traditional_events = db.execute(
                "SELECT source_lesson_id,source_task_id,target_id FROM learner_evidence_events WHERE child_id=? AND target_id=? ORDER BY source_lesson_id,source_task_id",
                (child_id, traditional_target),
            ).fetchall()
            assert len(traditional_events) == 6
            assert {row["source_lesson_id"] for row in traditional_events if row["source_lesson_id"]} == {"lesson-a", "lesson-b"}
            assert {row["source_task_id"] for row in traditional_events if row["source_task_id"]} == {
                "lesson-a-task", "lesson-b-task", "lesson-b-writing-task",
                "lesson-b-read-task",
            }
            assert all(row["target_id"] == traditional_target for row in traditional_events)
            assert {row["script"] for row in target_rows} == {"TRADITIONAL", "SIMPLIFIED"}
            assert all(row["concept_id"] is None for row in target_rows)

        headers = auth_headers(child_id)
        profile = api.get(f"/api/children/{child_id}/learner-evidence/orthographic-profile", headers=headers)
        assert profile.status_code == 200, profile.text
        items = {item["target"]["id"]: item for item in profile.json()["items"]}
        traditional = items[traditional_target]["traditional"]
        assert traditional["recognition"]["evidenceCount"] == 2
        assert traditional["reading"]["evidenceCount"] == 1
        assert traditional["handwriting"]["state"] == "NOT_ASSESSED"
        assert traditional["inputByMethod"]["ZHUYIN"]["evidenceCount"] == 1
        assert traditional["inputByMethod"]["PINYIN"]["evidenceCount"] == 1
        assert items[simplified_target]["simplified"]["recognition"]["state"] == "OBSERVED"
        target = api.get(f"/api/children/{child_id}/learner-evidence/targets/{traditional_target}", headers=headers).json()
        assert {event["source"]["lessonId"] for event in target["events"] if event["source"]["lessonId"]} == {"lesson-a", "lesson-b"}
        assert {event["dimension"] for event in target["events"]} >= {
            "ORTHOGRAPHIC_RECOGNITION", "READ", "INPUT", "HANDWRITING",
        }


def test_append_idempotency_assistance_delayed_and_deterministic_rebuild(tmp_path):
    from app.database import connect
    from app.learner_evidence import rebuild_child_profile

    with client(tmp_path) as api:
        child_id = make_child(api)
        with connect() as db:
            first = _write_fact(db, child_id=child_id, target_id="recall-hospital", target_script="SCRIPT_INDEPENDENT",
                                script="SCRIPT_INDEPENDENT", target_kind="LEXICAL_CONCEPT", concept_id="lex-hospital",
                                dimension="RECALL", outcome="CORRECT", source_ref="attempt-1", at="2026-09-01T00:00:00Z",
                                cue_type="IMAGE", input_method="VOICE")
            duplicate = _write_fact(db, child_id=child_id, target_id="recall-hospital", target_script="SCRIPT_INDEPENDENT",
                                    script="SCRIPT_INDEPENDENT", target_kind="LEXICAL_CONCEPT", concept_id="lex-hospital",
                                    dimension="RECALL", outcome="CORRECT", source_ref="attempt-1", at="2026-09-01T00:00:00Z",
                                    cue_type="IMAGE", input_method="VOICE")
            delayed = _write_fact(db, child_id=child_id, target_id="recall-hospital", target_script="SCRIPT_INDEPENDENT",
                                  script="SCRIPT_INDEPENDENT", target_kind="LEXICAL_CONCEPT", concept_id="lex-hospital",
                                  dimension="RECALL", outcome="CORRECT", source_ref="attempt-2", at="2026-09-08T00:00:00Z",
                                  assistance="ASSISTED", cue_type="CONCEPT", input_method="VOICE",
                                  retrieval_timing="DELAYED", prior_exposure_at="2026-09-01T00:00:00Z")
            assert first["inserted"] is True and duplicate["inserted"] is False
            assert delayed["inserted"] is True
            count = db.execute("SELECT COUNT(*) FROM learner_evidence_events WHERE child_id=?", (child_id,)).fetchone()[0]
            assert count == 2
            with pytest.raises(sqlite3.IntegrityError, match="learner_evidence_events_are_immutable"):
                db.execute("UPDATE learner_evidence_events SET outcome='INCORRECT' WHERE id=?", (first["id"],))
            before = dict(db.execute("SELECT * FROM learner_evidence_profiles WHERE child_id=? AND target_id='recall-hospital'", (child_id,)).fetchone())

        rebuild_child_profile(child_id=child_id)
        with connect() as db:
            after = dict(db.execute("SELECT * FROM learner_evidence_profiles WHERE child_id=? AND target_id='recall-hospital'", (child_id,)).fetchone())
            for key in before:
                if key != "rebuilt_at":
                    assert before[key] == after[key]
        target = api.get(f"/api/children/{child_id}/learner-evidence/targets/recall-hospital", headers=auth_headers(child_id)).json()
        assert target["profile"][0]["state"] == "OBSERVED"
        assert target["profile"][0]["evidenceCount"] == 2
        assert target["profile"][0]["independentCorrectCount"] == 1
        assert target["profile"][0]["assistedCount"] == 1
        assert target["events"][1]["retrievalTiming"] == "DELAYED"
        summary = api.get(f"/api/children/{child_id}/learner-evidence/summary", headers=auth_headers(child_id)).json()
        assert summary["isMasteryJudgment"] is False
        assert summary["eventFacts"] == {
            "totalEvidenceCount": 2, "activeRecallObservationCount": 2,
            "delayedCorrectRetrievalCount": 1, "delayedIndependentCorrectRetrievalCount": 0,
            "incorrectOrPartialCount": 0,
        }


def test_production_learning_flow_recognition_writes_server_scored_orthographic_fact(tmp_path):
    from app.database import connect

    with client(tmp_path) as api:
        child_id = make_child(api)
        from app.placement import save_placement_profile
        save_placement_profile(child_id=child_id, domain_levels={key: "BOOK_1" for key in ("recognition", "reading", "vocabulary", "grammar")}, assessment_method="PARENT_OBSERVATION", assessed_by="test")
        session = api.post(f"/api/children/{child_id}/learning-sessions", json={
            "target_minutes": 18, "script_mode": "SIMPLIFIED", "as_of": "2026-09-20T08:00:00Z",
        })
        assert session.status_code == 200, session.text
        body = session.json()
        task = next(task for task in body["tasks"] if task["skillDomain"] == "recognition" and task["taskType"] in {"RECOGNITION", "MINI_CHECK"})
        assert api.post(f"/api/children/{child_id}/learning-sessions/{body['id']}/tasks/{task['id']}/start").status_code == 200
        with connect() as db:
            correct_character = db.execute("SELECT character FROM learning_items WHERE id=? AND child_id=?", (task["itemId"], child_id)).fetchone()[0]
        selected = next(choice["id"] for choice in task["taskData"]["choices"] if choice["label"] == correct_character)
        answered = api.post(f"/api/children/{child_id}/learning-sessions/{body['id']}/tasks/{task['id']}/answer", json={"selected_option_id": selected})
        assert answered.status_code == 200, answered.text
        with connect() as db:
            event = db.execute("SELECT * FROM learner_evidence_events WHERE child_id=? AND source_type='LEARNING_FLOW_RECOGNITION'", (child_id,)).fetchone()
            assert event["outcome"] == "CORRECT"
            assert event["dimension"] == "ORTHOGRAPHIC_RECOGNITION"
            assert event["script"] == "SIMPLIFIED"
            assert event["cue_type"] == "AUDIO"
            assert event["answer_exposed"] == 0
            assert event["scorer"] == "learning_flow_server_answer_key"
            assert event["source_task_id"] == task["id"]
            assert event["source_session_id"] == body["id"]
            from app.learner_evidence import orthographic_form_target_id
            assert event["target_id"] == orthographic_form_target_id("SIMPLIFIED", correct_character)


def _speaking_attempt(api: TestClient, child_id: int) -> str:
    from app.curriculum_policy import _lesson_map
    from app.database import connect
    from app.learning_flow import _ensure_lesson_materials

    lesson = _lesson_map()["starter-l01"]
    with connect() as db:
        _ensure_lesson_materials(db, child_id, lesson)
        linked = db.execute("""SELECT i.id,i.character FROM curriculum_item_links l JOIN learning_items i ON i.id=l.item_id
                              WHERE l.child_id=? AND l.lesson_id='starter-l01' AND l.skill_domain='speaking' LIMIT 1""", (child_id,)).fetchone()
        assert linked is not None
    start = api.post(f"/api/reading-aloud/attempts/start?child_id={child_id}", json={
        "text": linked["character"], "text_kind": "character", "locale": "zh-TW",
        "source_type": "CURRICULUM", "source_id": linked["id"], "activity_domain": "speaking",
    })
    assert start.status_code == 200, start.text
    return start.json()["id"]


def test_provider_completion_and_evidence_are_atomic_and_retryable(tmp_path, monkeypatch):
    from app import learner_evidence
    from app.database import connect

    with client(tmp_path, raise_server_exceptions=False) as api:
        child_id = make_child(api)
        attempt_id = _speaking_attempt(api, child_id)
        monkeypatch.setattr(learner_evidence, "record_evidence_in_transaction", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("forced_evidence_failure")))
        failed = api.post(f"/api/reading-aloud/attempts/{attempt_id}/complete?child_id={child_id}", json={"duration_ms": 500})
        assert failed.status_code == 500
        with connect() as db:
            attempt = db.execute("SELECT status FROM reading_aloud_attempts WHERE id=?", (attempt_id,)).fetchone()
            assert attempt["status"] == "STARTED"
            assert db.execute("SELECT COUNT(*) FROM curriculum_skill_gates WHERE evidence_ref=?", (attempt_id,)).fetchone()[0] == 0
            assert db.execute("SELECT COUNT(*) FROM learner_evidence_events WHERE source_ref=?", (attempt_id,)).fetchone()[0] == 0

        monkeypatch.undo()
        completed = api.post(f"/api/reading-aloud/attempts/{attempt_id}/complete?child_id={child_id}", json={"duration_ms": 500})
        assert completed.status_code == 200, completed.text
        with connect() as db:
            assert db.execute("SELECT status FROM reading_aloud_attempts WHERE id=?", (attempt_id,)).fetchone()[0] == "COMPLETED"
            assert db.execute("SELECT COUNT(*) FROM curriculum_skill_gates WHERE evidence_ref=?", (attempt_id,)).fetchone()[0] == 1
            event = db.execute("SELECT dimension,outcome,script FROM learner_evidence_events WHERE source_ref=?", (attempt_id,)).fetchall()
            assert len(event) == 1
            assert tuple(event[0]) == ("SPEAK", "NOT_ASSESSED", "SCRIPT_INDEPENDENT")


def test_listening_and_pronunciation_production_paths_keep_scored_and_unscored_meanings(tmp_path):
    from app.curriculum_policy import _lesson_map
    from app.database import connect
    from app.learning_flow import _ensure_lesson_materials

    with client(tmp_path) as api:
        child_id = make_child(api)
        with connect() as db:
            _ensure_lesson_materials(db, child_id, _lesson_map()["starter-l01"])
            item_id = db.execute("SELECT item_id FROM curriculum_item_links WHERE child_id=? AND lesson_id='starter-l01' AND skill_domain='listening' LIMIT 1", (child_id,)).fetchone()[0]
        started = api.post(f"/api/children/{child_id}/listening-attempts", json={"item_id": item_id})
        assert started.status_code == 200, started.text
        completed = api.post(f"/api/children/{child_id}/listening-attempts/{started.json()['id']}/complete", json={"duration_ms": 400})
        assert completed.status_code == 200, completed.text

        seeded = api.post(f"/api/sprint-b/seed?child_id={child_id}")
        assert seeded.status_code == 200, seeded.text
        simplified = next(reading for reading in seeded.json()["readings"] if reading["script"] == "SIMPLIFIED" and reading["character"] == "学")
        pronunciation = api.post(f"/api/sprint-b/pronunciation/{simplified['id']}/attempts?child_id={child_id}", json={"answer": "xue2"})
        assert pronunciation.status_code == 200, pronunciation.text
        assert pronunciation.json()["correct"] is True

        with connect() as db:
            listening_fact = db.execute("SELECT dimension,outcome,score,script FROM learner_evidence_events WHERE source_ref=?", (started.json()["id"],)).fetchone()
            pronunciation_fact = db.execute("SELECT dimension,outcome,score,script,input_method FROM learner_evidence_events WHERE source_ref=?", (pronunciation.json()["attempt_id"],)).fetchone()
        assert tuple(listening_fact) == ("HEAR", "NOT_ASSESSED", None, "SCRIPT_INDEPENDENT")
        assert tuple(pronunciation_fact) == ("PHONETIC_NOTATION", "CORRECT", 1.0, "SIMPLIFIED", "PINYIN")
        from app.learner_evidence import orthographic_form_target_id
        target_id = orthographic_form_target_id("SIMPLIFIED", simplified["character"])
        with connect() as db:
            _write_fact(db, child_id=child_id, target_id=target_id, target_script="SIMPLIFIED",
                        script="SIMPLIFIED", dimension="PHONETIC_NOTATION", outcome="CORRECT",
                        input_method="PINYIN", source_ref="delayed-notation-fixture",
                        at="2026-09-21T08:00:00Z", retrieval_timing="DELAYED",
                        prior_exposure_at="2026-09-20T08:00:00Z", display_form=simplified["character"])
        summary = api.get(f"/api/children/{child_id}/learner-evidence/summary", headers=auth_headers(child_id)).json()
        assert summary["eventFacts"]["activeRecallObservationCount"] == 0
        assert summary["eventFacts"]["delayedCorrectRetrievalCount"] == 0
        assert summary["eventFacts"]["delayedIndependentCorrectRetrievalCount"] == 0
        target = api.get(f"/api/children/{child_id}/learner-evidence/targets/{target_id}", headers=auth_headers(child_id)).json()
        notation_event = next(event for event in target["events"] if event["source"]["ref"] == pronunciation.json()["attempt_id"])
        assert notation_event["dimension"] == "PHONETIC_NOTATION"
        assert notation_event["outcome"] == "CORRECT"


def test_learning_flow_client_trace_result_does_not_become_handwriting_correctness(tmp_path):
    from app.database import connect
    from app.placement import save_placement_profile

    with client(tmp_path) as api:
        child_id = make_child(api)
        save_placement_profile(child_id=child_id, domain_levels={
            "recognition": "BOOK_1", "reading": "BOOK_1", "vocabulary": "BOOK_1", "grammar": "BOOK_1", "writing": "STARTER",
        }, assessment_method="PARENT_OBSERVATION", assessed_by="test")
        current = api.post(f"/api/children/{child_id}/learning-sessions", json={
            "target_minutes": 18, "script_mode": "TRADITIONAL", "lesson_id": "book1-l01", "as_of": "2026-09-20T08:00:00Z",
        })
        assert current.status_code == 200, current.text
        session = current.json()
        task = next(task for task in session["tasks"] if task["taskType"].startswith("WRITING_"))
        assert api.post(f"/api/children/{child_id}/learning-sessions/{session['id']}/tasks/{task['id']}/start").status_code == 200
        result = api.post(f"/api/children/{child_id}/learning-sessions/{session['id']}/tasks/{task['id']}/evidence", json={
            "trace_result": "correct", "assisted": False, "provider": "HANZI_WRITER",
            "phase": task["taskData"]["phase"], "script_mode": task["taskData"]["scriptMode"], "attempt_index": 0,
        })
        assert result.status_code == 200, result.text
        with connect() as db:
            attempt_id = db.execute("SELECT id FROM writing_attempts WHERE child_id=? ORDER BY created_at DESC,id DESC LIMIT 1", (child_id,)).fetchone()[0]
            fact = db.execute("SELECT dimension,outcome,score,script,source_task_id,source_session_id FROM learner_evidence_events WHERE source_ref=?", (attempt_id,)).fetchone()
            provider_trace = db.execute("SELECT trace_result FROM writing_attempts WHERE id=?", (attempt_id,)).fetchone()[0]
        assert tuple(fact) == ("HANDWRITING", "NOT_ASSESSED", None, "TRADITIONAL", task["id"], session["id"])
        assert provider_trace == "correct"


def test_legacy_default_script_row_is_not_promoted_to_script_specific_evidence(tmp_path):
    from app.database import connect

    with client(tmp_path) as api:
        child_id = make_child(api)
        with connect() as db:
            db.execute("""INSERT INTO pronunciation_readings
                (id,character,script,notation_system,notation,locale,context,script_scope_verified,source_name,license_name,provenance_status,commercial_ready)
                VALUES('legacy-reading','學','TRADITIONAL','ZHUYIN','ㄒㄩㄝˊ','zh-TW','legacy',0,'legacy','unknown','UNKNOWN',0)""")
        result = api.post(f"/api/sprint-b/pronunciation/legacy-reading/attempts?child_id={child_id}", json={"answer": "ㄒㄩㄝˊ"})
        assert result.status_code == 200, result.text
        with connect() as db:
            assert db.execute("SELECT COUNT(*) FROM pronunciation_attempts WHERE id=?", (result.json()["attempt_id"],)).fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM learner_evidence_events WHERE source_ref=?", (result.json()["attempt_id"],)).fetchone()[0] == 0


def test_v8_migrates_populated_v5_without_backfill_or_legacy_rewrite(tmp_path, monkeypatch):
    from app.database import connect, initialize_database

    path = tmp_path / "populated-v5.sqlite3"
    monkeypatch.setenv("TONGXUAN_DB_PATH", str(path))
    initialize_database()
    with connect() as db:
        db.execute("INSERT INTO children(id,name) VALUES(77,'Legacy')")
        db.execute("INSERT INTO placement_profiles(child_id,profile_version,main_curriculum_start,domains_json,assessment_method,assessed_by) VALUES(77,1,'BASIC',?,'DIAGNOSTIC','legacy')", (json.dumps({"recognition": "BASIC"}),))
        db.execute("INSERT INTO learning_items(id,child_id,character,curriculum_source,provenance_status) VALUES('legacy-item',77,'醫院','legacy','PRIVATE_OK')")
        db.execute("INSERT INTO learning_sessions(id,child_id) VALUES('legacy-session',77)")
        db.execute("INSERT INTO recognition_attempts(id,child_id,item_id,result,source_queue,session_id) VALUES('legacy-attempt',77,'legacy-item','correct','CURRICULUM','legacy-session')")
        db.execute("INSERT INTO srs_review_states(child_id,skill_domain,item_id,stage,due_at,last_result,updated_at) VALUES(77,'recognition','legacy-item',1,'2026-10-01','correct','2026-09-01')")
        for table in ("learner_evidence_profiles", "learner_evidence_events", "learner_evidence_targets", "placement_profiles_v2"):
            db.execute(f"DROP TABLE {table}")
        db.execute("DROP TRIGGER IF EXISTS learner_evidence_events_immutable_update")
        db.execute("DELETE FROM schema_migrations WHERE version=6")
        db.execute("PRAGMA user_version=5")

    initialize_database()
    initialize_database()
    with connect() as db:
        assert db.execute("PRAGMA user_version").fetchone()[0] == 8
        assert db.execute("SELECT COUNT(*) FROM learner_evidence_events").fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM learner_evidence_targets").fetchone()[0] == 0
        assert db.execute("SELECT main_curriculum_start FROM placement_profiles WHERE child_id=77").fetchone()[0] == "BASIC"
        assert db.execute("SELECT COUNT(*) FROM recognition_attempts WHERE id='legacy-attempt'").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM srs_review_states WHERE child_id=77").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM learner_evidence_profiles").fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM schema_migrations WHERE version=6").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM schema_migrations WHERE version=7").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM schema_migrations WHERE version=8").fetchone()[0] == 1


def test_v8_upgrades_existing_v6_handwriting_contract_and_validates_expectation(tmp_path, monkeypatch):
    from app.database import connect, initialize_database

    path = tmp_path / "existing-v6.sqlite3"
    monkeypatch.setenv("TONGXUAN_DB_PATH", str(path))
    initialize_database()
    with connect() as db:
        db.execute("INSERT INTO children(id,name) VALUES(88,'Existing v6 learner')")
        db.execute("ALTER TABLE learner_evidence_targets DROP COLUMN handwriting_expectation")
        db.execute("DELETE FROM schema_migrations WHERE version=7")
        db.execute("PRAGMA user_version=6")

    initialize_database()
    with connect() as db:
        columns = {row[1] for row in db.execute("PRAGMA table_info(learner_evidence_targets)")}
        assert "handwriting_expectation" in columns
        db.execute("""INSERT INTO learner_evidence_targets
            (child_id,target_id,target_kind,concept_id,script,display_form,handwriting_expectation,created_at)
            VALUES(88,'exposure-target','ORTHOGRAPHIC_FORM',NULL,'TRADITIONAL','字','EXPOSURE_ONLY','2026-09-01T00:00:00Z')""")
        with pytest.raises(sqlite3.IntegrityError):
            db.execute("""INSERT INTO learner_evidence_targets
                (child_id,target_id,target_kind,concept_id,script,display_form,handwriting_expectation,created_at)
                VALUES(88,'invalid-target','ORTHOGRAPHIC_FORM',NULL,'TRADITIONAL','字','WRITE_WHEN_PREFERRED','2026-09-01T00:00:00Z')""")
        assert db.execute("PRAGMA user_version").fetchone()[0] == 8
        assert db.execute("SELECT description FROM schema_migrations WHERE version=7").fetchone()[0] == "Explicit target handwriting expectation contract"


def test_v8_rebuilds_v7_event_check_without_losing_existing_evidence(tmp_path, monkeypatch):
    from app.database import connect, initialize_database
    from app.learner_evidence import orthographic_form_target_id

    path = tmp_path / "existing-v7.sqlite3"
    monkeypatch.setenv("TONGXUAN_DB_PATH", str(path))
    initialize_database()
    child_id = 89
    target_id = orthographic_form_target_id("TRADITIONAL", "醫")
    with connect() as db:
        db.execute("INSERT INTO children(id,name) VALUES(?,?)", (child_id, "Existing v7 learner"))
        _write_fact(db, child_id=child_id, target_id=target_id, target_script="TRADITIONAL",
                    script="TRADITIONAL", dimension="ORTHOGRAPHIC_RECOGNITION", outcome="CORRECT",
                    source_ref="existing-v7-event", at="2026-09-01T00:00:00Z", display_form="醫")
        existing = dict(db.execute("SELECT * FROM learner_evidence_events WHERE source_ref='existing-v7-event'").fetchone())
        db.execute("DROP TRIGGER IF EXISTS learner_evidence_events_immutable_update")
        db.execute("ALTER TABLE learner_evidence_events RENAME TO learner_evidence_events_v8_fixture")
        db.execute("""CREATE TABLE learner_evidence_events (
            id TEXT PRIMARY KEY,
            child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL,
            dimension TEXT NOT NULL CHECK(dimension IN ('HEAR','RECALL','READ','INPUT','HANDWRITING','SPEAK','ORTHOGRAPHIC_RECOGNITION','PRONUNCIATION')),
            script TEXT NOT NULL CHECK(script IN ('TRADITIONAL','SIMPLIFIED','SCRIPT_INDEPENDENT')),
            outcome TEXT NOT NULL CHECK(outcome IN ('CORRECT','INCORRECT','PARTIAL','NOT_ASSESSED')),
            assistance TEXT NOT NULL CHECK(assistance IN ('INDEPENDENT','ASSISTED','UNKNOWN')),
            score REAL CHECK(score IS NULL OR (score >= 0 AND score <= 1)),
            scorer TEXT, scorer_version TEXT,
            cue_type TEXT NOT NULL CHECK(cue_type IN ('IMAGE','CONCEPT','NATIVE_LANGUAGE','CONTEXT_CLOZE','AUDIO','CHINESE_TEXT','NONE')),
            answer_exposed INTEGER NOT NULL CHECK(answer_exposed IN (0,1)),
            input_method TEXT NOT NULL CHECK(input_method IN ('ZHUYIN','PINYIN','VOICE','OTHER_KEYBOARD','NONE')),
            retrieval_timing TEXT NOT NULL CHECK(retrieval_timing IN ('IMMEDIATE','DELAYED','UNKNOWN')),
            prior_exposure_at TEXT, review_due_at TEXT, source_type TEXT NOT NULL, source_ref TEXT NOT NULL,
            source_task_id TEXT, source_session_id TEXT, source_lesson_id TEXT,
            occurred_at TEXT NOT NULL, created_at TEXT NOT NULL,
            evidence_schema_version INTEGER NOT NULL CHECK(evidence_schema_version = 1),
            FOREIGN KEY(child_id,target_id) REFERENCES learner_evidence_targets(child_id,target_id) ON DELETE CASCADE,
            UNIQUE(child_id,source_type,source_ref,target_id,dimension,script,input_method),
            CHECK(dimension <> 'RECALL' OR (cue_type <> 'CHINESE_TEXT' AND answer_exposed = 0)),
            CHECK(outcome NOT IN ('NOT_ASSESSED') OR score IS NULL)
        )""")
        columns = (
            "id,child_id,target_id,dimension,script,outcome,assistance,score,scorer,scorer_version,"
            "cue_type,answer_exposed,input_method,retrieval_timing,prior_exposure_at,review_due_at,"
            "source_type,source_ref,source_task_id,source_session_id,source_lesson_id,occurred_at,"
            "created_at,evidence_schema_version"
        )
        db.execute(f"INSERT INTO learner_evidence_events({columns}) SELECT {columns} FROM learner_evidence_events_v8_fixture")
        db.execute("DROP TABLE learner_evidence_events_v8_fixture")
        db.execute("DELETE FROM schema_migrations WHERE version=8")
        db.execute("PRAGMA user_version=7")

    initialize_database()
    initialize_database()
    with connect() as db:
        migrated = dict(db.execute("SELECT * FROM learner_evidence_events WHERE source_ref='existing-v7-event'").fetchone())
        assert migrated == existing
        assert db.execute("PRAGMA user_version").fetchone()[0] == 8
        assert db.execute("SELECT description FROM schema_migrations WHERE version=8").fetchone()[0] == "Phonetic notation evidence dimension"
        _write_fact(db, child_id=child_id, target_id=target_id, target_script="TRADITIONAL",
                    script="TRADITIONAL", dimension="PHONETIC_NOTATION", outcome="CORRECT",
                    input_method="ZHUYIN", source_ref="new-v8-event", at="2026-09-02T00:00:00Z",
                    display_form="醫")
        assert db.execute("SELECT COUNT(*) FROM learner_evidence_events WHERE child_id=?", (child_id,)).fetchone()[0] == 2


def test_placement_profile_v2_is_additive_and_preserves_legacy_aggregate(tmp_path):
    with client(tmp_path) as api:
        child_id = make_child(api)
        headers = auth_headers(child_id)
        legacy = api.put(f"/api/children/{child_id}/placement-profile", headers=headers, json={
            "domain_levels": {"recognition": "BASIC", "reading": "STARTER", "vocabulary": "BASIC", "grammar": "BASIC"},
            "assessment_method": "DIAGNOSTIC",
        })
        assert legacy.status_code == 200, legacy.text
        initial = api.get(f"/api/children/{child_id}/placement-profile/v2", headers=headers)
        assert initial.status_code == 200, initial.text
        assert initial.json()["profileVersion"] == 2
        assert initial.json()["legacyAggregate"]["mainCurriculumStart"] == "STARTER"
        assert initial.json()["domains"]["traditional_recognition"]["level"] == "NOT_ASSESSED"

        first_update = api.put(f"/api/children/{child_id}/placement-profile/v2", headers=headers, json={
            "domains": {"traditional_recognition": "STARTER"},
            "assessment_method": "PARENT_OBSERVATION",
        })
        assert first_update.status_code == 200, first_update.text
        assert first_update.json()["domains"]["traditional_recognition"]["level"] == "STARTER"
        second_update = api.put(f"/api/children/{child_id}/placement-profile/v2", headers=headers, json={
            "domains": {"simplified_writing": "BASIC"},
            "assessment_method": "DIAGNOSTIC",
        })
        assert second_update.status_code == 200, second_update.text
        assert second_update.json()["domains"]["traditional_recognition"]["level"] == "STARTER"
        assert second_update.json()["domains"]["simplified_writing"]["level"] == "BASIC"
        assert second_update.json()["legacyAggregate"] == initial.json()["legacyAggregate"]
        assert api.get(f"/api/children/{child_id}/placement-profile", headers=headers).json()["mainCurriculumStart"] == "STARTER"
        empty = api.put(f"/api/children/{child_id}/placement-profile/v2", headers=headers, json={
            "domains": {}, "assessment_method": "DIAGNOSTIC",
        })
        assert empty.status_code == 400
        assert empty.json()["detail"] == "no_placement_v2_domains_supplied"
        invalid = api.put(f"/api/children/{child_id}/placement-profile/v2", headers=headers, json={
            "domains": {"recognition": "BOOK_2"}, "assessment_method": "DIAGNOSTIC",
        })
        assert invalid.status_code == 400


def test_child_delete_cascades_new_evidence_without_orphans(tmp_path):
    from app.database import connect

    with client(tmp_path) as api:
        child_id = make_child(api)
        with connect() as db:
            _write_fact(db, child_id=child_id, target_id="delete-target", target_script="TRADITIONAL",
                        script="TRADITIONAL", dimension="READ", outcome="NOT_ASSESSED",
                        source_ref="delete-attempt", at="2026-09-01T00:00:00Z")
            db.execute("DELETE FROM children WHERE id=?", (child_id,))
            assert db.execute("SELECT COUNT(*) FROM learner_evidence_events WHERE child_id=?", (child_id,)).fetchone()[0] == 0
            assert db.execute("SELECT COUNT(*) FROM learner_evidence_targets WHERE child_id=?", (child_id,)).fetchone()[0] == 0
            assert db.execute("SELECT COUNT(*) FROM learner_evidence_profiles WHERE child_id=?", (child_id,)).fetchone()[0] == 0
