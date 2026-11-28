## 4.1.0 — Browser bookmark drag-and-drop (2026-11-28)

- Add one external bookmark, address-bar URL or webpage hyperlink by dropping it into an existing section in authenticated Edit Mode.
- Supports common Chrome/Edge `text/uri-list` + `text/html` and Firefox `text/x-moz-url` drag data, plus plain-text HTTP(S) links.
- Show a review modal with editable name, URL, icon and section, plus advanced ID/health options; do not auto-save on drop.
- Flag URL duplicates and require explicit permission to save them anyway.
- Validate HTTP(S) URLs, reject embedded credentials, and preserve server-side input validation and CSRF protections.
- Keep internal host/section reorder behavior and existing config schema unchanged.
- Extend offline Chromium regression tests to cover link formats, duplicate confirmation, invalid links, specific sections, and internal drag-and-drop.

## 4.0.0 — Integrated 3.1 + 3.2 + 3.3

- Local service search (`Ctrl+K`), favorites, status filters, compact/large layouts and optional hidden status labels.
- Online/Warning/Offline/Unknown/Maintenance states and freshness indicators.
- HTTP expected-status and health-path checks, TCP/ICMP probes, slow response warnings and HTTPS certificate expiry warnings.
- Persistent, bounded hourly health history with 24h/7d/30d uptime and response-time summaries.
- Optional password-protected dashboard viewing (`privateView`), while keeping the edit password/session flow.
- Icon index and on-demand image caching under `/data/icon-cache`; support for longer `di:` icon slugs.
- Config backup preview, auto-retention and pre-restore backup.
- Node.js backend tests, offline Chromium UI tests and real-server Chromium smoke gate before Docker publication.
- Docker healthcheck moved to public `/api/health` so private viewing does not mark the container unhealthy.
- Backward-compatible with existing sections, services, emoji and Dashboard Icons config values.

## Dashboard Icons catalog update (2026-11-26)

- Icon search loads the complete native Dashboard Icons file index instead of only a small hard-coded list.
- Supports SVG and PNG-only icons, keeps the curated fallback, and limits displayed matches for performance.
- Allows jsDelivr catalog requests in Content Security Policy.

## Dashboard Icons integration (2026-11-26)

- Added searchable emoji and Dashboard Icons pickers for hosts and sections.
- Added `di:<slug>` image rendering in service cards, section headers, live preview, and mobile preview.
- Kept existing emoji configuration fully compatible.
- Icons are loaded from jsDelivr and need network access; broken assets fall back to an emoji.

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
