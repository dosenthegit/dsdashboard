# DSDashboard

![Dashboard](https://github.com/user-attachments/assets/7b63904a-fbf1-4300-b307-af7b90ac7908)

![Settings](https://github.com/user-attachments/assets/8de41972-cc29-407c-96d2-33cb8476b88e)

A simple dashboard/homepage with HTTP(S) and ping status checks, a password-protected edit mode, configurable sections and cards, import/export, and configuration backups.

## Features

- Dashboard with search, stats, service sections, cards, and dark/light themes
- Password-protected edit mode, host/section editor, drag and drop, icon and color pickers
- Configuration import/export and automatic/manual backup and restore
- HTTP(S) and ping availability checks
- Server-side sessions, CSRF protection, login rate limiting, and scrypt password hashes

## Requirements

- Docker Engine and Docker Compose plugin (`docker compose`), OR Docker Engine for the `docker run` alternative
- Available TCP port 8080 on the host (configurable)
- Writable persistent `site/` and `data/` directories

## Choose an installation method

There are **two different Compose files**:

| Method | File | Use when |
| --- | --- | --- |
| Build from GitHub | `compose.yaml` | You have cloned the source repository and want to build it locally |
| Docker Hub image | `compose.hub.yaml` | You want to deploy the published `d0sn/dsdashboard:latest` image without source code |

**Do not run both methods at the same time:** both use container name `dsdashboard` and port 8080 by default.

### Option A — Build from GitHub

```bash
git clone https://github.com/dosenthegit/dsdashboard.git
cd dsdashboard
cp env.example .env
nano .env
```

Replace `DASHBOARD_ADMIN_PASSWORD` with a strong, unique password **before** starting. Both Compose files refuse to start if the variable is missing or empty. Then run:

```bash
mkdir -p site data
chmod 600 .env
docker compose config -q
docker compose up -d --build
docker compose ps
```

Open `http://SERVER-IP:8080`.

### Option B — Docker Hub image (recommended for simple deployments)

Create a working directory, download **`compose.hub.yaml` and `env.example` from this repository**, and rename the environment template:

```bash
mkdir -p /opt/dsdashboard/site /opt/dsdashboard/data
cd /opt/dsdashboard
# Place compose.hub.yaml and env.example here, then:
cp env.example .env
nano .env
chmod 600 .env
docker compose -f compose.hub.yaml config -q
docker compose -f compose.hub.yaml up -d
docker compose -f compose.hub.yaml ps
```

Replace `DASHBOARD_ADMIN_PASSWORD` with a strong, unique password before the first start. Open `http://SERVER-IP:8080`.

On first start, the app **copies bundled example files from `/sample-site` into `/site` when `/site/config.json` is missing**. You normally do not need to copy the repository's `site/` contents manually when using a matching, current Docker Hub image. **Caution:** when `config.json` is missing, this initialization can overwrite other files in `/site` that share the example filenames. Always back up `site/` before deleting `config.json`.

The Docker Hub image is independently published. If its behavior differs from the GitHub source, verify the image version and its bundled files.

### Option C — Docker run

Use the same `/opt/dsdashboard/.env`, `site/` and `data/` directories prepared in Option B:

```bash
cd /opt/dsdashboard
docker run -d \
  --name dsdashboard \
  --init \
  --restart unless-stopped \
  --env-file .env \
  -p 8080:3000 \
  -v /opt/dsdashboard/site:/site \
  -v /opt/dsdashboard/data:/data \
  d0sn/dsdashboard:latest
```

> Docker `run` does not apply the Compose file's required-password validation; make sure `.env` has a strong password before starting. A placeholder password is not automatically rejected by Compose either.

## Configuration variables

Copy `env.example` to `.env`. The settings below can be changed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DASHBOARD_ADMIN_PASSWORD` | Required by Compose | First-run admin password. Compose refuses to start if it is missing or empty. Replace the template value with a strong password. |
| `SESSION_TIMEOUT_MINUTES` | `30` | Session duration, clamped to 10–480 minutes |
| `COOKIE_SECURE` | `false` | Set `true` when browsing through HTTPS |
| `STATUS_INTERVAL` | `60` | Seconds between status checks |
| `STATUS_TIMEOUT` | `5` | HTTP(S) probe timeout in seconds |
| `DASHBOARD_BIND_IP` | `0.0.0.0` | Host interface for the Compose port binding |
| `DASHBOARD_PORT` | `8080` | Host port for the Compose port binding |
| `TZ` | `Europe/Stockholm` | Container timezone in the provided Compose files |

`DASHBOARD_BIND_IP`, `DASHBOARD_PORT`, and `TZ` are used by the supplied Compose files, not directly by the application. Existing settings in `/data/security.json` take precedence over the initial password and initial session timeout in `.env`.

## Persistent data and first-run behavior

| Host directory | Container directory | Contents |
| --- | --- | --- |
| `./site` | `/site` | `config.json`, `status.json`, HTML, JS, CSS and other site assets |
| `./data` | `/data` | `security.json` and `backups/` |

These are **bind mounts**. Recreating/updating the container does not automatically delete their contents, but **updating the Docker image does not overwrite existing customized site files** either. New frontend fixes in an image may require carefully updating your files in `site/`. Back up files and compare them with the new image's `/sample-site` before replacing anything.

The first start initializes `data/security.json` with a **scrypt password hash** from `DASHBOARD_ADMIN_PASSWORD`. Changing `.env` later **does not change an existing admin password**. Use the Security panel to change it. As a last-resort reset, back up `/data/security.json`, stop the container, remove that file, verify `.env`, and start again. This recreates the file and can reset security-related settings. Do not delete the whole `data/` directory or its backups.

Back up **both** `site/` and `data/` before migrations or major updates. Do not commit `.env` or `data/security.json` to Git.

## Status checks

`start.sh` starts a loop that runs `check-services.sh` periodically. The script reads `/site/config.json` and writes `/site/status.json`. It checks HTTP(S) URLs using `curl` and hosts using `ping`. HTTP(S) checks currently use `curl -k`, so TLS certificate verification is disabled for availability checks; an HTTP error response can also be considered online as long as curl succeeds. These checks measure reachability, not application correctness.

To run a check manually:

```bash
docker exec dsdashboard /bin/bash /app/check-services.sh
```

For source builds, configure `STATUS_INTERVAL` and `STATUS_TIMEOUT` in `.env`, then recreate the container to apply changes.

## HTTPS and reverse proxy

For internet-facing deployments, use a trusted HTTPS reverse proxy, configure access controls as appropriate, and set `COOKIE_SECURE=true` in `.env`. Recreate the container after changing the setting. Do **not** set this flag when accessing the app only via plain HTTP, or login cookies may not work.

If the reverse proxy runs on the same host, consider `DASHBOARD_BIND_IP=127.0.0.1` to avoid exposing port 8080 on all host interfaces. The application currently uses `X-Forwarded-For` for client IP identification; ensure a trusted proxy overwrites that header if you expose it externally. Avoid direct internet exposure without additional protection.

## Updating

**GitHub source build:**

```bash
git pull
docker compose up -d --build
```

**Docker Hub image:**

```bash
docker compose -f compose.hub.yaml pull
docker compose -f compose.hub.yaml up -d
```

Before updating, back up both persistent directories. Check whether files already stored in `site/` need a manual migration; they are not automatically refreshed with the image.

## Useful commands

For source builds, remove `-f compose.hub.yaml` from these examples.

```bash
# Logs
docker compose -f compose.hub.yaml logs -f

# Check container and health status
docker compose -f compose.hub.yaml ps

# Stop/remove container (persistent bind-mount directories remain)
docker compose -f compose.hub.yaml down

# Manual check
docker exec dsdashboard /bin/bash /app/check-services.sh
```

## Adding icons

The frontend's icon picker list is implemented in `/site/app.js`. You can customize it in the persistent `site/app.js` file. Save a backup first; local modifications remain after container updates, so new upstream frontend changes will **not** automatically replace them.

## Troubleshooting

- **Cannot log in after changing `.env`:** the initial password hash remains in `/data/security.json`; use Security settings or follow the careful reset procedure above.
- **Blank page or missing assets:** check that `/site` contains `index.html`, `app.js`, and `style.css`; examine logs for initialization errors and ensure directory write permissions.
- **No status information:** check `/site/config.json`, run the manual status check, and inspect `/site/status.json`.
- **Port 8080 already in use:** change `DASHBOARD_PORT` in `.env` and recreate the Compose service.
- **Unhealthy container:** inspect `docker logs dsdashboard` and test `docker exec dsdashboard wget -qO- http://127.0.0.1:3000/api/status`.

## License

See [LICENSE](LICENSE) in this repository.


### Maintainers: publishing Docker Hub images

The GitHub Actions workflow `.github/workflows/build.yml` publishes both
`d0sn/dsdashboard` on Docker Hub and `ghcr.io/<owner>/dsdashboard` on GHCR.
Every push to `main` updates `latest`; pushing a `vX.Y.Z` Git tag publishes
version tags. Both `linux/amd64` and `linux/arm64` are built.

In **GitHub → Settings → Secrets and variables → Actions**, set:

- Repository **variable** `DOCKERHUB_USERNAME` to a Docker Hub account with push access to `d0sn/dsdashboard`.
- Repository **secret** `DOCKERHUB_TOKEN` to that account's Docker Hub access token.

Make sure the `d0sn/dsdashboard` repository exists on Docker Hub and check the
GitHub Actions run before using the new image. To verify manifest platforms:

```bash
docker buildx imagetools inspect d0sn/dsdashboard:latest
```

Never commit the access token or `.env` file.
