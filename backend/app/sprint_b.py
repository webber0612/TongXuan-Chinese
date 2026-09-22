from __future__ import annotations

import json
import sqlite3
from typing import Any

from .database import connect, initialize_database
from .learning import ensure_child, now, uid
from .pinyin import normalize_pinyin
from .writing_provider import provider_for

PROVENANCE = {
    "provenance_status": "LICENSE_REVIEW_REQUIRED",
    "source_name": "TongXuan Sprint B auditable sample",
    "source_url": "",
    "license_name": "Family test sample; review before commercial use",
    "commercial_ready": 0,
}


def _content_values(table: str, content_id: str, values: dict[str, Any], columns: list[str]) -> tuple[Any, ...]:
    return tuple([content_id] + [values[column] for column in columns])


def seed_sprint_b(child_id: int) -> dict[str, Any]:
    initialize_database()
    with connect() as db:
        ensure_child(db, child_id)
        word_rows = [
            (f"word_{child_id}_school", "學校", "學校"),
            (f"word_{child_id}_學習", "學習", "學習"),
        ]
        for word_id, word, _ in word_rows:
            db.execute("INSERT OR IGNORE INTO words (id,child_id,word,provenance_status,source_name,source_url,license_name,commercial_ready) VALUES (?,?,?,?,?,?,?,?)", (word_id, child_id, word, PROVENANCE["provenance_status"], PROVENANCE["source_name"], PROVENANCE["source_url"], PROVENANCE["license_name"], 0))
            for position, character in enumerate(word):
                db.execute("INSERT OR IGNORE INTO word_characters (word_id,character,position) VALUES (?,?,?)", (word_id, character, position))
        sentence_id = f"sentence_{child_id}_greeting"
        db.execute("INSERT OR IGNORE INTO sentences (id,child_id,sentence,provenance_status,source_name,license_name,commercial_ready) VALUES (?,?,?,?,?,?,?)", (sentence_id, child_id, "我在學校學習。", PROVENANCE["provenance_status"], PROVENANCE["source_name"], PROVENANCE["license_name"], 0))
        db.execute("INSERT OR IGNORE INTO sentence_words VALUES (?,?,?)", (sentence_id, word_rows[0][0], 1))
        db.execute("INSERT OR IGNORE INTO sentence_words VALUES (?,?,?)", (sentence_id, word_rows[1][0], 2))
        readings = [
            ("reading_學_zhuyin", "學", "TRADITIONAL", "ZHUYIN", "ㄒㄩㄝˊ", "zh-TW", ""),
            ("reading_学_pinyin", "学", "SIMPLIFIED", "PINYIN", "xué", "zh-CN", ""),
            ("reading_行_bank", "行", "SIMPLIFIED", "PINYIN", "háng", "zh-CN", "銀行"),
            ("reading_行_walk", "行", "SIMPLIFIED", "PINYIN", "xíng", "zh-CN", "行走"),
        ]
        for reading_id, character, script, system, notation, locale, context in readings:
            db.execute("INSERT OR IGNORE INTO pronunciation_readings (id,character,script,notation_system,notation,locale,context,source_name,license_name,provenance_status,commercial_ready) VALUES (?,?,?,?,?,?,?,?,?,?,?)", (reading_id, character, script, system, notation, locale, context, PROVENANCE["source_name"], PROVENANCE["license_name"], PROVENANCE["provenance_status"], 0))
        db.execute("INSERT OR IGNORE INTO grammar_concepts VALUES (?,?,?,?,?,?,?,?)", ("grammar_在", "在 + place", "在 marks location.", "我在學校。", PROVENANCE["provenance_status"], PROVENANCE["source_name"], PROVENANCE["license_name"], 0))
        db.execute("INSERT OR IGNORE INTO grammar_exercises VALUES (?,?,?,?)", ("grammar_ex_在", "grammar_在", "Choose the correct sentence.", "我在學校。"))
        db.execute("INSERT OR IGNORE INTO idioms VALUES (?,?,?,?,?,?,?,?)", ("idiom_百聞不如一見", "百聞不如一見", "Seeing once is better than hearing many times.", "百聞不如一見。", PROVENANCE["provenance_status"], PROVENANCE["source_name"], PROVENANCE["license_name"], 0))
        for position, character in enumerate("百聞不如一見"):
            db.execute("INSERT OR IGNORE INTO idiom_characters VALUES (?,?,?)", ("idiom_百聞不如一見", character, position))
        passage_id = f"passage_{child_id}_school"
        db.execute("INSERT OR IGNORE INTO reading_passages VALUES (?,?,?,?,?,?,?,?)", (passage_id, child_id, "我的學校", "我每天到學校學習。學校裡有圖書館。", PROVENANCE["provenance_status"], PROVENANCE["source_name"], PROVENANCE["license_name"], 0))
        for word_id, _, _ in word_rows:
            db.execute("INSERT OR IGNORE INTO passage_vocabulary VALUES (?,?)", (passage_id, word_id))
        db.execute("INSERT OR IGNORE INTO reading_questions VALUES (?,?,?,?)", (f"question_{child_id}_school", passage_id, "Where does the child study?", "學校"))
        return {"words": list_words(child_id, db), "sentences": list_sentences(child_id, db), "readings": list_readings(None, None, db), "grammar": list_grammar(db), "idioms": list_idioms(db), "passages": list_passages(child_id, db)}


