# Phase 15 — Parent Dashboard Report

## Scope

Implemented only the read-only Parent Dashboard work order from GitHub Issue #15.
Phase 16 Long-term Curriculum was not started.

## Architecture

- Added `backend/app/dashboard.py` as a separate read-model service. SQLite remains authoritative;
  no dashboard snapshot or mutable reporting store was added.
- Added `GET /api/dashboard` with explicit child scope and `7d`, `30d`, `all`, or explicit
  `from_at` / `to_at` windows.
- All activity and skill summaries are rebuilt from timestamped attempt/event rows. Current
  cumulative mastery/state rows are not used to infer historical activity.
- Recognition, Writing, Word, Sentence, Pronunciation, Grammar, Idiom, Reading, and Reading
  Aloud remain separate dimensions. No overall mastery score is generated.
- School Queue lifecycle is evaluated against the report end timestamp. Private-content and
  provenance fields remain visible.
- Adaptive summary is requested on demand through the existing deterministic service and preserves
  source, skill, score, and reasons.

## Dashboard sections

- Recent activity: attempts, correct/incorrect, assisted, School Queue, Review, Adaptive summary.
- Per-skill independent correct, correct, incorrect, assisted, latest practice, distinct items,
  and daily trend counts.
- School Queue active/completed/due items with source, private flag, and provenance status.
- Weekly test history and missed item identifiers.
- Points balance, event ledger, and reward redemptions.
- Reading Aloud completed/aborted counts and non-audio metadata only.
- OCR candidate/confirmed counts with source, locale/script, provenance link, and commercial flag.

## Privacy and mutation boundary

- Dashboard endpoint is GET-only and does not create attempts, alter mastery, complete queue items,
  change adaptive preferences, award/redeem points, or mutate OCR/Reading Aloud metadata.
- No raw image bytes, audio bytes, external analytics, telemetry, or cloud export was added.
- Child selection is explicit and all queries are filtered by the selected child.

## Verification

- Backend: `55 passed` with `PYTHONPATH=backend`.
- Frontend: `17 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes child isolation, 7/30/all-time windows, event-based historical
  counts, correct/incorrect/assisted separation, per-skill separation, read-only behavior, and
  UI request/window contracts.

## Manual validation outstanding

- Parent comprehension and educational usefulness.
- Real iPad layout and interaction.
- Synology performance under long-term data volume.

These are not claimed as automated PASS results.

## Delivery

- Branch: `phase15/parent-dashboard`.
- Draft PR targets `main`.
- Do not mark Ready for review or merge automatically.
- Do not start Phase 16.
