# Production Hardening Runbook

This runbook is for the family deployment only. It does not grant commercial rights;
the Phase 18 Commercialization Gate and its unresolved blockers remain authoritative.

## Configuration and fail-closed startup

For production set all of the following through the NAS secret/environment manager:

```text
TONGXUAN_ENV=production
TONGXUAN_DB_PATH=/app/data/tongxuan.sqlite3
TONGXUAN_BACKUP_DIR=/app/backups
TONGXUAN_AUTH_SECRET=<at least 32 random characters>
TONGXUAN_ALLOWED_ORIGINS=https://<approved-family-host>
BUILD_TARGET=family
```

The API refuses production startup when these settings are invalid. Never commit the auth
secret or expose it in browser code. A deployment must serve the API over HTTPS and keep the
SQLite data and backup directories on persistent NAS storage.

## Health, readiness, backup, restore

- `GET /api/health` is a liveness check and does not expose data.
- `GET /api/readiness` checks configuration, database integrity, and schema version.
- Run `python scripts/db_backup.py backup /app/backups/tongxuan-<timestamp>.sqlite3` before
  upgrades. Existing backup files are never overwritten unless `--overwrite` is explicit.
- Restore to a new destination first with `python scripts/db_backup.py restore BACKUP NEW_DB`;
  the contract refuses to overwrite an existing database by default. Verify readiness before
  switching the deployment volume. No reset/delete operation is part of the release contract.

## NAS deployment

Build the backend and frontend images from the pinned branch, mount `/app/data` and `/app/backups`
as persistent volumes, and expose only the reverse proxy to the LAN. Restrict the API origin to
the proxy origin, keep backups outside the live database directory, and test a backup restore on a
copy before migration. Do not publish SQLite or backup files as static content.

## Browser and iPad validation

Use Safari on the iPad and a current desktop browser over the approved HTTPS origin. Confirm the
PWA installs, reloads, child switching remains child-scoped, and `/api/health` and `/api/readiness`
are reachable. Microphone/TTS/OCR features remain subject to explicit browser permissions; raw
media is not uploaded by these contracts. Clear browser cache only after a backup and never use a
browser reset as a database reset.

## Security boundaries

Developer/admin commercialization readiness requires a server-verified session. Parent sessions
are child-scoped and cannot access admin readiness. Structured errors return a request ID and a
stable code without request bodies, secrets, or stack traces.
