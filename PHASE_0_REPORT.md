# Phase 0 Report

## Scope

Implemented only `[Phase 0] Project skeleton & technical validation` from GitHub Issue #2. Phase 1 and all later learning-product features were not started.

## Implemented

- React + TypeScript + Vite frontend with `/diagnostics` shell.
- PWA manifest and service worker generation through `vite-plugin-pwa`.
- FastAPI backend with `GET /api/health`.
- OpenCC provider adapter with `POST /api/tools/convert` for `s2t`, `s2tw`, and `t2s`.
- SQLite persistent database with `children` and `diagnostic_events` tables plus CRUD diagnostic endpoint.
- Hanzi Writer PoC for `學`, including render, animation, pause/resume/reset, quiz and mistake callback wiring.
- Web Speech API controls for zh-TW / zh-CN and rates 0.6 / 0.8 / 1.0.
- MediaRecorder start/stop/playback-ready in-memory diagnostic flow; no recordings are persisted.
- PASS / FAIL / `MANUAL_VALIDATION_REQUIRED` diagnostics indicators.
- Docker Compose for frontend + backend only, with persistent SQLite volume.
- Synology DS723+ deployment and iPad Safari compatibility documents.
- Phase 0A license registry entries for the newly introduced technical dependencies.

## Automated test results

- Backend: `5 passed` with pytest.
- Frontend: `1 passed` with Vitest.
- Frontend production build: passed; PWA service worker and manifest generated.
- License registry consistency: covered by backend automated test.

## Manual validation still required

- Real iPad Safari: touch, Hanzi Writer touch quiz, Speech Synthesis, microphone, MediaRecorder, audio playback, API connection and Add to Home Screen.
- Synology DS723+ Container Manager deployment and persistent-volume restart.
- Docker Compose execution: Docker CLI was not installed in the implementation environment.

These items remain explicitly `MANUAL_VALIDATION_REQUIRED`; no hardware or NAS PASS is claimed.

## Known issues / limitations

- Voice availability differs by browser and device; the diagnostics page reports API availability, while actual voice selection requires manual validation.
- Hanzi Writer and OpenCC bundled data provenance remain `LICENSE_REVIEW_REQUIRED` in the registry until their commercial-release audit is completed.
- No production child-facing UI, curriculum, recognition, SRS, School Queue, scoring, points, OCR, ASR, grammar, reading or AI tutor was implemented.

## Phase 1 readiness

Not started. The repository is ready for a separate Phase 1 work order only after this Phase 0 PR is reviewed and accepted. This implementation does not authorize Phase 1.

## Git handoff

- Branch: `phase/0-technical-validation`
- Commit SHA: `f54cf12aa1dd5fc7af654cf031ce31cfdce17fa2`
- Pull Request: https://github.com/webber0612/TongXuan-Chinese/pull/3
