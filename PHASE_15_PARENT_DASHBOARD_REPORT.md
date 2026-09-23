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
  Aloud remain separate dimensions. Reading Aloud is process activity only: completed/aborted
  status, duration, locale, text kind, and metadata do not become correctness or mastery.
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
- OCR confirmation is an auditable `confirmed_at` event. Historical reports replay candidate
  versus confirmed state and hide future confirmed text, locale, script, and School Queue links.
- Reading Aloud lifecycle is reconstructed from `started_at`, `completed_at`, and `aborted_at`;
  future completion/abort state is not visible before the report end.

## Privacy and mutation boundary

- Dashboard endpoint is GET-only and does not create attempts, alter mastery, complete queue items,
  change adaptive preferences, award/redeem points, or mutate OCR/Reading Aloud metadata.
- No raw image bytes, audio bytes, external analytics, telemetry, or cloud export was added.
- Child selection is explicit and all queries are filtered by the selected child.
- Weekly score history includes only immutable completed tests and uses `completed_at`; pending
  tests are exposed separately.
- Review backlog is active as of the report end and is not restricted to items created inside the
  selected activity window.

## Verification

- Backend: `59 passed` with `PYTHONPATH=backend`.
- Frontend: `18 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes child isolation, 7/30/all-time windows, event-based historical
  counts, correct/incorrect/assisted separation, Reading Aloud non-mastery activity, completed
  Weekly Test history, historical Review backlog, per-skill separation, read-only behavior, and
  actual DashboardPage child/window/section/refresh/GET-only behavior.

## Architect Audit resolution

- AUD-T15-01: Reading Aloud completed/aborted status is activity-only and contributes zero to
  correctness, independent-correct, and incorrect totals.
- AUD-T15-02: Weekly score history and recent score use completed immutable tests by `completed_at`;
  pending tests are separate.
- AUD-T15-03: Initial dashboard child selection is synchronized before the first report load.
- AUD-T15-04: DashboardPage regression tests exercise the rendered page, switching, sections,
  refresh, and GET-only/no-mutation behavior.
- AUD-T15-05: Review backlog is evaluated active as-of report end, independent of creation window.
- AUD-T15-06: OCR confirmation records auditable `confirmed_at`; the dashboard replays candidate /
  confirmed state as of report end and prevents future confirmed fields or School Queue links from
  appearing in earlier reports.
- AUD-T15-07: Reading Aloud records auditable `aborted_at`; the dashboard reconstructs STARTED /
  COMPLETED / ABORTED from lifecycle timestamps as of report end. Regression tests cover T1 start,
  T3 complete or abort, and T2/T4 historical queries.

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