def list_words(child_id: int, db: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    own = db is None
    db = db or connect()
    ensure_child(db, child_id)
    rows = [dict(row) for row in db.execute("SELECT w.*,COALESCE(s.correct_count,0) correct_count,COALESCE(s.incorrect_count,0) incorrect_count,COALESCE(s.assisted_count,0) assisted_count FROM words w LEFT JOIN word_states s ON s.word_id=w.id AND s.child_id=w.child_id WHERE w.child_id=? ORDER BY w.id", (child_id,))]
    if own: db.close()
    return rows


def list_sentences(child_id: int, db: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    own = db is None; db = db or connect(); ensure_child(db, child_id)
    rows = []
    for row in db.execute("SELECT s.*,COALESCE(st.correct_count,0) correct_count,COALESCE(st.incorrect_count,0) incorrect_count,COALESCE(st.assisted_count,0) assisted_count FROM sentences s LEFT JOIN sentence_states st ON st.sentence_id=s.id AND st.child_id=s.child_id WHERE s.child_id=? ORDER BY s.id", (child_id,)):
        item = dict(row)
        item["word_ids"] = [r[0] for r in db.execute("SELECT word_id FROM sentence_words WHERE sentence_id=? ORDER BY position", (row["id"],))]
        rows.append(item)
    if own: db.close()
    return rows


def practice_word(child_id: int, word_id: str, result: str, assisted: bool) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id)
        if db.execute("SELECT 1 FROM words WHERE id=? AND child_id=?", (word_id, child_id)).fetchone() is None: raise ValueError("word_not_found")
        if result not in {"correct", "incorrect"}: raise ValueError("result_must_be_correct_or_incorrect")
        db.execute("INSERT INTO word_attempts VALUES (?,?,?,?,?,?)", (uid("word_attempt"), child_id, word_id, result, int(assisted), now()))
        db.execute("""INSERT INTO word_states (child_id,word_id,correct_count,incorrect_count,assisted_count,updated_at) VALUES (?,?,?,?,?,?)
          ON CONFLICT(child_id,word_id) DO UPDATE SET correct_count=correct_count+excluded.correct_count,incorrect_count=incorrect_count+excluded.incorrect_count,assisted_count=assisted_count+excluded.assisted_count,updated_at=excluded.updated_at""", (child_id, word_id, int(result == "correct" and not assisted), int(result == "incorrect"), int(assisted), now()))
        return dict(db.execute("SELECT * FROM word_states WHERE child_id=? AND word_id=?", (child_id, word_id)).fetchone())


def practice_sentence(child_id: int, sentence_id: str, answer: str, assisted: bool) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id)
        sentence = db.execute("SELECT * FROM sentences WHERE id=? AND child_id=?", (sentence_id, child_id)).fetchone()
        if sentence is None: raise ValueError("sentence_not_found")
        correct = int(answer.strip() == sentence["sentence"])
        db.execute("INSERT INTO sentence_attempts VALUES (?,?,?,?,?,?,?)", (uid("sentence_attempt"), child_id, sentence_id, answer, correct, int(assisted), now()))
        db.execute("""INSERT INTO sentence_states VALUES (?,?,?,?,?,?)
          ON CONFLICT(child_id,sentence_id) DO UPDATE SET correct_count=correct_count+excluded.correct_count,incorrect_count=incorrect_count+excluded.incorrect_count,assisted_count=assisted_count+excluded.assisted_count,updated_at=excluded.updated_at""", (child_id, sentence_id, int(correct and not assisted), int(not correct), int(assisted), now()))
        return {"correct": bool(correct), "state": dict(db.execute("SELECT * FROM sentence_states WHERE child_id=? AND sentence_id=?", (child_id, sentence_id)).fetchone())}


