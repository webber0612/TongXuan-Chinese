# Phase 20 Final Product Release Notes

## Included

- Deterministic seeded end-to-end smoke coverage across recognition, curriculum, School Queue,
  TTS, Reading Aloud, OCR, Tutor, Adaptive, Parent Dashboard, and commercialization readiness.
- Explicit child isolation, private user-provided School Queue provenance, and source-bound
  locale/script validation in the release-candidate flow.
- GET/readiness/dashboard/curriculum/commercialization snapshot comparison proving the smoke
  read paths do not mutate durable state.
- Production readiness, fail-closed configuration, PWA artifact, backup/restore, and
  readiness-aware deployment checks.
- Family packaging, operator handoff, NAS/iPad manual checklist, known limitations, and
  commercial-blocker fidelity documentation.
- The canonical smoke command is `python scripts/final_smoke.py` from the repository root; it
  bootstraps the repository path itself and does not require a pre-set `PYTHONPATH`. The command
  regression is `python scripts/test_final_smoke_command.py`.

## Boundaries and limitations

Phase 20 adds no learning domain and does not change mastery, scoring, pronunciation, adaptive,
OCR, Reading Aloud, TTS, or Tutor semantics. Phase 18 commercial blockers remain unresolved until
the required evidence, licenses, or replacements are supplied; no legal or paid-license claim is
made here. Docker/NAS persistence and real iPad Safari behavior remain manual operator checks.

## Operator handoff

Use `docs/production-runbook.md` for deployment and recovery procedures and
`docs/family-release-checklist.md` for the final family verification. Keep the release candidate
on the Phase 20 branch until Architect PASS; do not merge or begin Phase 21 automatically.
