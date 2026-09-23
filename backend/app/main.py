from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .database import connect, initialize_database
from .providers import OpenCCProvider
from .tts import prepare_tts
from .reading_aloud import abort_attempt, complete_attempt, start_attempt
from .ocr_import import confirm_candidate, create_candidate
from .adaptive import build_adaptive_plan
from .dashboard import build_dashboard
from .curriculum import get_curriculum, record_progress, seed_catalog
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


class SchoolPinyinPromptRequest(BaseModel):
    reading_id: str | None = None
    context: str | None = None


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    locale: str
    text_kind: str
    rate: float = Field(default=1.0, ge=0.5, le=2.0)
    child_id: int | None = None
    school_queue_item_id: str | None = None
    source_type: str = "TRANSIENT_TEXT"
    provenance_status: str | None = None


class ReadingAloudStartRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    text_kind: str
    locale: str
    source_type: str = "TRANSIENT_TEXT"
    source_id: str | None = None
    assisted: bool = False
    manual_review: bool = False


class ReadingAloudCompleteRequest(BaseModel):
    duration_ms: int | None = Field(default=None, ge=0, le=3_600_000)


class OCRCandidateRequest(BaseModel):
    image_name: str = Field(min_length=1, max_length=255)
    source_label: str = Field(min_length=1, max_length=255)
    provider_id: str = "local-deterministic-ocr"
    candidate_hint: str = Field(default="", max_length=5000)


class OCRConfirmRequest(BaseModel):
    confirmed_text: str = Field(min_length=1, max_length=5000)
    locale: str
    script: str


class AdaptivePlanRequest(BaseModel):
    as_of: str
    limit: int = Field(default=10, ge=1, le=50)
    adaptive: bool = True
    preference: str | None = None


class CurriculumItemRequest(BaseModel):
    id: str | None = None
    item_type: str = Field(min_length=1)
    content: str = Field(min_length=1)
    sequence: int = Field(ge=0)
    source_name: str = Field(min_length=1)
    source_url: str = ""
    license_name: str = Field(min_length=1)
    provenance_status: str = "PRIVATE_OK"
    commercial_ready: bool = False
    commercial_action: str = ""


class CurriculumUnitRequest(BaseModel):
    id: str | None = None
    title: str = Field(min_length=1)
    sequence: int = Field(ge=0)
    source_name: str = Field(min_length=1)
    source_url: str = ""
    license_name: str = Field(min_length=1)
    provenance_status: str = "PRIVATE_OK"
    commercial_ready: bool = False
    commercial_action: str = ""
    items: list[CurriculumItemRequest]


class CurriculumLevelRequest(BaseModel):
    id: str | None = None
    title: str = Field(min_length=1)
    sequence: int = Field(ge=0)
    source_name: str = Field(min_length=1)
    source_url: str = ""
    license_name: str = Field(min_length=1)
    provenance_status: str = "PRIVATE_OK"
    commercial_ready: bool = False
    commercial_action: str = ""
    units: list[CurriculumUnitRequest]


class CurriculumCatalogRequest(BaseModel):
    levels: list[CurriculumLevelRequest]


class CurriculumProgressRequest(BaseModel):
    status: str
    event_at: str | None = None


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


@app.post("/api/curriculum/catalog")
def post_curriculum_catalog(request: CurriculumCatalogRequest) -> dict[str, object]:
    try:
        return seed_catalog([level.model_dump() for level in request.levels])
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/curriculum")
def get_shared_curriculum(as_of: str | None = None) -> dict[str, object]:
    try:
        return get_curriculum(levels=None, child_id=None, as_of=as_of)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/children/{child_id}/curriculum")
def get_child_curriculum(child_id: int, as_of: str | None = None) -> dict[str, object]:
    try:
        return get_curriculum(levels=None, child_id=child_id, as_of=as_of)
    except ValueError as error:
        raise HTTPException(status_code=400 if str(error).startswith("invalid_") else 404, detail=str(error)) from error


@app.post("/api/children/{child_id}/curriculum/items/{item_id}/progress")
def post_curriculum_progress(child_id: int, item_id: str, request: CurriculumProgressRequest) -> dict[str, object]:
    try:
        return record_progress(child_id=child_id, item_id=item_id, status=request.status, event_at=request.event_at)
    except ValueError as error:
        raise HTTPException(status_code=400 if str(error).startswith(("invalid_", "progress_")) else 404, detail=str(error)) from error


@app.post("/api/tts/speak")
def post_tts(request: TTSRequest) -> dict[str, object]:
    try:
        return prepare_tts(
            text=request.text,
            locale=request.locale,
            text_kind=request.text_kind,
            rate=request.rate,
            child_id=request.child_id,
            school_queue_item_id=request.school_queue_item_id,
            source_type=request.source_type,
            provenance_status=request.provenance_status,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/reading-aloud/attempts/start")
def post_reading_aloud_start(child_id: int, request: ReadingAloudStartRequest) -> dict[str, object]:
    try:
        return start_attempt(child_id=child_id, text=request.text, text_kind=request.text_kind, locale=request.locale, source_type=request.source_type, source_id=request.source_id, assisted=request.assisted, manual_review=request.manual_review)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/reading-aloud/attempts/{attempt_id}/complete")
def post_reading_aloud_complete(attempt_id: str, child_id: int, request: ReadingAloudCompleteRequest) -> dict[str, object]:
    try:
        return complete_attempt(child_id=child_id, attempt_id=attempt_id, duration_ms=request.duration_ms)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/reading-aloud/attempts/{attempt_id}/abort")
def abort_reading_aloud_attempt(attempt_id: str, child_id: int) -> dict[str, object]:
    try:
        return abort_attempt(child_id=child_id, attempt_id=attempt_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/ocr/imports/candidate")
def post_ocr_candidate(child_id: int, request: OCRCandidateRequest) -> dict[str, object]:
    try:
        return create_candidate(child_id=child_id, image_name=request.image_name, source_label=request.source_label, provider_id=request.provider_id, candidate_hint=request.candidate_hint)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/ocr/imports/{import_id}/confirm")
def post_ocr_confirm(import_id: str, child_id: int, request: OCRConfirmRequest) -> dict[str, object]:
    try:
        return confirm_candidate(child_id=child_id, import_id=import_id, confirmed_text=request.confirmed_text, locale=request.locale, script=request.script)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/adaptive/plan")
def post_adaptive_plan(child_id: int, request: AdaptivePlanRequest) -> dict[str, object]:
    try:
        return build_adaptive_plan(child_id=child_id, as_of=request.as_of, limit=request.limit, adaptive=request.adaptive, preference=request.preference)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/dashboard")
def get_parent_dashboard(
    child_id: int,
    window: str = "7d",
    from_at: str | None = None,
    to_at: str | None = None,
    adaptive_limit: int = 5,
) -> dict[str, object]:
    try:
        return build_dashboard(child_id=child_id, window=window, from_at=from_at, to_at=to_at, adaptive_limit=adaptive_limit)
    except ValueError as error:
        raise HTTPException(status_code=400 if str(error).startswith("invalid_") else 404, detail=str(error)) from error


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
def post_school_pinyin_prompt(school_queue_item_id: str, child_id: int, request: SchoolPinyinPromptRequest | None = None) -> dict[str, object]:
    try: return create_school_pinyin_prompt(child_id, school_queue_item_id, request.reading_id if request else None, request.context if request else None)
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
