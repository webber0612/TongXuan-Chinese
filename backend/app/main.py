from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .database import connect, initialize_database
from .providers import OpenCCProvider
from .learning import (
    add_school_item, create_child, create_weekly_test, finish_session,
    list_children, list_daily_queue, next_recognition_item, points_summary,
    record_attempt, redeem_reward, seed_learning_items, start_session,
    submit_weekly_test,
)
from .sprint_b import (
    list_grammar, list_idioms, list_passages, list_readings, list_sentences, list_words,
    practice_grammar, practice_idiom, practice_pronunciation, practice_school_pinyin, practice_sentence, practice_word, practice_writing,
    create_school_pinyin_prompt,
    seed_sprint_b, submit_reading,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="TongXuan Chinese API", version="0.1.0", lifespan=lifespan)
opencc_provider = OpenCCProvider()


class ConversionRequest(BaseModel):
    text: str = Field(min_length=1)
    direction: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/tools/convert")
def convert(request: ConversionRequest) -> dict[str, str]:
    try:
        converted = opencc_provider.convert(request.text, request.direction)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {"text": converted, "direction": request.direction}


@app.post("/api/diagnostics/sqlite")
def sqlite_diagnostic() -> dict[str, object]:
    name = "Phase 0 diagnostic child"
    with connect() as connection:
        cursor = connection.execute("INSERT INTO children (name) VALUES (?)", (name,))
        child_id = cursor.lastrowid
        created = connection.execute("SELECT name FROM children WHERE id = ?", (child_id,)).fetchone()
        connection.execute("UPDATE children SET name = ? WHERE id = ?", (name + " updated", child_id))
        updated = connection.execute("SELECT name FROM children WHERE id = ?", (child_id,)).fetchone()
        connection.execute("DELETE FROM children WHERE id = ?", (child_id,))
        deleted = connection.execute("SELECT 1 FROM children WHERE id = ?", (child_id,)).fetchone()
        connection.execute(
            "INSERT INTO diagnostic_events (name, status, details) VALUES (?, ?, ?)",
            ("sqlite-crud", "PASS", "create/read/update/delete"),
        )
    return {
        "status": "ok",
        "operations": {
            "create": child_id is not None,
            "read": created is not None and created["name"] == name,
            "update": updated is not None and updated["name"].endswith(" updated"),
            "delete": deleted is None,
        },
    }


class ChildRequest(BaseModel):
    name: str = Field(min_length=1)


class SeedRequest(BaseModel):
    characters: list[str] | None = None


class AttemptRequest(BaseModel):
    item_id: str
    result: str
    assisted: bool = False
    source_queue: str = "CURRICULUM"
    response_metadata: dict[str, object] = {}


class SchoolQueueRequest(BaseModel):
    character: str = Field(min_length=1)
    school_source: str = Field(min_length=1)
    due_date: str | None = None
    priority: int = 0
    notes: str = ""
    private_content: bool = True
    provenance_status: str = "PRIVATE_OK"


class WeeklySubmitRequest(BaseModel):
    answers: dict[str, str]


class SkillAttemptRequest(BaseModel):
    result: str = "correct"
    assisted: bool = False


class WritingAttemptRequest(BaseModel):
    trace_result: str
    assisted: bool = False
    provider: str = "HANZI_WRITER"


class AnswerRequest(BaseModel):
    answer: str
    assisted: bool = False


@app.get("/api/children")
def get_children() -> list[dict[str, object]]:
    return list_children()


@app.post("/api/children")
def post_child(request: ChildRequest) -> dict[str, object]:
    return create_child(request.name)


@app.post("/api/children/{child_id}/learning-items/seed")
def post_seed(child_id: int, request: SeedRequest) -> dict[str, object]:
    try:
        return {"items": seed_learning_items(child_id, request.characters)}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/recognition/sessions")
