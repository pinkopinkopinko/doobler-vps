#!/usr/bin/env bash
#
# register-webhook.sh — регистрация webhook у Telegram. Полезно, если
# нужно перепривязать бот после смены домена/secret'а без полного
# деплоя.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/doobler}"
ENV_FILE="${PROJECT_DIR}/.env.production"

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

WEBHOOK_URL="${NEXT_PUBLIC_APP_URL%/}/api/bot/webhook"

echo "Регистрирую webhook на ${WEBHOOK_URL}"
curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc --arg url "${WEBHOOK_URL}" \
                --arg secret "${TELEGRAM_WEBHOOK_SECRET}" \
                '{url: $url, secret_token: $secret, allowed_updates: ["message"], drop_pending_updates: true}')" \
    | jq .

echo
echo "Текущий webhook info:"
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq .
