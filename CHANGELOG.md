# DSDashboard – update bundle changelog

## 2026-11-22 – Frontend startup fix
- Removed `app.js` event bindings for toolbar controls that are not present in `index.html`.
- Restored missing `restoreFileInput` required by backup restore from file.
- Reused the host emoji library for section icons, without duplicate `ICONS` declarations.
- Added `scripts/check-frontend.js` and `npm run check` to the image publication workflow to catch missing static DOM IDs.
- Disabled HTML, JavaScript and CSS caching to avoid mixed versions after deployments.
- Added an embedded favicon to avoid a favicon 404 in the browser.
- Corrected the README and update instructions: bundled UI lives at `/app/public`, while `/site` holds runtime configuration/status.

## 2026-10-27
- Added Sunday 03:00 UTC weekly clean multi-platform rebuild, preserving normal build caching.
- Added optional manual full rebuild through GitHub workflow dispatch.
- Pinned Node major to Node.js 24 LTS instead of floating `node:lts-alpine`.
- Retained Docker Hub + GHCR tags, README synchronization and existing repository variable/secret names.
- Added controlled Docker Hub deployment update helper with backup and health check.
- Added README updates and an operations guide.
- No changes to application JavaScript or runtime configuration schema.
