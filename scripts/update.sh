#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v docker >/dev/null || { echo 'Docker is not installed' >&2; exit 1; }
test -f compose.hub.yaml || { echo 'Missing compose.hub.yaml' >&2; exit 1; }
test -f .env || { echo 'Missing .env' >&2; exit 1; }
mkdir -p site data backups
# Fetch before stopping the running container.
docker compose -f compose.hub.yaml pull
archive="backups/dsdashboard-before-update-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$archive" -- .env site data
chmod 600 "$archive"
echo "Backup saved to $archive"
docker compose -f compose.hub.yaml up -d --no-build
cid="$(docker compose -f compose.hub.yaml ps -q dsdashboard)"
if [[ -z "$cid" ]]; then echo 'Service not running' >&2; exit 1; fi
for attempt in $(seq 1 45); do
  state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")"
  if [[ "$state" == healthy ]]; then echo 'DSDashboard update successful (healthy)'; exit 0; fi
  if [[ "$state" == unhealthy || "$state" == exited || "$state" == dead ]]; then
    echo "DSDashboard health status: $state; backup: $archive" >&2
    exit 1
  fi
  sleep 2
done
echo "Health check timed out; backup: $archive" >&2
exit 1
