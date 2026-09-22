# Fast Track Sprint A — Phase 1–4 Report

## Scope

Implemented only the Issue #4 Sprint A scope: Recognition MVP, School Queue, Weekly Test + Scoring, and Points + Rewards. Phase 5+ remains unimplemented.

## Phase checkpoints

### Phase 1 — Recognition MVP

- Added child-scoped learning items, sessions, attempts, and recognition state.
- Correct, incorrect, and assisted answers are persisted separately.
- Assisted answers do not increase recognition mastery counts.
- Deterministic scheduler selects due items by due time and stable item ID.

### Phase 2 — School Queue

- Added a separate school queue table and API.
- Daily Queue presents School Queue, Curriculum, and future Review sources with source labels preserved.
- School items carry private-content and provenance/status markers and never enter curriculum rows.
- Deterministic ordering uses priority, due date, and stable ID.

### Phase 3 — Weekly Test + Scoring

- Added reproducible test blueprints with explicit item IDs.
- Stored submitted answers, per-item correctness, score, timestamps, and missed items.
- Weekly Test attempts remain separate from Recognition attempts.

### Phase 4 — Points + Reward System

- Added append-only points ledger with unique idempotency keys.
- Session completion and Weekly Test completion issue bounded deterministic points.
- Added minimal reward catalog, balance checks, and redemption ledger entries.
- Points never participate in recognition mastery calculations.

## Architecture and schema

- SQLite remains authoritative.
- Domain/service behavior lives in `backend/app/learning.py`; FastAPI handlers remain thin.
- Frontend is a minimal family UI for child selection, recognition, Daily Queue, School Queue, Weekly Test, and rewards.
- `learning_items` sample content is marked `LICENSE_REVIEW_REQUIRED` and not commercial-ready.

## Tests and build

- Backend: `11 passed` with `backend/.venv` and `PYTHONPATH=backend`.
- Frontend: `4 passed` with Vitest.
- Production frontend build: passed; PWA assets generated.
- Phase 0 tests remain green.

## Manual validation remaining

- Real iPad Safari interaction, microphone, speech, and PWA installation.
- Synology DS723+ deployment and persistent-volume restart.
- Real-child usability and parent workflow validation.

## Privacy and licensing

- All learning, attempt, queue, test, points, and reward records are child-scoped.
- School Queue content is private/non-promotable by default.
- No new external dependency or public curriculum content was introduced.

## Delivery

- Branch: `sprint/phase1-4`
- Draft PR: to be opened after final verification
- Implementation head: recorded in the final delivery message
- Phase 5: not started
