# DSdashboard 4.1 – installation and upgrade guide

This archive contains the **complete** updated DSdashboard 4.1.0 source tree (all V4 features retained, plus bookmark drag-and-drop), including frontend, Node backend, tests and GitHub Actions workflow.

## Publishing to your existing GitHub repository

1. Back up the existing GitHub repository (or make a protected tag/branch).
2. Extract the archive, then copy its files into the corresponding paths in your repository. Do **not** upload your personal runtime `.env`, `site/config.json` from the running installation or the `data/` directory.
3. Review the changes (`git diff`) before pushing to `main`.
4. The CI `verify` job now runs JavaScript/DOM checks, backend tests and two headless Chromium UI tests. Publishing to Docker Hub/GHCR runs only if those checks pass.
5. Pull and recreate the running container after the new image is published.

## Deployment via Docker Hub

From the directory containing `compose.hub.yaml` and your existing `.env`:

```sh
# Back up persistent runtime data first (site/, data/, .env).
docker compose -f compose.hub.yaml pull
docker compose -f compose.hub.yaml up -d
```

For a source-code build use `docker compose up -d --build` instead.

The `/site` volume contains runtime `config.json` and `status.json`; `/data` stores security settings and backups. The frontend is served from `/app/public`, bundled inside the new image. **Never delete or overwrite your real `/site` and `/data` volumes when upgrading.**

## Optional settings

In `.env`, you can add `BACKUP_MAX_FILES=100`. For brand new installations, `DASHBOARD_PRIVATE_VIEW=true` makes dashboard viewing require login from the first start. For existing installations, enable the private viewing checkbox under Security in Edit Mode; changing `.env` alone does not override an existing `/data/security.json`.

Health history starts collecting at first deployment in `/data/status-history.json` and uses up to 31 days of hourly aggregates. Dashboard Icons are cached under `/data/icon-cache/`. The check worker now treats HTTP 4xx/5xx as Offline unless you explicitly configure an expected response code on that service. For self-signed or internally issued TLS certificates, configure trust correctly, or as a last resort set `STATUS_INSECURE_TLS=true` (affects all HTTPS checks).

## Tests

```sh
npm run check
npm test
npm run test:browser:offline
npm run test:browser
```

An administrator policy in some Chromium installations blocks local HTTP addresses, preventing the *real-server* browser test locally. The GitHub Actions workflow runs this test in a clean Ubuntu runner before it publishes images.

## Test bookmark drag-and-drop before deploying

1. Build a local image from the extracted project: `docker build -t dsdashboard:v4.1-test .`
2. Deploy to a **separate** test stack / port with separate `/site` and `/data` volumes. When using Dockhand, select the Docker environment where you built the image and set `pull_policy: never`.
3. Sign into **Edit Mode**, then drag one browser bookmark into a section's dashed drop area.
4. Verify name/URL/section, press **Add Bookmark**, and refresh the browser to confirm it persists.
5. Try dropping the same URL again: the duplicate warning should require confirmation.
6. Verify internal host and section reordering still works.

The feature uses the existing `/api/save-config` endpoint and does not add new persistent fields. The browser's format for dragged bookmarks varies; dragging a single ordinary web link should work in browsers supporting HTML drag-and-drop.
