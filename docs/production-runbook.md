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
GOOGLE_CLIENT_ID=<Google Identity Services web client ID>
TONGXUAN_PARENT_PASSWORD=<existing reward-confirmation password, at least 12 characters>
BUILD_TARGET=family
```

The API refuses production startup when these settings are invalid. Never commit the auth
secret or expose it in browser code. A deployment must serve the API over HTTPS and keep the
SQLite data and backup directories on persistent NAS storage. `GOOGLE_CLIENT_ID` is the Google
Identity Services web client ID, not a client secret. Configure the exact browser Origin in
`TONGXUAN_ALLOWED_ORIGINS`; do not use `*`. The existing parent password remains a separate
reward-confirmation setting and is not used to authenticate a parent account.

Google parent sessions use an HttpOnly, Secure cookie with `SameSite=None` on HTTPS. The browser
fetches a server-issued CSRF token and echoes it in `X-CSRF-Token` for unsafe API requests. Keep
the allowed-origin list limited to the real app origins. Logout is accepted only from an allowed
Origin. Preserve `Authorization: Bearer` for approved internal adapters; it is not a public login
mechanism.

## Parent identity schema upgrade

Before deploying the parent-auth build, make and verify a timestamped database backup. Startup
migration v5 adds the `google_parents` table and nullable `children.parent_id` ownership column
with an index. It preserves existing children and learning rows without claiming any legacy
profile for the first Google account. Unowned legacy profiles remain unavailable to Google
parents until a separately authorized data-migration decision is made.

The migration is additive and runs through the normal database initializer. Confirm the startup
log is clean and `GET /api/readiness` reports schema version 5. Run the v4-to-v5 preservation test
and the full backend suite before release. Do not manually set `parent_id` in production.

To roll back to a pre-v5 binary, stop writes and restore a pre-upgrade backup to a separate
database path, then verify readiness before switching volumes. The pre-v5 binary rejects a newer
schema version. Preserve a separate copy of the post-upgrade database for any accounts or child
profiles created after deployment; restoring the old snapshot alone would discard those writes.

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
the exact browser app origin(s), keep backups outside the live database directory, and test a
backup restore on a copy before migration. Set `GOOGLE_CLIENT_ID` in the deployment environment
and ensure it matches the GIS web client audience. Do not publish SQLite or backup files as
static content.

## Browser and iPad validation

Use Safari on the iPad and a current desktop browser over the approved HTTPS origin. Confirm the
PWA installs, reloads, child switching remains child-scoped, and `/api/health` and `/api/readiness`
are reachable. Microphone/TTS/OCR features remain subject to explicit browser permissions; raw
media is not uploaded by these contracts. Clear browser cache only after a backup and never use a
browser reset as a database reset.

## Security boundaries

Developer/admin commercialization readiness requires a server-verified session. Parent sessions
are scoped through persistent parent-to-child ownership and cannot access admin readiness. Google
email and display name are mutable profile fields; the verified Google `sub` is the stable account
key. Structured errors return a request ID and a stable code without request bodies, credentials,
or stack traces.
