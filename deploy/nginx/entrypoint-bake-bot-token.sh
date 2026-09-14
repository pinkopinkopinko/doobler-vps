#!/bin/sh
# Writes bot tokens from environment to private files read by the njs module.
#
# Tokens are kept out of generated nginx config, so `docker exec nginx cat
# /etc/nginx/nginx.conf` cannot print them. Files are chmod 0600.

set -eu

TELEGRAM_TOKEN_FILE=/etc/nginx/njs/.bot-token
MAX_TOKEN_FILE=/etc/nginx/njs/.max-bot-token

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
    echo "[nginx entrypoint] WARNING: TELEGRAM_BOT_TOKEN is not set;" >&2
    echo "[nginx entrypoint] Telegram/Mini App edge validation will fail closed for Telegram." >&2
    : > "$TELEGRAM_TOKEN_FILE"
else
    printf '%s' "$TELEGRAM_BOT_TOKEN" > "$TELEGRAM_TOKEN_FILE"
fi

if [ -z "${MAX_BOT_TOKEN:-}" ]; then
    echo "[nginx entrypoint] WARNING: MAX_BOT_TOKEN is not set;" >&2
    echo "[nginx entrypoint] Mini App edge validation will fail closed for MAX." >&2
    : > "$MAX_TOKEN_FILE"
else
    printf '%s' "$MAX_BOT_TOKEN" > "$MAX_TOKEN_FILE"
fi

chown nginx:nginx "$TELEGRAM_TOKEN_FILE" "$MAX_TOKEN_FILE"
chmod 0600 "$TELEGRAM_TOKEN_FILE" "$MAX_TOKEN_FILE"
