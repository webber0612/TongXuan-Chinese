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

- Backend: `66 passed` with `PYTHONPATH=backend`.
- Frontend: `20 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes level/unit/item ordering, provenance/license fields, child
  isolation, `created_at`/as-of filtering, append-only progress history, no School Queue
  promotion, and independent existing skill state.

## Delivery

- Branch: `phase16/long-term-curriculum`.
- Based on merged main `8d4b007`.
- Commit and push completed; do not merge automatically.
- Stop at Phase 16; do not start Phase 17.
