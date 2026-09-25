from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from .database import connect, initialize_database
from .curriculum_policy import record_srs_review


def uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def ensure_child(connection: sqlite3.Connection, child_id: int) -> None:
    if connection.execute("SELECT 1 FROM children WHERE id = ?", (child_id,)).fetchone() is None:
        raise ValueError("child_not_found")


def create_child(name: str) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        cursor = db.execute("INSERT INTO children (name) VALUES (?)", (name.strip(),))
        return {"id": cursor.lastrowid, "name": name.strip()}


def list_children(child_ids: set[int] | None = None) -> list[dict[str, Any]]:
    initialize_database()
    with connect() as db:
        if child_ids is None:
            return [dict(row) for row in db.execute("SELECT id, name, created_at FROM children ORDER BY id")]
        if not child_ids:
            return []
        placeholders = ",".join("?" for _ in child_ids)
        return [dict(row) for row in db.execute(f"SELECT id, name, created_at FROM children WHERE id IN ({placeholders}) ORDER BY id", tuple(sorted(child_ids)))]


def seed_learning_items(child_id: int, characters: list[str] | None = None) -> list[dict[str, Any]]:
    initialize_database()
    characters = characters or ["學", "学", "國", "国"]
    with connect() as db:
        ensure_child(db, child_id)
        for character in characters:
            db.execute(
                "INSERT OR IGNORE INTO learning_items (id, child_id, character, curriculum_source, provenance_status, commercial_ready) VALUES (?, ?, ?, ?, ?, ?)",
                (uid("item"), child_id, character, "PHASE_0_SAMPLE", "LICENSE_REVIEW_REQUIRED", 0),
            )
        return [dict(row) for row in db.execute("SELECT * FROM learning_items WHERE child_id = ? ORDER BY id", (child_id,))]


def start_session(child_id: int) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        session_id = uid("session")
        db.execute("INSERT INTO learning_sessions (id, child_id) VALUES (?, ?)", (session_id, child_id))
        return {"id": session_id, "child_id": child_id}


def next_recognition_item(child_id: int, session_id: str) -> dict[str, Any] | None:
    with connect() as db:
        ensure_child(db, child_id)
        if db.execute("SELECT 1 FROM learning_sessions WHERE id = ? AND child_id = ?", (session_id, child_id)).fetchone() is None:
            raise ValueError("session_not_found")
        row = db.execute(
            """SELECT i.id, i.character, i.curriculum_source, COALESCE(s.correct_count,0) correct_count,
               COALESCE(s.incorrect_count,0) incorrect_count, COALESCE(s.assisted_count,0) assisted_count
               FROM learning_items i LEFT JOIN recognition_states s ON s.item_id=i.id AND s.child_id=i.child_id
               LEFT JOIN srs_review_states sr ON sr.child_id=i.child_id AND sr.item_id=i.id AND sr.skill_domain='recognition'
               WHERE i.child_id=?
                 AND COALESCE(sr.due_at, s.due_at, CURRENT_TIMESTAMP) <= CURRENT_TIMESTAMP
                 AND (
                   NOT EXISTS (SELECT 1 FROM recognition_attempts a WHERE a.session_id=? AND a.item_id=i.id)
                   OR (
                     (SELECT COUNT(*) FROM recognition_attempts a WHERE a.session_id=? AND a.item_id=i.id) < 3
                     AND (SELECT a.result='incorrect' OR a.assisted=1 FROM recognition_attempts a WHERE a.session_id=? AND a.item_id=i.id ORDER BY a.rowid DESC LIMIT 1)
                   )
                 )
               ORDER BY EXISTS (SELECT 1 FROM recognition_attempts a WHERE a.session_id=? AND a.item_id=i.id),
                        COALESCE(sr.due_at, s.due_at, CURRENT_TIMESTAMP), i.id LIMIT 1""", (child_id, session_id, session_id, session_id, session_id)
        ).fetchone()
        return dict(row) if row else None