def practice_writing(child_id: int, character: str, trace_result: str, assisted: bool, provider: str) -> dict[str, Any]:
    trace_result = provider_for(provider).validate(trace_result)
    with connect() as db:
        ensure_child(db, child_id)
        db.execute("INSERT INTO writing_attempts VALUES (?,?,?,?,?,?,?)", (uid("writing_attempt"), child_id, character, trace_result, int(assisted), provider, now()))
        db.execute("""INSERT INTO writing_states VALUES (?,?,?,?,?) ON CONFLICT(child_id,character) DO UPDATE SET independent_success_count=independent_success_count+excluded.independent_success_count,assisted_count=assisted_count+excluded.assisted_count,updated_at=excluded.updated_at""", (child_id, character, int(trace_result == "correct" and not assisted), int(assisted), now()))
        return dict(db.execute("SELECT * FROM writing_states WHERE child_id=? AND character=?", (child_id, character)).fetchone())


def list_readings(character: str | None = None, script: str | None = None, db: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    own = db is None; db = db or connect(); sql = "SELECT * FROM pronunciation_readings"; args: tuple[Any, ...] = ()
    filters = []
    if character: filters.append("character=?"); args += (character,)
    if script: filters.append("script=?"); args += (script,)
    if filters: sql += " WHERE " + " AND ".join(filters)
    rows = [dict(row) for row in db.execute(sql + " ORDER BY character,notation_system,id", args)]
    if own: db.close()
    return rows


def practice_pronunciation(child_id: int, reading_id: str, answer: str, assisted: bool, source_type: str = "SPRINT_B", school_queue_item_id: str | None = None, prompt_id: str | None = None) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id); reading = db.execute("SELECT * FROM pronunciation_readings WHERE id=?", (reading_id,)).fetchone()
        if reading is None: raise ValueError("reading_not_found")
        normalized_answer = normalize_pinyin(answer) if reading["notation_system"] == "PINYIN" else answer.strip().lower()
        normalized_target = normalize_pinyin(reading["notation"]) if reading["notation_system"] == "PINYIN" else reading["notation"].strip().lower()
        correct = int(normalized_answer == normalized_target)
        db.execute("INSERT INTO pronunciation_attempts (id,child_id,reading_id,answer,correct,assisted,source_type,school_queue_item_id,prompt_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", (uid("pron_attempt"), child_id, reading_id, answer, correct, int(assisted), source_type, school_queue_item_id, prompt_id, now()))
        db.execute("""INSERT INTO pronunciation_states (child_id,reading_id,correct_count,incorrect_count,assisted_count,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(child_id,reading_id) DO UPDATE SET correct_count=correct_count+excluded.correct_count,incorrect_count=incorrect_count+excluded.incorrect_count,assisted_count=assisted_count+excluded.assisted_count,updated_at=excluded.updated_at""", (child_id, reading_id, int(correct and not assisted), int(not correct), int(assisted), now()))
        return {"correct": bool(correct), "reading_id": reading_id, "normalized_answer": normalized_answer, "source_type": source_type, "school_queue_item_id": school_queue_item_id, "prompt_id": prompt_id, "state": dict(db.execute("SELECT * FROM pronunciation_states WHERE child_id=? AND reading_id=?", (child_id, reading_id)).fetchone())}


