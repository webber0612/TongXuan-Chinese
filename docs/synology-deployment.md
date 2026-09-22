# Synology DS723+ deployment

Phase 0 uses only two containers: `backend` and `frontend`. SQLite is stored in the repository `data/` volume, which must be mapped to a persistent Synology shared-folder path in production.

## Container Manager

1. Create a project from this repository or upload the project directory.
2. Review `docker-compose.yml` and change the host path for `./data` to a backed-up shared folder.
3. Build and start the project.
4. Expose the frontend port through the NAS reverse proxy if remote access is needed.
5. Open `/diagnostics` and verify the backend, SQLite and OpenCC indicators.

Do not claim NAS PASS from a desktop run. Record the real NAS result in `PHASE_0_REPORT.md` after testing on the DS723+.
