# Phase 16 — Long-Term Curriculum Report

## Scope

Implemented the deterministic long-term curriculum foundation from the Phase 16 Work Order,
starting at merged main `8d4b007`. Phase 17, AI Tutor, commercialization, and unrelated refactors
were not started.

## Architecture

- Added shared `curriculum_levels` → `curriculum_units` → `curriculum_items` hierarchy with
  explicit sequence ordering and `created_at` visibility boundaries.
- Every hierarchy level stores `source_name`, `source_url`, `license_name`,
  `provenance_status`, `commercial_ready`, and `commercial_action`.
- Added append-only child-scoped `curriculum_progress_events`; progression is a read-model concern
  and has no skill/mastery column or write path into existing skill state tables.
- Added deterministic catalog seed, shared catalog read, child-scoped as-of read, and progress
  event endpoints.
- Curriculum content is independent from `school_queue_items`; catalog seed and progress never
  promote content into School Queue.
- Added `/curriculum` frontend view with child selection, hierarchy, provenance/license display,
  and progression summary.

## Verification

- Backend: `68 passed` with `PYTHONPATH=backend`.
- Frontend: `21 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes level/unit/item ordering, provenance/license fields, child
  isolation, `created_at`/as-of filtering, append-only progress history, no School Queue
  promotion, and independent existing skill state.

## Architect Audit Resolution

- AUD-T16-01: Progress events reject timestamps before the curriculum item's `created_at`;
  regression coverage exercises T1 creation, T2 rejected event/read, T3 valid event, and T4 read.
- AUD-T16-02: Curriculum GET paths do not invoke database initialization or migrations; schema
  metadata and schema version remain unchanged in the no-mutation regression test.
- AUD-T16-03: The rendered `CurriculumPage` regression covers child switching, refresh, hierarchy,
  as-of display, provenance/license rendering, and GET-only requests.
- AUD-T16-04: Curriculum reads defensively ignore persisted progress events whose `event_at` is
  before the item's `created_at`; direct database insertion coverage verifies a T2 invalid event
  cannot mark a T3-created item completed in a T4 read.

## Delivery

- Branch: `phase16/long-term-curriculum`.
- Based on merged main `8d4b007`.
- Commit and push completed; do not merge automatically.
- Stop at Phase 16; do not start Phase 17.
