#!/usr/bin/env bash
#
# deploy.sh — обновление Дублера на VPS после `git pull` (или после
# того, как новые файлы залиты через rsync).
#
# Запускать из /opt/doobler:
#   sudo bash deploy/deploy.sh
#
# Что делает:
#   1) перегенерирует Prisma client (внутри образа — npm run db:generate)
#   2) пересобирает app-образ
#   3) применяет миграции (prisma db push, см. CMD Dockerfile'а)
#   4) перезапускает контейнеры с zero-downtime по nginx (app — обычный restart)
#   5) перерегистрирует webhook на актуальный URL и secret
#
# Если миграции рискованные (DROP COLUMN и т.п.) — лучше сначала вручную
# `docker compose run --rm app npx prisma migrate deploy`.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/doobler}"
ENV_FILE="${PROJECT_DIR}/.env.production"
COMPOSE_FILE="${PROJECT_DIR}/deploy/docker-compose.yml"

log() { echo -e "\033[1;36m[deploy]\033[0m $*"; }

if [[ "${EUID}" -ne 0 ]]; then
    echo "Запусти от root: sudo bash $0" >&2
    exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Не найден ${ENV_FILE}. Сначала пройди bootstrap.sh." >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

cd "${PROJECT_DIR}"

log "1/5 Делаю снапшот БД на всякий случай"
bash "${PROJECT_DIR}/deploy/scripts/backup-db.sh" || log "Бэкап не сделан — продолжаю"

log "2/5 Пересобираю app-образ"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build app

log "3/5 Перезапускаю app (миграции применятся через prisma db push в CMD)"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --no-deps app

log "4/5 Перезагружаю nginx"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec nginx nginx -s reload || true

log "5/5 Регистрирую webhook"
WEBHOOK_URL="${NEXT_PUBLIC_APP_URL%/}/api/bot/webhook"
curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc --arg url "${WEBHOOK_URL}" \
                --arg secret "${TELEGRAM_WEBHOOK_SECRET}" \
                '{url: $url, secret_token: $secret, allowed_updates: ["message"], drop_pending_updates: false}')" \
    | jq -r '.description // "ok"'

log ""
log "✅ Готово. Проверь: curl -fsS https://${DOMAIN}/api/health"
