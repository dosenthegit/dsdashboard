# DSDashboard build and update guide

- GitHub `main` builds: cached build, pushes Docker Hub and GHCR.
- Sunday 05:35 Europe/Stockholm: `no-cache` and `pull`, builds and publishes `linux/amd64` plus `linux/arm64`.
- Manual GitHub Actions builds: optional `full_rebuild` input.
- Git version tags publish semantic version tags. `latest` follows `main` only.
- Existing Docker installations are not updated until manually redeployed.
- Deploy with `compose.hub.yaml` (existing image-based Compose file). Back up `.env`, `site/` and `data/`.
- Run `./scripts/update.sh` in the deployment directory to pull, archive persistent content, restart, and check health.
- The script does not automatically roll back; if it fails, inspect `docker compose -f compose.hub.yaml logs --tail=100`.
- `node:24-alpine` keeps Node's major version fixed but follows minor/patch and Alpine updates within the image tag's underlying Alpine line. Re-evaluate base version before Node 24 end-of-life (April 2028).
- Rebuilding without cache does not necessarily update pinned application packages. Review dependency security notices separately.

## Upgrading to 4.0.0

1. Back up `.env`, your runtime `site/` and persistent `data/` folders before updating.
2. Push the updated source and review GitHub Actions `verify` before publication. If `verify` fails, the publish job will not run.
3. Deploy the newly published image with `docker compose -f compose.hub.yaml pull && docker compose -f compose.hub.yaml up -d` (or `docker compose up -d --build` when building locally).
4. The first new status check writes detailed records into the existing `/site/status.json` and creates `/data/status-history.json`. No manual config migration is required.
5. `DASHBOARD_PRIVATE_VIEW=false` by default. To enable private browsing after the initial startup, sign into Edit Mode and use **Security → Private dashboard**. Restarting does not reset that choice.
6. Existing host `url`, `invertStatus`, `icon`, and section details remain intact. Default check type is `auto`, and HTTPS warning threshold is 30 days.
7. Monitor `docker logs dsdashboard`, and test `/api/health` for container health.

Note: in 4.0.0 HTTP 4xx/5xx now report Offline by default. For health endpoints requiring authentication, use an expected HTTP code (for example `401`) or a separate TCP check. Existing dashboard entries are otherwise compatible, but status semantics deliberately changed.

## Upgrading from 4.0.0 to 4.1.0

- All V4 configuration files, persistent volume paths, user accounts, Dashboard Icons values and status data remain compatible.
- In **Edit Mode**, drag a bookmark or HTTP(S) link from the browser into a service section to open **Add Bookmark**. Saving is manual and uses existing CSRF-protected config persistence.
- No environment variables, extra packages or migrations are required. Existing internal drag-and-drop to reorder cards and sections is unchanged.
- Back up `/site` and `/data` before upgrading and test the new image in a separate stack first.
