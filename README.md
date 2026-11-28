# DSDashboard

![Dashboard](https://github.com/user-attachments/assets/7b63904a-fbf1-4300-b307-af7b90ac7908)

![Settings](https://github.com/user-attachments/assets/8de41972-cc29-407c-96d2-33cb8476b88e)

A lightweight, self-hosted service dashboard with service search, favorites, Dashboard Icons, optional private access, HTTP/TCP/ICMP health checks, uptime history, TLS certificate expiry warnings, drag-and-drop editing and safe configuration backups.
## Features

- **3.1 · Usability:** local search (`Ctrl+K`, `/`), favorites (saved in the current browser), filters for Online/Warning/Offline/Unknown/Maintenance, normal/compact/large layouts and optional hidden status labels
- **3.1 · Icons:** searchable Dashboard Icons catalog, emoji support, editable icon slugs and on-demand local icon cache with fallback to a built-in list
- **3.2 · Monitoring:** configurable `auto`, `http`, `tcp`, `icmp` checks, health paths, specific HTTP response codes, latency warnings, maintenance mode, TLS expiration warnings and last-checked timestamps
- **3.2 · History:** bounded 31-day hourly aggregations, uptime and average response times for 24h/7d/30d, and a 24-hour visual history (no database required)
- **3.3 · Security:** optional password-protected **viewing** (in addition to protected editing), session cookies, CSRF protection, rate limiting and scrypt password hashes
- **3.3 · Reliability:** configuration backups before saves/restores, retention (default last 100), validation and a preview before restoring
- **3.3 · CI:** Node API/status-check tests and a headless Chrome integration test run **before** publishing the Docker image
- **4.1 · Browser bookmark drag-and-drop:** in Edit Mode, drop an HTTP(S) bookmark, address-bar URL or web link into any section; review its title, URL, icon and destination before saving, with duplicate detection
- **Existing functionality retained:** internal host/section drag-and-drop sorting, import/export, dark/light themes, colored sections, multiple host cards and status graphs

## Add browser bookmarks by drag-and-drop (4.1)

1. Open **Edit Mode** and sign in as an administrator.
2. Drag a bookmark from your browser bookmark bar (or a website link/address-bar URL) over the section where you want it.
3. Drop it anywhere inside the section. A dashed drop area appears at the bottom of every section in Edit Mode.
4. Confirm or adjust the **name, URL, destination section and icon** in the **Add Bookmark** dialog. Advanced options are available for the unique ID and health checks.
5. Press **Add Bookmark** to save. Duplicate URLs are flagged and require explicit confirmation before saving.

The link is **never saved on drop alone**. Browser drag data supplies the initial title where available; otherwise DSdashboard uses the hostname. Recognized services may receive a suggested Dashboard Icon, which you can change. The feature accepts a single `http://` or `https://` URL without embedded credentials and does not fetch metadata from the destination. It does **not** import a browser bookmark folder or an exported bookmarks HTML file. Support for dragging from bookmark bars may vary with browser and operating system; the existing **Add Host** form remains available as an alternative.

This feature does not alter the configuration format, Docker volumes, API or health-check behavior. Existing emoji/Dashboard Icons values and internal drag-and-drop sorting continue to work. Test locally before publishing a new image.

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

Replace `DASHBOARD_ADMIN_PASSWORD` with a strong, unique password **before** starting. Then run:

```bash
mkdir -p site data
chmod 600 .env
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
docker compose -f compose.hub.yaml up -d
docker compose -f compose.hub.yaml ps
```
Replace `DASHBOARD_ADMIN_PASSWORD` with a strong, unique password before the first start. Open `http://SERVER-IP:8080`.
On first start, the app creates `/site/config.json` from `/app/defaults/config.json` only if it does not exist. Frontend assets (`index.html`, `app.js`, `style.css`) are served from **`/app/public/` inside the Docker image** and are never copied to `/site`. Existing `/site/config.json` is preserved.
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

> Docker `run` does not apply the Compose file's required-password validation; make sure `.env` has a strong password before starting.
## Configuration variables

Copy `env.example` to `.env`. The settings below can be changed:
| Variable | Default | Purpose |
| --- | --- | --- |
| `DASHBOARD_ADMIN_PASSWORD` | Required, no safe default | First-run admin password (at least 16 characters). **Always override.** |
| `SESSION_TIMEOUT_MINUTES` | `30` | Session duration, clamped to 10–480 minutes |
| `COOKIE_SECURE` | `false` | Set `true` when browsing through HTTPS |
| `STATUS_INTERVAL` | `60` | Seconds between status checks |
| `STATUS_TIMEOUT` | `5` | Health-check timeout in seconds |
| `STATUS_INSECURE_TLS` | `false` | **Global** HTTPS certificate verification bypass for self-signed services; use sparingly. |
| `DASHBOARD_PRIVATE_VIEW` | `false` | First-run private-view default (later managed from Security settings) |
| `BACKUP_MAX_FILES` | `100` | Keep the newest N config backups (5–1000); older files are deleted on the next backup |
| `DASHBOARD_BIND_IP` | `0.0.0.0` | Host interface for the Compose port binding |
| `DASHBOARD_PORT` | `8080` | Host port for the Compose port binding |
| `TZ` | `Europe/Stockholm` | Container timezone in the provided Compose files |
`DASHBOARD_BIND_IP`, `DASHBOARD_PORT`, and `TZ` are used by the supplied Compose files, not directly by the application. Existing settings in `/data/security.json` take precedence over the initial password and initial session timeout in `.env`.
## Persistent data and first-run behavior

| Host directory | Container directory | Contents |
| --- | --- | --- |
| `./site` | `/site` | Runtime `config.json` and `status.json` (legacy frontend files here are ignored) |
| `./data` | `/data` | `security.json`, `backups/`, `status-history.json` and `icon-cache/` |
These are **bind mounts**. Recreating/updating the container does not delete their contents. The frontend is **served from `/app/public/` in the image**; rebuilding or pulling an updated image updates frontend assets automatically. Old `/site/app.js`, `/site/index.html`, and `/site/style.css` files are not used and do not need replacing. Back up `site/` and `data/` before updating.
The first start initializes `data/security.json` with a **scrypt password hash** from `DASHBOARD_ADMIN_PASSWORD`. Changing `.env` later **does not change an existing admin password**. Use the Security panel to change it. As a last-resort reset, back up `/data/security.json`, stop the container, remove that file, verify `.env`, and start again. This recreates the file and can reset security-related settings. Do not delete the whole `data/` directory or its backups.
Back up **both** `site/` and `data/` before migrations or major updates. Do not commit `.env` or `data/security.json` to Git.
## Status checks and historical uptime

`start.sh` starts a background loop that runs `node /app/status-checker.js` via `check-services.sh`. The checker reads `/site/config.json`, writes `/site/status.json` atomically, and stores hourly rollups in `/data/status-history.json`. No additional database or API token is required. A status file from an older version continues to display while the new worker begins writing detailed records.

Per service, configure the **Health check options** in Edit Host or Add Host:

| Setting | Default | Explanation |
| --- | --- | --- |
| Check type | `auto` | HTTP for `http(s)://` URLs, otherwise ICMP/ping |
| `http` | — | HTTP(S) GET; status **200–399** is Online by default; **4xx/5xx Offline** unless an exact expected code was configured |
| `tcp` | — | Test an open TCP port; set a port in the editor |
| `icmp` | — | ICMP echo request (requires Docker network permission to ping) |
| HTTP path | Empty | Optional path to check, e.g. `/health` |
| Expected HTTP code | `0` | `0` means 200–399; any 200–599 value requires an exact match, including 401 or 503 where intentional |
| Slow response warning | `0` | Set milliseconds above which a reachable service becomes Warning |
| TLS expiry warning | `30` | For HTTPS checks, warn when the certificate expires within N days |
| Maintenance mode | Off | Pauses the probe and excludes the service from uptime calculations |

Statuses: **Online**, **Warning**, **Offline**, **Unknown** (no/freshly missing or stale check data), and **Maintenance**. A warning is not counted as fully healthy in uptime figures. The stats card shows **24-hour measured availability**, not the current fraction of services online, and becomes available after the first check. Each card supports a history view of the past 24 hours and summaries for 24h/7d/30d. Hourly aggregates are retained for approximately 31 days; no historical data exists before enabling this version.

HTTPS certificate verification is enabled by default. Set `STATUS_INSECURE_TLS=true` only if your environment deliberately uses self-signed/untrusted certificates; it affects **all** monitored HTTPS targets. Normal, valid certificates can be monitored for expiration even when verification is enabled. HTTP redirects are treated as successful 3xx responses by default (the checker does not follow redirects).

Run a check immediately:

```bash
docker exec dsdashboard /app/check-services.sh
docker exec dsdashboard cat /site/status.json
```

The internal `/api/health` endpoint is used for the Docker health check, including when private view is enabled. The `/api/status`, `/api/config` and `/api/history` endpoints require login only when private viewing is enabled.

## HTTPS and reverse proxy

For internet-facing deployments, use a trusted HTTPS reverse proxy, configure access controls as appropriate, and set `COOKIE_SECURE=true` in `.env`. Recreate the container after changing the setting. Do **not** set this flag when accessing the app only via plain HTTP, or login cookies may not work.
If the reverse proxy runs on the same host, consider `DASHBOARD_BIND_IP=127.0.0.1` to avoid exposing port 8080 on all host interfaces. Login rate limiting uses the direct TCP peer address, not untrusted `X-Forwarded-For` headers. Behind a reverse proxy, this means all visitors may share the proxy address for the login-attempt limit. Restrict external exposure and consider protection at the proxy as well. Avoid direct internet exposure without additional protection.
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

Before updating, back up both persistent directories. The frontend comes from the new image; runtime config and security data remain in their mounted directories.
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

The frontend icon picker is implemented in **`site/app.js` in this repository**, which Docker builds into `/app/public/app.js`. To add icons, edit the source file, commit, build/publish a new image and redeploy it. Editing `/site/app.js` inside the running container does **not** affect the served frontend. `ICONS` supplies host icons; `SECTION_ICONS` shares the same library for section icons.
## Troubleshooting
- **Cannot log in after changing `.env`:** the initial password hash remains in `/data/security.json`; use Security settings or follow the careful reset procedure above.
- **Blank page or missing assets:** check `/app/public/index.html`, `/app/public/app.js`, and `/app/public/style.css` in the image; check the browser Console and container logs. Verify the browser is not serving a cached older `app.js`.
- **No status information:** check `/site/config.json`, run the manual status check, and inspect `/site/status.json`.
- **Port 8080 already in use:** change `DASHBOARD_PORT` in `.env` and recreate the Compose service.
- **Unhealthy container:** inspect `docker logs dsdashboard` and test `docker exec dsdashboard wget -qO- http://127.0.0.1:3000/api/health`.
## License

See [LICENSE](LICENSE) in this repository.
## Automated weekly Docker rebuilds and controlled updates
The GitHub Actions workflow `.github/workflows/build.yml` builds both `linux/amd64` and `linux/arm64` images for Docker Hub (`d0sn/dsdashboard`) and GHCR (`ghcr.io/dosenthegit/dsdashboard`). It runs on commits to `main`, on version tags, manually, and **every Sunday at 05:35 Europe/Stockholm** (as configured in the workflow). Normal builds use layer cache. Scheduled builds always pull the base image and rebuild without cache; manual runs can also request a full rebuild.
The Dockerfile uses `node:24-alpine`, so Node 24 receives available patch releases without silently switching the Node major version. Weekly rebuilding does not guarantee that every dependency is upgraded or that the image is vulnerability-free. Only a workflow passing the static, API and browser smoke tests can **publish** the image: it does not restart a running dashboard.
For an existing deployment using `compose.hub.yaml`, first back up `.env`, `site/`, and `data/`. From the deployment directory containing `compose.hub.yaml`, run:

```bash
./scripts/update.sh
```
`update.sh` downloads the new Docker Hub image, backs up persistent data under `./backups/`, restarts the service, and waits for Docker health status. It does not change passwords or automatically roll back a failed upgrade. Keep the old image and archive available if manual recovery is needed. The deployment script expects `scripts/update.sh` and `compose.hub.yaml` in the same project directory.
For a source-built deployment, continue using `git pull && docker compose up -d --build`; `update.sh` is for published-image deployments only.
The workflow expects repository **variable** `DOCKERHUB_USERNAME` and repository **secret** `DOCKERHUB_TOKEN`, matching the existing publishing setup. It also syncs README.md to Docker Hub after successful builds on `main`. To deploy from GHCR instead, change the `image:` value in `compose.hub.yaml` to `ghcr.io/dosenthegit/dsdashboard:latest`.


## Dashboard Icons and offline cache

Hosts and section icon pickers support emojis and [Dashboard Icons](https://dashboardicons.com/). Search the full native icon catalog, or enter a slug manually. Existing `di:proxmox`, `di:home-assistant` and emoji values are preserved across upgrades. Long slugs are supported, unlike older versions.

The server downloads the upstream `tree.json` index **once per 24 hours** to `/data/icon-cache/catalog.json` and serves it to authenticated editors at `/api/icon-catalog`. Product logos are fetched on demand to `/data/icon-cache/<slug>.<format>` and then served from the dashboard's own `/icons/` path. Previously fetched icons remain available when the CDN cannot be reached, assuming your persistent `/data` mount remains intact. The index uses its cached copy if a refresh fails; without any saved index, the built-in list and manual slug entry still work. The cache is limited to 800 icon files. SVG, PNG and WebP are supported. Icons not part of the native repository may still need a manually supplied slug, or may not be available.

Icon assets and product names belong to their respective owners. Do not commit your personal `config.json`, `security.json`, `.env` or `/data` content to GitHub.

## Backups and recovery

Configuration is backed up **before** changes. In Edit Mode, choose **View Backups** to download, preview, restore or delete a snapshot. The preview validates the JSON and compares the number of sections/services with the current configuration, and asks for confirmation before replacing it. A backup of the present configuration is created before a restore. To limit disk growth, `BACKUP_MAX_FILES` controls retention; older config backups are removed only when a new backup is created. Full `site/` and `data/` backups are still recommended before upgrades.

## Automated checks and local testing

```bash
npm run check        # JavaScript syntax, DOM event ID links, integration wiring
npm test             # HTTP/TCP checks, history, privacy, API and backups
npm run test:browser:offline # Chromium UI with mocked APIs (no localhost access required)
npm run test:browser         # Chromium + real server: load, edit, save/reload, private view
```

The browser check uses the Chrome DevTools Protocol without JavaScript dependencies. On Linux set `CHROME_PATH` if Chromium is installed in a nonstandard location. A corporate Chrome policy that forbids local addresses may prevent running `test:browser` locally; `test:browser:offline` tests the real UI against mocked APIs without navigating to a local address. GitHub Actions uses a clean Chrome for Testing binary. The `.github/workflows/build.yml` workflow runs all checks **before** publishing the Docker image.
