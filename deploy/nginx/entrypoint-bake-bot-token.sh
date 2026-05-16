#!/bin/sh
# Записывает TELEGRAM_BOT_TOKEN из переменной окружения в файл, который
# njs-модуль читает один раз при загрузке.
#
# Зачем отдельный файл, а не envsubst в config: токен — секрет. Если он
# попадёт в конфиг, любой `docker exec nginx cat /etc/nginx/nginx.conf`
# его покажет. Отдельный файл с правами 0600 уменьшает шанс случайной
# утечки в логах/диффах.

set -eu

TOKEN_FILE=/etc/nginx/njs/.bot-token

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
    echo "[nginx entrypoint] WARNING: TELEGRAM_BOT_TOKEN не задан;" >&2
    echo "[nginx entrypoint] edge-валидация initData будет fail-closed (401 на все Mini App API)." >&2
    : > "$TOKEN_FILE"
else
    printf '%s' "$TELEGRAM_BOT_TOKEN" > "$TOKEN_FILE"
fi

chown nginx:nginx "$TOKEN_FILE"
chmod 0600 "$TOKEN_FILE"