def post_session(child_id: int) -> dict[str, object]:
    try:
        return start_session(child_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/recognition/sessions/{session_id}/next")
def get_next(session_id: str, child_id: int) -> dict[str, object]:
    try:
        item = next_recognition_item(child_id, session_id)
        return {"item": item}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/recognition/sessions/{session_id}/attempts")
def post_attempt(session_id: str, child_id: int, request: AttemptRequest) -> dict[str, object]:
    try:
        return record_attempt(child_id, session_id, request.item_id, request.result, request.assisted, request.source_queue, request.response_metadata)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/recognition/sessions/{session_id}/complete")
def post_session_complete(session_id: str, child_id: int) -> dict[str, object]:
    try:
        return finish_session(child_id, session_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/daily-queue")
def get_daily_queue(child_id: int) -> list[dict[str, object]]:
    try:
        return list_daily_queue(child_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/school-queue")
def post_school_queue(child_id: int, request: SchoolQueueRequest) -> dict[str, object]:
    try:
        return add_school_item(child_id, request.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/sprint-b/seed")
def post_sprint_b_seed(child_id: int) -> dict[str, object]:
    try:
        return seed_sprint_b(child_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/sprint-b/words")
def get_words(child_id: int) -> list[dict[str, object]]:
    try: return list_words(child_id)
    except ValueError as error: raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/sprint-b/sentences")
def get_sentences(child_id: int) -> list[dict[str, object]]:
    try: return list_sentences(child_id)
    except ValueError as error: raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/sprint-b/words/{word_id}/attempts")
def post_word_attempt(word_id: str, child_id: int, request: SkillAttemptRequest) -> dict[str, object]:
    try: return practice_word(child_id, word_id, request.result, request.assisted)
    except ValueError as error: raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/sprint-b/sentences/{sentence_id}/attempts")
def post_sentence_attempt(sentence_id: str, child_id: int, request: AnswerRequest) -> dict[str, object]:
    try: return practice_sentence(child_id, sentence_id, request.answer, request.assisted)
    except ValueError as error: raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/sprint-b/writing/attempts")
def post_writing_attempt(child_id: int, character: str, request: WritingAttemptRequest) -> dict[str, object]:
    try: return practice_writing(child_id, character, request.trace_result, request.assisted, request.provider)
    except ValueError as error: raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/sprint-b/pronunciation")
def get_pronunciation(character: str | None = None, script: str | None = None) -> list[dict[str, object]]:
    return list_readings(character, script)


@app.post("/api/sprint-b/pronunciation/{reading_id}/attempts")
def post_pronunciation_attempt(reading_id: str, child_id: int, request: AnswerRequest) -> dict[str, object]:
    try: return practice_pronunciation(child_id, reading_id, request.answer, request.assisted)
    except ValueError as error: raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/sprint-b/pinyin/school-queue/{school_queue_item_id}")
def post_school_pinyin_prompt(school_queue_item_id: str, child_id: int) -> dict[str, object]:
    try: return create_school_pinyin_prompt(child_id, school_queue_item_id)
    except ValueError as error: raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/sprint-b/pinyin/prompts/{prompt_id}/attempts")
def post_school_pinyin_attempt(prompt_id: str, child_id: int, request: AnswerRequest) -> dict[str, object]:
    try: return practice_school_pinyin(child_id, prompt_id, request.answer, request.assisted)
    except ValueError as error: raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/sprint-b/grammar")
def get_grammar() -> list[dict[str, object]]:
    return list_grammar()


@app.post("/api/sprint-b/grammar/{exercise_id}/attempts")
def post_grammar_attempt(exercise_id: str, child_id: int, request: AnswerRequest) -> dict[str, object]:
    try: return practice_grammar(child_id, exercise_id, request.answer, request.assisted)
    except ValueError as error: raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/sprint-b/idioms")
def get_idioms() -> list[dict[str, object]]:
    return list_idioms()


@app.post("/api/sprint-b/idioms/{idiom_id}/attempts")
def post_idiom_attempt(idiom_id: str, child_id: int, request: AnswerRequest) -> dict[str, object]:
    try: return practice_idiom(child_id, idiom_id, request.answer, request.assisted)
    except ValueError as error: raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/sprint-b/reading/passages")
def get_reading_passages(child_id: int) -> list[dict[str, object]]:
    try: return list_passages(child_id)
    except ValueError as error: raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/sprint-b/reading/passages/{passage_id}/attempts")
def post_reading_attempt(passage_id: str, child_id: int, request: WeeklySubmitRequest) -> dict[str, object]:
    try: return submit_reading(child_id, passage_id, request.answers)
    except ValueError as error: raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/weekly-tests")
def post_weekly_test(child_id: int) -> dict[str, object]:
    try:
        return create_weekly_test(child_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/weekly-tests/{test_id}/submit")
def post_weekly_submit(test_id: str, child_id: int, request: WeeklySubmitRequest) -> dict[str, object]:
    try:
        return submit_weekly_test(child_id, test_id, request.answers)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/points")
def get_points(child_id: int) -> dict[str, object]:
    try:
        return points_summary(child_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/points/redeem/{reward_id}")
def post_redeem(reward_id: str, child_id: int) -> dict[str, object]:
    try:
        return redeem_reward(child_id, reward_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
