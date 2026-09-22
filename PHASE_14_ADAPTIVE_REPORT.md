# Phase 14 — Adaptive Learning Report

## Scope

Implemented only Phase 14 Adaptive Learning from GitHub Issue #13. Phase 15 Parent Dashboard has not started.

## Architecture

- Added `backend/app/adaptive.py` as a separate deterministic adaptive queue service.
- `POST /api/adaptive/plan` requires an explicit `as_of`, bounded `limit`, adaptive flag, and optional
  current-plan source preference.
- SQLite remains authoritative. Plan generation reads existing Curriculum, School Queue, Review/Wrong
  Answer, and recognition attempt/state data only.
- Adaptive output preserves `child_id`, `source`, `source_id`, `skill`, source detail, reasons, and
  named score components for audit/replay.
- Centralized explicit weights cover overdue, recent incorrect, assisted, low independent success,
  repeated misses, staleness, School Queue urgency, review reason, and curriculum novelty.

## Determinism and integrity

- Fixed `as_of` is normalized to UTC and used for all candidate/state/attempt filtering.
- Attempts or state updates after `as_of` cannot influence the earlier plan.
- The same authoritative state and `as_of` produce the same ordering and components.
- Adaptive planning never writes mastery, attempts, points, rewards, School Queue completion, OCR,
  or Reading Aloud metadata.
- Child-scoped queries prevent sibling data from entering another child's plan.

## Anti-starvation and overrides

- Adaptive ranking performs a source representation pass and applies a per-source cap so Curriculum,
  School Queue, and Review cannot be permanently starved when candidates exist.
- Parent-facing controls support refresh/recompute, source preference for the current plan, and an
  adaptive-off deterministic fallback.
- Overrides affect only the returned plan and never permanently mutate learning state.

## Learner surface

- Added a minimal Phase 14 card showing explicit `as_of`, ordered items, source, skill, score, and
  human-readable reasons.
- Viewing or reordering the plan performs no hidden mastery mutation request.

## Verification

- Backend: `47 passed, 40 warnings` with `PYTHONPATH=backend` and the project virtual environment.
- Frontend: `15 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes deterministic replay, explicit as-of semantics, no look-ahead,
  overdue/recent-error/assisted/novelty priority, School Queue urgency, anti-starvation, child
  isolation, source/skill provenance, score composition, manual fallback/preference, and no mutation.

## Manual validation outstanding

- Whether the weights are educationally optimal.
- Real-child engagement and pacing.
- Parent usability.
- iPad/Synology field behavior.

These are not claimed as automated PASS results.

## Delivery

- Dedicated branch: `phase14/adaptive-learning`.
- Draft PR targets `main`.
- Do not mark Ready for review or merge automatically.
- Do not start Phase 15.
