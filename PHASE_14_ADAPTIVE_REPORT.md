# Phase 14 — Adaptive Learning Report

## Scope

Implemented only Phase 14 Adaptive Learning from GitHub Issue #13. Phase 15 Parent Dashboard has not started.

## Architecture

- Added `backend/app/adaptive.py` as a separate deterministic adaptive queue service.
- `POST /api/adaptive/plan` requires an explicit `as_of`, bounded `limit`, adaptive flag, and optional
  current-plan source preference.
- SQLite remains authoritative. Plan generation reads existing Curriculum, School Queue, Review/Wrong
  Answer, and the existing Word, Sentence, Writing, Pronunciation, Grammar, Idiom, Reading, and
  Reading Aloud content/state domains without merging their mastery.
- Adaptive output preserves `child_id`, `source`, `source_id`, `skill`, source detail, reasons, and
  named score components for audit/replay.
- Centralized explicit weights cover overdue, recent incorrect, assisted, low independent success,
  repeated misses, staleness, School Queue urgency, review reason, curriculum novelty, parent
  preference, source representation, and cross-skill representation.
- School and Review membership now has lifecycle timestamps (`completed_at` / `deactivated_at`)
  and is evaluated as-of; a historical plan retains items that were completed/deactivated later.
- Every adaptive-visible content domain now carries `created_at` and is filtered with
  `created_at <= as_of`. Existing rows are backfilled at migration time with their migration-time
  effective timestamp; future content therefore cannot enter an earlier replay.
- `recent_error` is derived only from incorrect events whose own event timestamps fall within the
  recent window. Old incorrect events followed by a recent correct event do not trigger it.

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
- A cross-skill representation pass and explainable `skill_balance` component prevent weaker existing
  domains from being permanently starved; final ordering uses the returned `ranking_score` whose
  components include every preference/source/skill adjustment.
- Word, Sentence, Writing, Pronunciation, Grammar, Idiom, and Reading states are reconstructed from
  timestamped attempts through `as_of` for independent correct, incorrect, assisted, and latest;
  current cumulative state rows are used only for time-versioned due metadata where applicable.
- Parent-facing controls support refresh/recompute, source preference for the current plan, and an
  adaptive-off deterministic fallback.
- Overrides affect only the returned plan and never permanently mutate learning state.

## Learner surface

- Added a minimal Phase 14 card showing explicit `as_of`, ordered items, source, skill, score, and
  human-readable reasons.
- Viewing or reordering the plan performs no hidden mastery mutation request.

## Verification

- Backend: `52 passed` with `PYTHONPATH=backend`.
- Frontend: `15 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes deterministic replay, explicit as-of semantics, no look-ahead,
  historical School/Review lifecycle membership, recent-error event filtering, overdue/assisted/
  novelty priority, School Queue urgency, source and cross-skill anti-starvation, child isolation,
  source/skill provenance, score composition for all ranking adjustments, manual fallback/preference,
  no mutation, T1/T3 state replay queried at T2, and T2-created content excluded from T1 plans.

### Architect Audit resolution

- AUD-T14-01: resolved with auditable School/Review lifecycle timestamps and historical replay tests.
- AUD-T14-02: resolved with explicit preference/source/skill score components and ranking-score tests.
- AUD-T14-03: resolved by filtering only recent incorrect events, with old-error/recent-correct coverage.
- AUD-T14-04: resolved with independent multi-skill candidates and cross-skill anti-starvation tests.
- AUD-T14-05: resolved with created/effective timestamps and `created_at <= as_of` filtering for all
  adaptive-visible content.
- AUD-T14-06: resolved by rebuilding non-Recognition state from timestamped attempts through `as_of`.
- AUD-T14-07: resolved by deriving novelty/low-independent components from the reconstructed history.

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
