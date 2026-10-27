# DSDashboard – update bundle changelog

## 2026-10-27
- Added Sunday 03:00 UTC weekly clean multi-platform rebuild, preserving normal build caching.
- Added optional manual full rebuild through GitHub workflow dispatch.
- Pinned Node major to Node.js 24 LTS instead of floating `node:lts-alpine`.
- Retained Docker Hub + GHCR tags, README synchronization and existing repository variable/secret names.
- Added controlled Docker Hub deployment update helper with backup and health check.
- Added README updates and an operations guide.
- No changes to application JavaScript or runtime configuration schema.
