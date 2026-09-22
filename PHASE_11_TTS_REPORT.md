# Phase 11 — TTS Report

## Scope

Implemented only Phase 11 Text-to-Speech. Phase 12 work is not started.

## Architecture

- Added a backend `TTSProvider` protocol and locale registry in `backend/app/tts.py`.
- Supported locales are explicitly routed as `zh-TW` and `zh-CN`.
- The current provider is a replaceable browser SpeechSynthesis adapter; the backend returns
  a transient playback payload rather than generating or storing an audio file.
- Supported payload kinds: `character`, `word`, `sentence`, and `passage`.
- Rate is validated deterministically in the range `0.5`–`2.0`.
- TTS has no calls into Recognition, Writing, Reading, Pronunciation, Words, Grammar, or Idiom
  mastery/state services.

## Frontend

- Added `BrowserSpeechSynthesisProvider` in `frontend/src/lib/tts.ts`.
- Added a minimal Phase 11 playback surface with `zh-TW` / `zh-CN` selection, speed control,
  stop control, and play buttons for recognition characters, words, sentences, and passages.
- Playback is transient browser speech only; no permanent audio file is saved.

## School Queue and privacy

- TTS can receive a School Queue item reference and returns its private provenance metadata.
- The service verifies child ownership and does not change, promote, or duplicate the School Queue
  item. No child learning state is written.

## Tests and build

- Backend: `30 passed` with `PYTHONPATH=backend` and the project virtual environment.
- Frontend: `4 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Coverage includes locale routing, all four payload kinds, rate, invalid input, no mastery/state
  mutation, child boundary, and School Queue private provenance preservation.

## Explicit exclusions

- No recording evaluation, ASR, reading-aloud scoring, or Phase 12 behavior.
- No permanent audio storage.
- No TTS-derived mastery, scoring, or progress updates.

## Delivery

- Draft PR targets `main`.
- Do not mark Ready for review or merge this Phase 11 PR automatically.
