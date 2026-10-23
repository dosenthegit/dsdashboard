# DSDashboard

![Dashboard](https://github.com/user-attachments/assets/7b63904a-fbf1-4300-b307-af7b90ac7908)

![Settings](https://github.com/user-attachments/assets/8de41972-cc29-407c-96d2-33cb8476b88e)

A simple dashboard/homepage with HTTP(S) and ping status checks, a password-protected edit mode, configurable sections and cards, import/export, and configuration backups.

## Edit mode: configuration and backups

The **Configuration & Backups** panel is the single location for importing and exporting `config.json` and opening backup management. **Import config.json** asks for confirmation before replacing the existing configuration; a server-side backup is created before the save. **Export config.json** downloads the active configuration. **Manage Backups** opens a dialog for creating, downloading, restoring and deleting stored backups. Automatic backups continue to run before server-side saves. The separate restore-from-file option was consolidated into import because both performed the same operation.

**Add New Section** opens the section editor; the duplicate sidebar form was removed. The edit toolbar now has a single **Exit Edit Mode** action.

## Features

- Dashboard with search, stats, service sections, cards, and dark/light themes
- Password-protected edit mode, host/section editor, drag and drop, icon and color pickers
- Configuration import/export and automatic/manual backup and restore
- HTTP(S) and ping availability checks
- Server-side sessions, CSRF protection, login rate limiting, and scrypt password hashes

## Requirements

- Docker Engine and Docker Compose plugin (`docker compose`), OR Docker Engine for the `docker run` alternative
- Available TCP port 8080 on the host (configurable)
- Writable persistent `site/` (runtime config/status) and `data/` (security/backups) directories

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

Replace `DASHBOARD_ADMIN_PASSWORD` with a strong, unique password **before** starting. Both Compose files refuse to start if the variable is missing or empty, and first-run initialization rejects passwords shorter than 16 characters or known placeholders. Then run:

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

On first start the app creates `/site/config.json` from the image's `/app/defaults/config.json` **only if it does not exist**, and initializes `/site/status.json` if necessary. HTML, CSS and JavaScript are always served from **`/app/public` in the image**, never from the mounted `/site` directory. Existing configuration and backups are preserved. Back up `site/` before deleting `config.json`.

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

> Docker `run` does not apply the Compose file's required-password validation; make sure `.env` has a strong password before starting. First-run initialization also rejects placeholder passwords and requires at least 16 characters.

## Configuration variables

Copy `env.example` to `.env`. The settings below can be changed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DASHBOARD_ADMIN_PASSWORD` | Required by Compose | First-run admin password. Compose refuses to start if it is missing or empty. Replace the template value with a unique password of at least 16 characters; placeholder values are rejected on first start. |
| `SESSION_TIMEOUT_MINUTES` | `30` | Session duration, clamped to 10–480 minutes |
| `COOKIE_SECURE` | `false` | Set `true` when browsing through HTTPS |
| `STATUS_INTERVAL` | `60` | Seconds between status checks |
| `STATUS_TIMEOUT` | `5` | HTTP(S) probe timeout in seconds |
| `STATUS_INSECURE_TLS` | `false` | Disable TLS certificate verification for status checks only when explicitly set to `true` |
| `DASHBOARD_BIND_IP` | `0.0.0.0` | Host interface for the Compose port binding |
| `DASHBOARD_PORT` | `8080` | Host port for the Compose port binding |
| `TZ` | `Europe/Stockholm` | Container timezone in the provided Compose files |

`DASHBOARD_BIND_IP`, `DASHBOARD_PORT`, and `TZ` are used by the supplied Compose files, not directly by the application. Existing settings in `/data/security.json` take precedence over the initial password and initial session timeout in `.env`.

## Persistent data and first-run behavior

| Host directory | Container directory | Contents |
| --- | --- | --- |
| `./site` | `/site` | Persistent `config.json` and generated `status.json`; legacy frontend files, if present, are ignored |
| `./data` | `/data` | `security.json` and `backups/` |

These are **bind mounts**. Container recreation preserves the contents. The image bundles the frontend in `/app/public` and always serves it from there, so `docker compose pull && docker compose up -d` updates the interface when a newly published image is available. Existing `./site/app.js`, `./site/index.html` and `./site/style.css` from older deployments are **ignored** (not deleted). The image initializes missing config using `/app/defaults/config.json` without overwriting an existing config. Keep backups of both bind mounts.

The first start requires `DASHBOARD_ADMIN_PASSWORD` to be at least 16 characters and not a known placeholder, then initializes `data/security.json` with a **scrypt password hash** from `DASHBOARD_ADMIN_PASSWORD`. Changing `.env` later **does not change an existing admin password**. Use the Security panel to change it. As a last-resort reset, back up `/data/security.json`, stop the container, remove that file, verify `.env`, and start again. This recreates the file and can reset security-related settings. Do not delete the whole `data/` directory or its backups.

Back up **both** `site/` and `data/` before migrations or major updates. Do not commit `.env` or `data/security.json` to Git.

## Status checks

`start.sh` starts a loop that runs `check-services.sh` periodically. The script reads `/site/config.json` and writes `/site/status.json`. It checks HTTP(S) URLs using `curl` and hosts using `ping`. HTTP(S) checks validate TLS certificates by default and treat HTTP 4xx/5xx as offline. Set `STATUS_INSECURE_TLS=true` only for endpoints whose certificates cannot be validated. Redirects are followed. These checks indicate HTTP availability, not full application correctness.

To run a check manually:

```bash
docker exec dsdashboard /bin/bash /app/check-services.sh
```

For source builds, configure `STATUS_INTERVAL` and `STATUS_TIMEOUT` in `.env`, then recreate the container to apply changes.

## HTTPS and reverse proxy

For internet-facing deployments, use a trusted HTTPS reverse proxy, configure access controls as appropriate, and set `COOKIE_SECURE=true` in `.env`. Recreate the container after changing the setting. Do **not** set this flag when accessing the app only via plain HTTP, or login cookies may not work.

If the reverse proxy runs on the same host, consider `DASHBOARD_BIND_IP=127.0.0.1` to avoid exposing port 8080 on all host interfaces. For login throttling the application uses the direct TCP peer address rather than trusting user-supplied `X-Forwarded-For` headers. When behind a reverse proxy, multiple users can share one rate-limit bucket; apply additional per-client rate limiting at your trusted reverse proxy. Avoid direct internet exposure without additional protection.

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

Before updating, back up both persistent directories. Frontend assets are updated automatically when the **new image is actually published and pulled**. No manual copy of HTML, CSS or JavaScript to `site/` is required. If the interface still looks old, check that the image was rebuilt and published, recreate the container and hard-refresh your browser (Ctrl+Shift+R).

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

The frontend's icon picker list is implemented in `site/app.js` **in the source repository**, built into `/app/public/app.js` in the image. To customize it, edit the source, rebuild and redeploy the image; editing `/site/app.js` inside a volume no longer changes the live interface. Preserve customizations in source control.

## Troubleshooting

- **Cannot log in after changing `.env`:** the initial password hash remains in `/data/security.json`; use Security settings or follow the careful reset procedure above.
- **Blank page or missing assets:** check `/app/public/index.html`, `/app/public/app.js` and `/app/public/style.css` in the image and inspect container logs. Old files in `/site` are not served.
- **Old Edit Mode after update:** ensure the updated source was pushed and the Docker Hub image rebuilt; run `docker compose -f compose.hub.yaml pull && docker compose -f compose.hub.yaml up -d --force-recreate`, then hard-refresh. Check `docker exec dsdashboard grep -n "Configuration & Backups" /app/public/app.js`. An image built before this change will still behave as before.
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

## Public sample configuration and security

The tracked `site/config.json` contains **example-only addresses** (`example.com`, `192.0.2.10`). Replace these through the dashboard after installation. Do not commit private hostnames, internal addresses, credentials, or your modified runtime config. If you clone the source, the local `site/config.json` remains a *tracked sample file*; do not commit your local changes to it. For production, prefer a separate deployment directory and the `compose.hub.yaml` image. `.gitignore` cannot hide changes to a tracked file.

Before publishing a public repository, inspect commit history and past Docker image layers separately: replacing a file in the latest commit does not erase historical copies. Rotate any credentials that may have been exposed.

## Migrating from an older image

1. Back up the existing `site/` and `data/` directories (including the `.env` file separately). Do not delete `config.json` or `data/security.json`.
2. Publish/build an image containing this change, then pull/rebuild and recreate the container using the commands under **Updating**.
3. Keep the existing volume mounts; the previous `site/index.html`, `site/app.js`, and `site/style.css` are harmless but unused. Remove them only after verifying the new image and saving a backup.
4. Verify the effective frontend with `docker exec dsdashboard grep -n "Configuration & Backups" /app/public/app.js`. The static content is bundled into the image; the running frontend is no longer read from `/site`.
5. Hard-refresh the browser. The Docker Hub `latest` tag will not incorporate these changes until a new image is pushed successfully by the maintainer.

**Security note:** `/site/config.json` is now only read through the config API rather than being a directly served static JSON file. The dashboard configuration API itself remains publicly readable to display the dashboard, so do not store credentials or secrets in config fields.
