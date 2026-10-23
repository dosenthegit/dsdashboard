# Docker Hub publishing setup for DSDashboard

This package updates `.github/workflows/build.yml` to publish the same image to:

- Docker Hub: `d0sn/dsdashboard`
- GitHub Container Registry: `ghcr.io/<github-owner>/dsdashboard`

It builds `linux/amd64` and `linux/arm64` images. Each commit on `main` publishes `latest` and a short SHA tag. A pushed `v1.2.3` Git tag publishes `1.2.3` and `1.2` (as well as the SHA tag). `latest` intentionally tracks `main` only.

## Required setup

1. On Docker Hub, verify that your account has push rights to repository `d0sn/dsdashboard` (create the repository if needed).
2. Create a Docker Hub access token with Read & Write permissions for that repository. Do NOT paste the token in repo files or chats.
3. In GitHub repo Settings > Secrets and variables > Actions:
   - Under **Variables**, add `DOCKERHUB_USERNAME` = `d0sn` (or the actual Docker Hub account name that has push rights).
   - Under **Secrets**, add `DOCKERHUB_TOKEN` = your Docker Hub access token.
4. Ensure GitHub Actions is enabled and `GITHUB_TOKEN` has permission to publish packages to GHCR. For some organizational repositories, package policies may need separate approval.
5. Commit the new `.github/workflows/build.yml` and `.dockerignore` files to `main`.
6. Watch Actions > **Build and publish Docker images**. It should finish successfully before assuming Docker Hub is up to date.

## Verify the image

On a machine with Docker:

```sh
docker buildx imagetools inspect d0sn/dsdashboard:latest
docker pull d0sn/dsdashboard:latest
docker image inspect d0sn/dsdashboard:latest --format '{{.Id}}'
```

To deploy, use your existing `compose.hub.yaml` and `.env`:

```sh
docker compose -f compose.hub.yaml pull
docker compose -f compose.hub.yaml up -d
docker compose -f compose.hub.yaml ps
```

To publish a release after testing:

```sh
git tag v1.0.0
git push origin v1.0.0
```

Note: The image's actual runtime, first-start volume initialization and healthcheck have not been run in this environment. The workflow must be executed in GitHub Actions to confirm registry publishing credentials and permissions.

## Frontend rollout and persisted data

New images serve the UI from `/app/public` while the bind mount `/site` holds only runtime configuration and status. The image initializes missing `/site/config.json` from `/app/defaults/config.json`. Existing site configs and `/data` backups/security persist across image updates; legacy `/site/app.js`, `/site/index.html` and `/site/style.css` are ignored. Do not remove existing mounts or delete their contents during upgrade.

After the publishing workflow succeeds, deploy with:

```sh
docker compose -f compose.hub.yaml pull
docker compose -f compose.hub.yaml up -d --force-recreate
docker exec dsdashboard grep -n "Configuration & Backups" /app/public/app.js
```

Hard-refresh the browser if cached JS/CSS persists. A local ZIP or Git commit does **not** update Docker Hub until the image publishing workflow succeeds. For source installations, run `docker compose up -d --build --force-recreate` instead.