def create_school_pinyin_prompt(child_id: int, school_queue_item_id: str, reading_id: str | None = None, context: str | None = None) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id)
        item = db.execute("SELECT * FROM school_queue_items WHERE id=? AND child_id=?", (school_queue_item_id, child_id)).fetchone()
        if item is None: raise ValueError("school_queue_item_not_found")
        candidates = db.execute("SELECT * FROM pronunciation_readings WHERE character=? AND script='SIMPLIFIED' AND notation_system='PINYIN' ORDER BY context,id", (item["character"],)).fetchall()
        if not candidates: raise ValueError("simplified_pinyin_not_found")
        if reading_id:
            selected = [row for row in candidates if row["id"] == reading_id]
        elif context:
            selected = [row for row in candidates if row["context"] == context]
        else:
            selected = candidates if len(candidates) == 1 else []
        if len(selected) != 1: raise ValueError("pinyin_reading_ambiguous")
        reading = selected[0]
        prompt_id = f"school_pinyin_{school_queue_item_id}_{reading['id']}"
        db.execute("INSERT OR IGNORE INTO school_pinyin_prompts (id,child_id,school_queue_item_id,reading_id,prompted_character,source_name,provenance_status,private_content) VALUES (?,?,?,?,?,?,?,?)", (prompt_id, child_id, school_queue_item_id, reading["id"], item["character"], item["school_source"], item["provenance_status"], item["private_content"]))
        prompt = dict(db.execute("SELECT p.*,r.notation,r.context,r.script,r.notation_system FROM school_pinyin_prompts p JOIN pronunciation_readings r ON r.id=p.reading_id WHERE p.id=?", (prompt_id,)).fetchone())
        prompt["private_content"] = bool(prompt["private_content"])
        prompt["promotable_to_curriculum"] = False
        return prompt


def practice_school_pinyin(child_id: int, prompt_id: str, answer: str, assisted: bool) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id)
        prompt = db.execute("SELECT * FROM school_pinyin_prompts WHERE id=? AND child_id=?", (prompt_id, child_id)).fetchone()
        if prompt is None: raise ValueError("school_pinyin_prompt_not_found")
        result = practice_pronunciation(child_id, prompt["reading_id"], answer, assisted, "SCHOOL_QUEUE_PRIVATE", prompt["school_queue_item_id"], prompt_id)
        result["provenance_status"] = prompt["provenance_status"]
        result["private_content"] = bool(prompt["private_content"])
        result["promotable_to_curriculum"] = False
        return result


def list_grammar(db: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    own = db is None; db = db or connect()
    rows = [dict(row) for row in db.execute("SELECT e.*,c.concept,c.explanation,c.example,c.provenance_status,c.source_name,c.license_name FROM grammar_exercises e JOIN grammar_concepts c ON c.id=e.concept_id ORDER BY e.id")]
    if own: db.close()
    return rows


def practice_grammar(child_id: int, exercise_id: str, answer: str, assisted: bool) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id); exercise = db.execute("SELECT * FROM grammar_exercises WHERE id=?", (exercise_id,)).fetchone()
        if exercise is None: raise ValueError("exercise_not_found")
        correct = int(answer.strip() == exercise["answer_rule"])
        db.execute("INSERT INTO grammar_attempts (id,child_id,exercise_id,answer,correct,assisted,created_at) VALUES (?,?,?,?,?,?,?)", (uid("grammar_attempt"), child_id, exercise_id, answer, correct, int(assisted), now()))
        db.execute("""INSERT INTO grammar_states (child_id,exercise_id,correct_count,incorrect_count,assisted_count,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(child_id,exercise_id) DO UPDATE SET correct_count=correct_count+excluded.correct_count,incorrect_count=incorrect_count+excluded.incorrect_count,assisted_count=assisted_count+excluded.assisted_count,updated_at=excluded.updated_at""", (child_id, exercise_id, int(correct and not assisted), int(not correct), int(assisted), now()))
        return {"correct": bool(correct), "state": dict(db.execute("SELECT * FROM grammar_states WHERE child_id=? AND exercise_id=?", (child_id, exercise_id)).fetchone())}