def record_attempt(child_id: int, session_id: str, item_id: str, result: str, assisted: bool, source_queue: str, response_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    if result not in {"correct", "incorrect"}:
        raise ValueError("result_must_be_correct_or_incorrect")
    with connect() as db:
        ensure_child(db, child_id)
        item = db.execute("SELECT 1 FROM learning_items WHERE id=? AND child_id=?", (item_id, child_id)).fetchone()
        session = db.execute("SELECT 1 FROM learning_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if item is None or session is None:
            raise ValueError("child_item_or_session_not_found")
        attempt_id = uid("attempt")
        db.execute("INSERT INTO recognition_attempts (id, child_id, item_id, result, assisted, source_queue, session_id, response_metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (attempt_id, child_id, item_id, result, int(assisted), source_queue, session_id, json.dumps(response_metadata or {}, ensure_ascii=False)))
        if result == "incorrect":
            db.execute(
                """INSERT OR IGNORE INTO review_queue_items
                   (id, child_id, item_id, character, source_detail, reason, priority)
                   SELECT ?, child_id, id, character, ?, ?, 10 FROM learning_items WHERE id=?""",
                (uid("review"), "Recognition incorrect", "Recognition incorrect", item_id),
            )
        delay = 0 if result == "incorrect" or assisted else 1
        db.execute("""INSERT INTO recognition_states (child_id,item_id,correct_count,incorrect_count,assisted_count,last_result,due_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(child_id,item_id) DO UPDATE SET
          correct_count=correct_count+excluded.correct_count, incorrect_count=incorrect_count+excluded.incorrect_count,
          assisted_count=assisted_count+excluded.assisted_count,last_result=excluded.last_result,due_at=excluded.due_at,updated_at=excluded.updated_at""",
          (child_id, item_id, int(result == "correct" and not assisted), int(result == "incorrect"), int(assisted), result, (datetime.now(timezone.utc) + timedelta(days=delay)).strftime("%Y-%m-%d %H:%M:%S"), now()))
        srs = record_srs_review(db, child_id=child_id, skill_domain="recognition", item_id=item_id, result=result, assisted=assisted)
        return dict(db.execute("SELECT * FROM recognition_attempts WHERE id=?", (attempt_id,)).fetchone()) | {"srs": srs}


def _record_linked_curriculum_evidence(
    db: sqlite3.Connection,
    *,
    child_id: int,
    skill_domain: str,
    item_id: str,
    score: float,
    assisted: bool,
    evidence_ref: str,
    evidence_type: str,
    script_mode: str | None = None,
) -> str | None:
    """Persist evidence only after a server scorer created its attempt record."""
    from .curriculum_evidence import record_linked_score_evidence

    return record_linked_score_evidence(
        db,
        child_id=child_id,
        skill_domain=skill_domain,
        item_id=item_id,
        score=score,
        assisted=assisted,
        evidence_ref=evidence_ref,
        evidence_type=evidence_type,
        script_mode=script_mode,
    )


def finish_session(child_id: int, session_id: str) -> dict[str, Any]:
    with connect() as db:
        session = db.execute("SELECT * FROM learning_sessions WHERE id=? AND child_id=?", (session_id, child_id)).fetchone()
        if session is None:
            raise ValueError("session_not_found")
        if session["ended_at"] is not None:
            raise ValueError("session_already_completed")
        count = db.execute("SELECT COUNT(*) n FROM recognition_attempts WHERE session_id=? AND child_id=?", (session_id, child_id)).fetchone()["n"]
        if count == 0:
            raise ValueError("session_has_no_attempts")
        db.execute("UPDATE learning_sessions SET ended_at=? WHERE id=? AND child_id=?", (now(), session_id, child_id))
        award_points(db, child_id, "SESSION_COMPLETE", 5, session_id, f"session:{session_id}", "Completed recognition session")
        return {"session_id": session_id, "attempts": count}


def add_school_item(child_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    if (payload.get("source_type", "USER_PROVIDED_SCHOOL_CONTENT") != "USER_PROVIDED_SCHOOL_CONTENT" or
            payload.get("private_content") is not True or payload.get("provenance_status") != "PRIVATE_OK" or
            payload.get("public_curriculum_reuse", False) or payload.get("commercial_reuse", False)):
        raise ValueError("school_queue_private_provenance_required")
    with connect() as db:
        ensure_child(db, child_id)
        item_id = uid("school")
        db.execute("INSERT INTO school_queue_items (id,child_id,character,school_source,due_date,priority,notes,private_content,provenance_status) VALUES (?,?,?,?,?,?,?,?,?)", (item_id, child_id, payload["character"], payload["school_source"], payload.get("due_date"), int(payload.get("priority", 0)), payload.get("notes", ""), int(payload.get("private_content", True)), payload.get("provenance_status", "PRIVATE_OK")))
        result = dict(db.execute("SELECT * FROM school_queue_items WHERE id=?", (item_id,)).fetchone())
        result["source_type"] = "USER_PROVIDED_SCHOOL_CONTENT"
        result["public_curriculum_reuse"] = False
        result["commercial_reuse"] = False
        return result


def list_daily_queue(child_id: int) -> list[dict[str, Any]]:
    with connect() as db:
        ensure_child(db, child_id)
        curriculum = [dict(row) | {"source": "CURRICULUM"} for row in db.execute("SELECT id, character, curriculum_source AS source_detail, 0 AS priority FROM learning_items WHERE child_id=? ORDER BY id", (child_id,))]
        school = [dict(row) | {"source": "SCHOOL_QUEUE"} for row in db.execute("SELECT id, character, school_source AS source_detail, priority FROM school_queue_items WHERE child_id=? AND active=1 AND completed=0 ORDER BY priority DESC, due_date, id", (child_id,))]
        review = [dict(row) | {"source": "REVIEW"} for row in db.execute("SELECT id, character, source_detail, priority FROM review_queue_items WHERE child_id=? AND active=1 ORDER BY priority DESC, created_at, id", (child_id,))]
        return school + review + curriculum


def create_weekly_test(child_id: int) -> dict[str, Any]:
    from .sprint_b import IDIOM_CONTEXT_TASKS

    with connect() as db:
        ensure_child(db, child_id)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
        rows = db.execute(
            """SELECT i.id, i.character FROM learning_items i
               LEFT JOIN recognition_states s ON s.item_id=i.id AND s.child_id=i.child_id
               WHERE i.child_id=?
               ORDER BY CASE WHEN COALESCE(s.correct_count,0)>0 THEN 0 ELSE 1 END,
                        CASE WHEN COALESCE(s.updated_at, i.created_at)>=? THEN 0 ELSE 1 END,
                        COALESCE(s.updated_at, i.created_at) DESC, i.id
               LIMIT 2""", (child_id, cutoff)
        ).fetchall()
        test_id = uid("test")
        item_ids: list[dict[str, Any]] = []
        choices = [{"id": f"choice_{index + 1}", "label": row["character"]} for index, row in enumerate(rows)]
        for index, row in enumerate(rows):
            item_ids.append({
                "id": f"recognition:{row['id']}", "skill": "recognition", "attemptType": "recognition_attempt",
                "taskType": "multiple_choice", "targetId": row["id"], "character": row["character"],
                "prompt": f"選出這個字：{row['character']}", "options": choices, "correctChoice": f"choice_{index + 1}",
            })

        word = db.execute("SELECT id,word FROM words WHERE child_id=? ORDER BY id LIMIT 1", (child_id,)).fetchone()
        all_words = db.execute("SELECT id,word FROM words WHERE child_id=? ORDER BY id", (child_id,)).fetchall()
        if word and len(word["word"]) >= 2:
            distractors = [candidate["word"][-1] for candidate in all_words if candidate["id"] != word["id"] and candidate["word"].startswith(word["word"][:-1])]
            if distractors:
                item_ids.append({
                    "id": f"vocabulary:{word['id']}", "skill": "vocabulary", "attemptType": "word_attempt",
                    "taskType": "multiple_choice", "targetId": word["id"], "stem": word["word"][:-1],
                    "prompt": f"選一個字，把「{word['word'][:-1]}□」補成一個詞語。",
                    "options": [{"id": "glyph_a", "label": word["word"][-1]}, {"id": "glyph_b", "label": distractors[0]}],
                    "correctChoice": "glyph_a",
                })

        sentence = db.execute("SELECT id,sentence FROM sentences WHERE child_id=? ORDER BY id LIMIT 1", (child_id,)).fetchone()
        if sentence:
            sentence_words = [row["word"] for row in db.execute("SELECT w.word FROM sentence_words sw JOIN words w ON w.id=sw.word_id WHERE sw.sentence_id=? ORDER BY sw.position", (sentence["id"],))]
            target_word = next((candidate for candidate in sentence_words if candidate in sentence["sentence"]), None)
            distractor_word = next((candidate for candidate in sentence_words if candidate != target_word), None)
            if target_word and distractor_word:
                before, after = sentence["sentence"].split(target_word, 1)
                item_ids.append({
                    "id": f"sentence:{sentence['id']}", "skill": "sentence", "attemptType": "sentence_attempt",
                    "taskType": "sentence_cloze", "targetId": sentence["id"],
                    "prompt": f"哪個詞填進空格後，句子讀起來正確？「{before}□{after}」",
                    "options": [{"id": "sentence_a", "label": target_word}, {"id": "sentence_b", "label": distractor_word}],
                    "answerByChoice": {"sentence_a": sentence["sentence"], "sentence_b": f"{before}{distractor_word}{after}"},
                })

        character = db.execute("SELECT wc.character FROM word_characters wc JOIN words w ON w.id=wc.word_id WHERE w.child_id=? ORDER BY wc.position LIMIT 1", (child_id,)).fetchone()
        if character:
            item_ids.append({
                "id": f"writing:{character['character']}", "skill": "writing_practice", "attemptType": "writing_provider_event",
                "taskType": "trace_event", "targetId": character["character"],
                "prompt": f"請用筆順練習寫「{character['character']}」。", "provider": "HANZI_WRITER",
            })

        for notation_system in ("ZHUYIN", "PINYIN"):
            reading = db.execute("SELECT id,character,notation,notation_system FROM pronunciation_readings WHERE notation_system=? ORDER BY id LIMIT 1", (notation_system,)).fetchone()
            if reading:
                notation_options = db.execute("SELECT id,notation FROM pronunciation_readings WHERE notation_system=? ORDER BY id LIMIT 4", (reading["notation_system"],)).fetchall()
                if len(notation_options) > 1:
                    item_ids.append({
                        "id": f"phonetics:{reading['id']}", "skill": "phonetics", "attemptType": "phonetic_notation_attempt",
                        "taskType": "multiple_choice", "targetId": reading["id"],
                        "prompt": f"選出「{reading['character']}」的{reading['notation_system']}記音。",
                        "options": [{"id": f"notation_{index + 1}", "label": row["notation"]} for index, row in enumerate(notation_options)],
                        "answerByChoice": {f"notation_{index + 1}": row["notation"] for index, row in enumerate(notation_options)},
                        "correctChoice": "notation_1",
                        "scriptMode": "zhuyin" if reading["notation_system"] == "ZHUYIN" else "pinyin",
                    })

        grammar = db.execute("SELECT id,answer_rule FROM grammar_exercises ORDER BY id LIMIT 1").fetchone()
        if grammar:
            correct_sentence = grammar["answer_rule"]
            item_ids.append({
                "id": f"grammar:{grammar['id']}", "skill": "grammar", "attemptType": "grammar_attempt",
                "taskType": "multiple_choice", "targetId": grammar["id"],
                "prompt": "選出用「在」說明地點的句子。",
                "options": [{"id": "grammar_a", "label": correct_sentence}, {"id": "grammar_b", "label": "學校在我。"}],
                "answerByChoice": {"grammar_a": correct_sentence, "grammar_b": "學校在我。"},
            })

        idiom = db.execute("SELECT id FROM idioms ORDER BY id LIMIT 1").fetchone()
        if idiom and idiom["id"] in IDIOM_CONTEXT_TASKS:
            context_task = IDIOM_CONTEXT_TASKS[idiom["id"]]
            item_ids.append({
                "id": f"idiom:{idiom['id']}", "skill": "idiom_practice", "attemptType": "idiom_context_attempt",
                "taskType": "context_choice", "targetId": idiom["id"],
                "prompt": context_task["prompt"],
                "options": [{"id": "context_a", "label": context_task["options"][0]["label"]}, {"id": "context_b", "label": context_task["options"][1]["label"]}],
                "answerByChoice": {"context_a": context_task["options"][0]["id"], "context_b": context_task["options"][1]["id"]},
                "correctChoice": "context_a",
            })

        passage = db.execute("SELECT p.id passage_id,q.id question_id,q.prompt,q.answer_rule,p.passage FROM reading_passages p JOIN reading_questions q ON q.passage_id=p.id WHERE p.child_id=? ORDER BY q.id LIMIT 1", (child_id,)).fetchone()
        if passage:
            item_ids.append({
                "id": f"reading:{passage['question_id']}", "skill": "reading", "attemptType": "reading_attempt",
                "taskType": "comprehension_choice", "targetId": passage["passage_id"], "questionId": passage["question_id"],
                "prompt": f"讀完「{passage['passage']}」後回答：{passage['prompt']}",
                "options": [{"id": "reading_a", "label": passage["answer_rule"]}, {"id": "reading_b", "label": "學習"}],
                "answerByChoice": {"reading_a": passage["answer_rule"], "reading_b": "學習"},
            })

        item_ids = item_ids[:10]
        for index, item in enumerate(item_ids):
            item["id"] = f"{test_id}_activity_{index + 1:02d}"
        blueprint = {
            "id": "guided-practice-review-v2",
            "assessmentType": "PRACTICE_REVIEW_NOT_ABILITY_ASSESSMENT",
            "resultMeaning": "個別活動的作答或 provider 事件；不代表跨領域能力、熟練度或課程精熟。",
            "deterministicSelection": True,
        }
        db.execute("INSERT INTO weekly_tests (id,child_id,item_ids,total,assessment_blueprint) VALUES (?,?,?,?,?)", (test_id, child_id, json.dumps(item_ids, ensure_ascii=False), len(item_ids), json.dumps(blueprint, sort_keys=True)))
        display_items = [{key: value for key, value in item.items() if key not in {"correctChoice", "answerByChoice", "targetId", "questionId", "character", "scriptMode"}} for item in item_ids]
        return {"id": test_id, "child_id": child_id, "items": display_items, "total": len(item_ids), "assessment_blueprint": blueprint}


def submit_weekly_test(child_id: int, test_id: str, answers: dict[str, str]) -> dict[str, Any]:
    from .sprint_b import practice_grammar, practice_idiom_understanding, practice_pronunciation, practice_sentence, practice_word, submit_reading

    with connect() as db:
        row = db.execute("SELECT * FROM weekly_tests WHERE id=? AND child_id=?", (test_id, child_id)).fetchone()
        if row is None:
            raise ValueError("test_not_found")
        if row["completed_at"] is not None:
            raise ValueError("weekly_test_already_completed")
        items = json.loads(row["item_ids"])
        if not all(isinstance(value, str) for value in answers.values()):
            raise ValueError("answers_must_be_choice_ids")
        writing_events: dict[str, sqlite3.Row] = {}
        for item in items:
            if item["skill"] != "writing_practice":
                continue
            answer = answers.get(item["id"], "")
            if not answer:
                continue
            writing_event = db.execute(
                "SELECT trace_result,assisted,provider FROM writing_attempts WHERE id=? AND child_id=? AND character=?",
                (answer, child_id, item["targetId"]),
            ).fetchone()
            if writing_event is None or writing_event["provider"] != item["provider"]:
                raise ValueError("writing_provider_event_required")
            writing_events[item["id"]] = writing_event
        correctness: dict[str, bool] = {}
        activity_results: list[dict[str, Any]] = []
        session_id: str | None = None
        for item in items:
            answer = answers.get(item["id"], "")
            skill = item["skill"]
            correct = False
            attempt_ref: str | None = None
            evidence: tuple[str, str, str, float, str | None] | None = None
            if skill == "recognition":
                if session_id is None:
                    session_id = start_session(child_id)["id"]
                correct = answer == item["correctChoice"]
                attempt = record_attempt(child_id, session_id, item["targetId"], "correct" if correct else "incorrect", False, "WEEKLY_PRACTICE_REVIEW", {"weeklyTestId": test_id})
                attempt_ref = attempt["id"]
                evidence = ("recognition", item["targetId"], "recognition_attempt", float(correct), None)
            elif skill == "vocabulary":
                correct = answer == item["correctChoice"]
                scored = practice_word(child_id, item["targetId"], "correct" if correct else "incorrect", False)
                attempt_ref = scored["attempt_id"]
                evidence = ("vocabulary", item["targetId"], "word_attempt", float(correct), None)
            elif skill == "sentence":
                sentence_answer = item["answerByChoice"].get(answer, "")
                sentence_item = practice_sentence(child_id, item["targetId"], sentence_answer, False)
                correct = bool(sentence_item["correct"])
                attempt_ref = sentence_item["attempt_id"]
            elif skill == "writing_practice":
                if not answer:
                    attempt_details = {"provider": item["provider"], "traceEvent": "unverified"}
                    correct = False
                    attempt_ref = None
                else:
                    trace = writing_events[item["id"]]
                    correct = trace["trace_result"] == "correct" and not bool(trace["assisted"])
                    attempt_ref = answer
                    attempt_details = {"provider": trace["provider"], "traceEvent": "completed" if trace["trace_result"] == "correct" else "incomplete", "assisted": bool(trace["assisted"])}
            elif skill == "phonetics":
                choice_id = answer
                notation = next((option["label"] for option in item["options"] if option["id"] == choice_id), "")
                scored = practice_pronunciation(child_id, item["targetId"], notation, False, "WEEKLY_PHONETICS_PRACTICE")
                correct = bool(scored["correct"])
                attempt_ref = scored["attempt_id"]
                evidence = ("phonetics", item["targetId"], "phonetic_notation_attempt", float(correct), item["scriptMode"])
            elif skill == "grammar":
                grammar_answer = item["answerByChoice"].get(answer, "")
                scored = practice_grammar(child_id, item["targetId"], grammar_answer, False)
                correct = bool(scored["correct"])
                attempt_ref = scored["attempt_id"]
                evidence = ("grammar", item["targetId"], "grammar_attempt", float(correct), None)
            elif skill == "idiom_practice":
                if not answer:
                    answer = next(option["id"] for option in item["options"] if option["id"] != item["correctChoice"])
                context_choice = item["answerByChoice"].get(answer, "")
                scored = practice_idiom_understanding(child_id, item["targetId"], context_choice, False)
                correct = bool(scored["correct"])
                attempt_ref = scored["attempt_id"]
            elif skill == "reading":
                reading_answer = item["answerByChoice"].get(answer, "")
                scored = submit_reading(child_id, item["targetId"], {item["questionId"]: reading_answer})
                correct = bool(scored["correctness"].get(item["questionId"], False))
                attempt_ref = scored["attempt_id"]
                ratio = scored["score"] / scored["total"] if scored["total"] else 0.0
                evidence = ("reading", item["targetId"], "reading_attempt", ratio, None)
            evidence_id = None
            if evidence and attempt_ref:
                evidence_id = _record_linked_curriculum_evidence(
                    db,
                    child_id=child_id,
                    skill_domain=evidence[0],
                    item_id=evidence[1],
                    evidence_type=evidence[2],
                    score=evidence[3],
                    script_mode=evidence[4],
                    assisted=False,
                    evidence_ref=attempt_ref,
                )
                if evidence_id:
                    db.commit()
            correctness[item["id"]] = correct
            activity_result = "unverified" if skill == "writing_practice" and attempt_ref is None else "correct" if correct else "incorrect"
            activity_results.append({"itemId": item["id"], "attemptType": item["attemptType"], "attemptId": attempt_ref, "evidenceId": evidence_id, "result": activity_result, **(attempt_details if skill == "writing_practice" else {})})

        correct_count = sum(correctness.values())
        db.execute("UPDATE weekly_tests SET submitted_answers=?,correctness=?,score=?,domain_scores='{}',completed_at=? WHERE id=?", (json.dumps(answers, ensure_ascii=False), json.dumps(correctness), correct_count, now(), test_id))
        award_points(db, child_id, "WEEKLY_TEST_COMPLETE", 10, test_id, f"weekly-test:{test_id}", "Completed weekly practice review")
        return {"id": test_id, "practice_points": correct_count, "total": len(items), "activity_results": activity_results, "practice_only": True, "overall_score_is_mastery": False, "missed_items": [item["prompt"] for item in items if not correctness[item["id"]]]}


def award_points(db: sqlite3.Connection, child_id: int, event_type: str, delta: int, related: str, event_key: str, reason: str) -> bool:
    cursor = db.execute("INSERT OR IGNORE INTO points_ledger (id,child_id,event_type,points_delta,related_entity,event_key,reason) VALUES (?,?,?,?,?,?,?)", (uid("points"), child_id, event_type, delta, related, event_key, reason))
    return cursor.rowcount == 1


def points_summary(child_id: int) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id)
        db.execute("INSERT OR IGNORE INTO reward_catalog (id,name,cost) VALUES ('reward_special_time','Special family time',20)")
        ledger = [dict(row) for row in db.execute("SELECT * FROM points_ledger WHERE child_id=? ORDER BY timestamp,id", (child_id,))]
        balance = sum(row["points_delta"] for row in ledger)
        rewards = [dict(row) for row in db.execute("SELECT * FROM reward_catalog WHERE active=1 ORDER BY cost")]
        return {"child_id": child_id, "balance": balance, "ledger": ledger, "rewards": rewards}


def redeem_reward(child_id: int, reward_id: str) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id)
        reward = db.execute("SELECT * FROM reward_catalog WHERE id=? AND active=1", (reward_id,)).fetchone()
        if reward is None:
            raise ValueError("reward_not_found")
        balance = db.execute("SELECT COALESCE(SUM(points_delta),0) balance FROM points_ledger WHERE child_id=?", (child_id,)).fetchone()["balance"]
        if balance < reward["cost"]:
            raise ValueError("insufficient_balance")
        redemption_id = uid("redemption")
        db.execute("INSERT INTO reward_redemptions (id,child_id,reward_id,cost) VALUES (?,?,?,?)", (redemption_id, child_id, reward_id, reward["cost"]))
        award_points(db, child_id, "REWARD_REDEMPTION", -reward["cost"], redemption_id, f"redemption:{redemption_id}", f"Redeemed {reward['name']}")
        return {"id": redemption_id, "reward_id": reward_id, "cost": reward["cost"]}
