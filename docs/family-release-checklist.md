# Family Release Candidate Checklist

This checklist is for the Phase 20 family release candidate. It does not make a commercial,
legal, or paid-license claim.

## Automated gates

- [x] Backend test suite passes.
- [x] Frontend test suite passes.
- [x] Production build completes.
- [x] `scripts/production_check.py` validates `index.html`, manifest, service worker, and standalone PWA metadata.
- [x] From the repository root, `python scripts/final_smoke.py` runs without a manually pre-set `PYTHONPATH` and covers all existing learning domains, child isolation, private School Queue provenance, source-bound locale rejection, read-only snapshot invariance, readiness, and backup/restore.
- [x] `python scripts/test_final_smoke_command.py` verifies the canonical root command with `PYTHONPATH` removed.
- [x] Commercialization Gate remains Family-compatible with unresolved commercial blockers visible to developer/admin only.

## Manual NAS checks

- [ ] Set a persistent absolute `TONGXUAN_DB_PATH` and `TONGXUAN_BACKUP_DIR` on the NAS.
- [ ] Set a unique strong `TONGXUAN_AUTH_SECRET`; do not use the compose placeholder.
- [ ] Set explicit HTTPS `TONGXUAN_ALLOWED_ORIGINS` and keep the database/backup directory outside the static web root.
- [ ] Start `docker compose -f docker-compose.production.yml up -d` and confirm backend healthcheck/readiness is healthy before frontend traffic.
- [ ] Verify a backup and a restore to a new destination; never use destructive reset or overwrite without explicit operator intent.
- [ ] Confirm parent sessions cannot cross child boundaries and admin-only readiness does not appear in parent views.

## Manual iPad/browser checks

- [ ] Open through HTTPS in Safari, verify the PWA install prompt/standalone launch and reload of the app shell.
- [ ] Switch between children and confirm every dashboard, curriculum, School Queue, TTS, OCR, Reading Aloud, Tutor, and adaptive view remains child-scoped.
- [ ] Confirm microphone/TTS/OCR permissions are requested only when the corresponding feature is used; raw media is not persisted or logged.
- [ ] Exercise offline/reload behavior and reconnect before any write; verify readiness and error messages remain privacy-safe.

## Known limitations

- NAS, Docker runtime, real iPad Safari, and real-family usability still require manual verification.
- Phase 18 commercial blockers remain explicit; this checklist does not purchase or infer any license.
- No new learning domain or mastery/scoring semantics are introduced by Phase 20.
