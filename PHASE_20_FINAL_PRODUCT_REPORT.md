# Phase 20 — Final Product Report

## Scope and boundary

Implemented on `phase20/final-product`, based on `origin/main` `04e3f88`, as a final release
candidate integration and operations layer. No new learning domain was added and no mastery,
scoring, adaptive, TTS, OCR, Reading Aloud, or Tutor semantics were changed. Phase 21 was not
started and this branch must not be merged until Architect PASS.

## Release-candidate harness

`scripts/final_smoke.py` provides a deterministic seeded family smoke flow using an isolated
SQLite database and fixed source text. It exercises all existing domains: Recognition, Curriculum,
private School Queue, TTS, Reading Aloud, OCR, Tutor, Adaptive, Parent Dashboard, and the
developer/admin Commercialization readiness boundary.

Canonical repository-root invocation (no manually pre-set `PYTHONPATH` required):

```powershell
python scripts/final_smoke.py
```

`scripts/test_final_smoke_command.py` is the command-level regression that executes this exact
invocation with `PYTHONPATH` removed from its environment.

The harness asserts:

- Alice and Bob sessions cannot cross child scope.
- School Queue content remains private and is absent from the other child's dashboard.
- School Queue TTS accepts matching `zh-TW`/Traditional source text and rejects a mismatched
  `zh-CN` request.
- Read-only dashboard, curriculum, readiness, and commercialization reads leave a complete
  durable database snapshot unchanged.
- Production readiness succeeds for a Family build, and backup/restore produces a verified copy.
- Optional distribution validation checks PWA index, manifest, service worker, and standalone
  display metadata.

## Packaging and operator artifacts

- `docs/family-release-checklist.md` records automated gates and explicit manual NAS/iPad/browser
  checks.
- `docs/release-notes-phase20.md` records release scope, boundaries, known limitations, and
  operator handoff.
- `docs/production-runbook.md`, `docker-compose.production.yml`, `scripts/production_check.py`,
  and `scripts/db_backup.py` remain the production packaging/readiness/backup contract.

## Commercialization fidelity

Family builds preserve Phase 18 unresolved resources as warnings and keep the developer/admin
readiness view protected from parent clients. Commercial builds still fail closed while commercial
blockers remain. This report makes no legal, paid-license, or commercial-readiness claim.

## Verification

- Backend: `87 passed`.
- Frontend: `26 passed`.
- Production build: passed.
- Production artifact check: passed.
- Deterministic final smoke/integration check: passed with read-only snapshot verification and
  backup/restore verification.

## Manual verification still required

- Docker runtime and persistent NAS deployment.
- Real iPad Safari install, permissions, reload/offline shell, and family workflow.
- Final operator confirmation of HTTPS origins, secrets, backup location, and recovery destination.

## Delivery

- Branch: `phase20/final-product`.
- Base: `origin/main` `04e3f88`.
- Draft release candidate only; do not merge until Architect PASS and do not start Phase 21.