def list_idioms(db: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    own = db is None; db = db or connect(); rows = [dict(row) for row in db.execute("SELECT * FROM idioms ORDER BY id")]
    if own: db.close()
    return rows


def practice_idiom(child_id: int, idiom_id: str, answer: str, assisted: bool) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id); idiom = db.execute("SELECT * FROM idioms WHERE id=?", (idiom_id,)).fetchone()
        if idiom is None: raise ValueError("idiom_not_found")
        correct = int(answer.strip() == idiom["meaning"])
        db.execute("INSERT INTO idiom_attempts (id,child_id,idiom_id,answer,correct,assisted,created_at) VALUES (?,?,?,?,?,?,?)", (uid("idiom_attempt"), child_id, idiom_id, answer, correct, int(assisted), now()))
        db.execute("""INSERT INTO idiom_states (child_id,idiom_id,correct_count,incorrect_count,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(child_id,idiom_id) DO UPDATE SET correct_count=correct_count+excluded.correct_count,incorrect_count=incorrect_count+excluded.incorrect_count,updated_at=excluded.updated_at""", (child_id, idiom_id, int(correct and not assisted), int(not correct), now()))
        return {"correct": bool(correct), "state": dict(db.execute("SELECT * FROM idiom_states WHERE child_id=? AND idiom_id=?", (child_id, idiom_id)).fetchone())}


def list_passages(child_id: int, db: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    own = db is None; db = db or connect(); ensure_child(db, child_id)
    rows = [dict(row) for row in db.execute("SELECT p.*,q.id question_id,q.prompt,q.answer_rule FROM reading_passages p JOIN reading_questions q ON q.passage_id=p.id WHERE p.child_id=? ORDER BY p.id", (child_id,))]
    if own: db.close()
    return rows


def submit_reading(child_id: int, passage_id: str, answers: dict[str, str]) -> dict[str, Any]:
    with connect() as db:
        ensure_child(db, child_id); passage = db.execute("SELECT 1 FROM reading_passages WHERE id=? AND child_id=?", (passage_id, child_id)).fetchone()
        if passage is None: raise ValueError("passage_not_found")
        questions = db.execute("SELECT id,answer_rule FROM reading_questions WHERE passage_id=? ORDER BY id", (passage_id,)).fetchall()
        correctness = {row["id"]: answers.get(row["id"]) == row["answer_rule"] for row in questions}; score = sum(correctness.values()); total = len(questions)
        answers_snapshot = {str(key): str(value) for key, value in answers.items()}
        correctness_snapshot = {key: bool(value) for key, value in correctness.items()}
        db.execute("INSERT INTO reading_attempts (id,child_id,passage_id,score,total,answers_json,correctness_json,created_at) VALUES (?,?,?,?,?,?,?,?)", (uid("reading_attempt"), child_id, passage_id, score, total, json.dumps(answers_snapshot, ensure_ascii=False, sort_keys=True), json.dumps(correctness_snapshot, sort_keys=True), now()))
        db.execute("""INSERT INTO reading_states (child_id,passage_id,correct_count,incorrect_count,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(child_id,passage_id) DO UPDATE SET correct_count=correct_count+excluded.correct_count,incorrect_count=incorrect_count+excluded.incorrect_count,updated_at=excluded.updated_at""", (child_id, passage_id, score, total-score, now()))
        return {"passage_id": passage_id, "correctness": correctness, "answers": answers_snapshot, "score": score, "total": total}
