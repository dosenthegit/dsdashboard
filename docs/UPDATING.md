# DSDashboard build and update guide

- GitHub `main` builds: cached build, pushes Docker Hub and GHCR.
- Sunday 03:00 UTC: `no-cache` and `pull`, builds and publishes `linux/amd64` plus `linux/arm64`.
- Manual GitHub Actions builds: optional `full_rebuild` input.
- Git version tags publish semantic version tags. `latest` follows `main` only.
- Existing Docker installations are not updated until manually redeployed.
- Deploy with `compose.hub.yaml` (existing image-based Compose file). Back up `.env`, `site/` and `data/`.
- Run `./scripts/update.sh` in the deployment directory to pull, archive persistent content, restart, and check health.
- The script does not automatically roll back; if it fails, inspect `docker compose -f compose.hub.yaml logs --tail=100`.
- `node:24-alpine` keeps Node's major version fixed but follows minor/patch and Alpine updates within the image tag's underlying Alpine line. Re-evaluate base version before Node 24 end-of-life (April 2028).
- Rebuilding without cache does not necessarily update pinned application packages. Review dependency security notices separately.
