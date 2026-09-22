# Phase 12 — Reading Aloud Report

## Scope

Implemented only Phase 12 Reading Aloud from GitHub Issue #9. Phase 13 OCR has not started.

## Architecture

- Added `backend/app/reading_aloud.py` as the authoritative Reading Aloud attempt metadata boundary.
- Added `reading_aloud_attempts` with child ownership, source type/id, exact text snapshot,
  text kind, locale, timestamps, duration, assisted/manual-review flags, and provenance metadata.
- Source-bound attempts validate child ownership, exact authoritative source text, and School Queue
  script/locale consistency. Private School Queue provenance cannot be borrowed by unrelated text.
- Reading Aloud never updates Recognition, Writing, silent Reading, Pronunciation, Pinyin, Words,
  Grammar, or Idiom mastery/state.

## Recording privacy

- Added `BrowserMediaRecorderAdapter` behind a frontend adapter boundary.
- Microphone permission is explicit through `getUserMedia({ audio: true })`.
- Start, stop, replay, and delete/reset are supported in the browser session.
- Raw audio remains a transient browser `Blob` only. No audio blob/base64 column, upload endpoint,
  third-party speech provider, server/NAS storage, or persistence claim was added.
- Reference TTS remains a separate Phase 11 provider/data path.

## Learner surface

- Added a minimum Reading Aloud card with target text, text kind, Traditional/Simplified locale,
  reference listen, start/stop recording, replay, delete/reset, permission/error status, and
  completion status.
- No pronunciation-quality score, ASR result, LLM score, or mastery update is inferred from
  recording completion.

## Verification

- Backend: `36 passed, 37 warnings` with `PYTHONPATH=backend` and the project virtual environment.
- Frontend: `9 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes lifecycle metadata, child/source ownership, exact source-text
  binding, locale mismatch rejection, no audio persistence, no mastery mutation, MediaRecorder
  permission/start/stop/replay/delete behavior, unavailable or denied microphone errors, and
  independent Phase 11 TTS routing.

## Manual validation outstanding

- Real iPad Safari microphone permission and MediaRecorder compatibility.
- Actual voice playback quality.
- Synology deployment and network behavior.

These are not claimed as automated PASS results.

## Delivery

- Dedicated branch: `phase12/reading-aloud`.
- Draft PR targets `main`.
- Do not mark Ready for review or merge automatically.
- Do not start Phase 13.
