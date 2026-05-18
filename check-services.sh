#!/usr/bin/env bash
set -u

CONFIG="${CONFIG_PATH:-/site/config.json}"
OUTPUT="${STATUS_PATH:-/site/status.json}"
TIMEOUT="${STATUS_TIMEOUT:-5}"

mkdir -p "$(dirname "$OUTPUT")"
TMP="$(mktemp "$(dirname "$OUTPUT")/status.XXXXXX")"

cleanup() {
    rm -f "$TMP"
}
trap cleanup EXIT

if [ ! -f "$CONFIG" ]; then
    echo '{}' > "$TMP"
    mv "$TMP" "$OUTPUT"
    exit 0
fi

if ! jq empty "$CONFIG" >/dev/null 2>&1; then
    echo '{}' > "$TMP"
    mv "$TMP" "$OUTPUT"
    exit 0
fi

printf '{\n' > "$TMP"
FIRST=true

while IFS= read -r item; do
    ID="$(jq -r '.id // empty' <<< "$item")"
    TARGET="$(jq -r '.url // empty' <<< "$item")"

    [ -z "$ID" ] && continue
    [ -z "$TARGET" ] && continue

    STATUS=false

    if [[ "$TARGET" =~ ^https?:// ]]; then
        if curl -k -L -s --max-time "$TIMEOUT" "$TARGET" >/dev/null 2>&1; then
            STATUS=true
        fi
    else
        if ping -c 1 -W 2 "$TARGET" >/dev/null 2>&1; then
            STATUS=true
        fi
    fi

    if [ "$FIRST" = true ]; then
        FIRST=false
    else
        printf ',\n' >> "$TMP"
    fi

    printf '  "%s": %s' "$ID" "$STATUS" >> "$TMP"
done < <(jq -c '.sections[]?.items[]?' "$CONFIG")

printf '\n}\n' >> "$TMP"
mv "$TMP" "$OUTPUT"
