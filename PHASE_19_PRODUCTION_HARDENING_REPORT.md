# Phase 19 — Production Hardening Report

## Scope

Implemented the Phase 19 Production Hardening Work Order on
`phase19/production-hardening`, based on merged `origin/main` `47361e4`.
No Phase 20 work was started and no merge was performed.

## Backend hardening

- Added deterministic `/api/health` liveness and `/api/readiness` configuration/database/schema
  readiness checks.
- Added fail-closed production configuration validation for absolute persistent DB/backup paths,
  explicit CORS origins, strong server auth secret, valid environment, and build target. A
  production Commercial build also fails closed when Phase 18 Commercialization blockers remain.
- Added schema version `1` plus additive `schema_migrations` bookkeeping without destructive reset.
- Added non-destructive SQLite backup/restore contracts and `scripts/db_backup.py`; existing backup
  and restore destinations are not overwritten unless explicit `--overwrite` is supplied.
- Added privacy-safe request IDs, structured internal errors, no request-body logging, and no secret
  exposure. The wired JSON handler records only `request_id`, route, status, and latency with
  redaction by construction.
- Every production mutation now requires a server-verified session. Parent sessions are limited to
  their child scope; diagnostics, child creation, curriculum catalog writes, and conversion tools
  require developer/admin role. Existing developer/admin commercialization auth remains protected.
- SQLite connections explicitly enable foreign keys, a 5-second busy timeout, WAL journal mode,
  and NORMAL synchronous policy.

## Deployment and client hardening

- Added `docker-compose.production.yml` with persistent data/backup mounts and fail-closed secret
  placeholders, `/api/readiness` healthcheck, and frontend dependency on a healthy backend.
- Added `scripts/production_check.py` for deterministic PWA/static artifact checks.
- Added `docs/production-runbook.md` covering NAS deployment, iPad Safari/browser checks, health,
  readiness, backup/restore, HTTPS, privacy, and security boundaries.

## Compatibility and blockers

Learning, mastery, scoring, adaptive, TTS, OCR, Reading Aloud, and Tutor semantics were not
changed. Phase 18 Commercialization Gate blockers remain explicit; this phase makes no legal,
paid-license, or commercial-readiness claim.

## Verification

- Backend: `86 passed` with `PYTHONPATH=backend`.
- Frontend: `26 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Production artifact check: passed.
- Backup/restore, readiness, fail-closed config, schema version, and privacy contracts have
  regression coverage, including unauthenticated/parent/admin mutation authorization, SQLite
  connection policy, structured log fields, and sensitive payload redaction.

## Delivery

- Branch: `phase19/production-hardening`.
- Base: merged `origin/main` `47361e4`.
- Commit and push completed; do not merge automatically.
- Stop at Phase 19; do not start Phase 20.
