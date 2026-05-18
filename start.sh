#!/bin/sh
set -eu

: "${STATUS_INTERVAL:=60}"

chmod +x /app/check-services.sh || true

while true; do
    /bin/bash /app/check-services.sh || true
    sleep "$STATUS_INTERVAL"
done &

exec node /app/server.js
