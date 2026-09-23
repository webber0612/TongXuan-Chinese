# Phase 17 — Optional AI Tutor Report

## Scope

Implemented only the Issue #19 Optional AI Tutor scope from main `190954d`. Phase 18,
commercialization, and unrelated refactors were not started.

## Architecture and safety boundary

- Added a replaceable `TutorProvider` adapter boundary with a deterministic local fallback;
  no model SDK, cloud client, telemetry, raw media, or provider-specific learning-domain code.
- Tutor retrieval is authoritative and child-scoped for Curriculum Item and School Queue sources.
  Responses preserve source, provenance, privacy, license, locale, and script metadata. Locale and
  script are derived from the retrieved source text and mismatched requests are rejected.
- Allowed modes are limited to `explain`, `story`, `reading-guide`, and `sentence-hint`.
- Missing authoritative context produces a deterministic refusal. The tutor never decides
  correctness, supplies an answer key, evaluates stroke order/pronunciation, scores, mutates
  mastery/learning state, or changes adaptive ranking.
- The frontend exposes a minimal grounded tutor panel; the backend response path has no database
  write and does not accept media payloads.

## Verification

- Backend: `73 passed` with `PYTHONPATH=backend`.
- Frontend: `24 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes adapter safety flags, deterministic no-context refusal, child
  isolation, private School Queue provenance, locale/script validation, no learning-state mutation,
  authoritative Curriculum/School Queue text locale-script matching, and rendered frontend
  child-scoped tutor interaction.

## Architect Audit Resolution

- AUD-T17-01: Tutor locale/script is derived from the retrieved authoritative text and compared
  against any requested pair. Traditional and Simplified Curriculum items plus Traditional School
  Queue content have matching-success and mismatch-rejection regression coverage.

## Delivery

- Branch: `phase17/ai-tutor`.
- Based on merged main `190954d`.
- Commit and push completed; do not merge automatically.
- Stop at Phase 17; do not start Phase 18.
