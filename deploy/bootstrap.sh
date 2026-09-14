#!/usr/bin/env bash
#
# bootstrap.sh — поднимает Дублер на чистом Ubuntu 22.04 / 24.04 VPS.
#
# Что делает по порядку:
#   1) обновляет систему, ставит базовый набор утилит
#   2) ставит Docker Engine + Docker Compose plugin
#   3) включает ufw (22, 80, 443) и fail2ban для SSH
#   4) копирует/проверяет /opt/doobler/.env.production
#   5) подставляет ${DOMAIN} в nginx-конфиг
#   6) выпускает Let's Encrypt сертификат через webroot-плагин
#   7) поднимает app + postgres + nginx + certbot через docker compose
#   8) регистрирует webhook у Telegram
#   9) ставит cron на ежедневные бэкапы Postgres
#
# Использование (после `git clone` или `scp` проекта):
#   sudo bash /opt/doobler/deploy/bootstrap.sh
#
# Идемпотентен: можно запускать повторно — ничего лишнего не сломает.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/doobler}"
ENV_FILE="${PROJECT_DIR}/.env.production"
COMPOSE_FILE="${PROJECT_DIR}/deploy/docker-compose.yml"
NGINX_CONF_SRC="${PROJECT_DIR}/deploy/nginx/conf.d/dubler.conf"

log() { echo -e "\033[1;36m[bootstrap]\033[0m $*"; }
err() { echo -e "\033[1;31m[bootstrap]\033[0m $*" >&2; }

if [[ "${EUID}" -ne 0 ]]; then
    err "Запусти от root: sudo bash $0"
    exit 1
fi

# ---- 1) Системные пакеты ---------------------------------------------------
log "Обновляю apt и ставлю базовый набор утилит"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y \
    ca-certificates curl gnupg lsb-release \
    ufw fail2ban cron htop git rsync gettext-base jq

# ---- 2) Docker -------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
    log "Ставлю Docker Engine"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | tee /etc/apt/sources.list.d/docker.list >/dev/null
    apt-get update -y
    apt-get install -y \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
else
    log "Docker уже установлен — пропускаю"
fi

# ---- 3) ufw + fail2ban -----------------------------------------------------
log "Настраиваю ufw (22/80/443)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'ssh'
ufw allow 80/tcp comment 'http'
ufw allow 443/tcp comment 'https'
ufw --force enable

log "Включаю fail2ban"
systemctl enable --now fail2ban

# ---- 4) .env.production ----------------------------------------------------
if [[ ! -f "${ENV_FILE}" ]]; then
    err "${ENV_FILE} не найден."
    err "Создай файл из шаблона:"
    err "    cp ${PROJECT_DIR}/deploy/env.production.template ${ENV_FILE}"
    err "и заполни значения (секреты можно сгенерировать через"
    err "    bash ${PROJECT_DIR}/deploy/scripts/gen-secrets.sh)."
    exit 1
fi

# Проверяем, что обязательные значения не остались дефолтными.
if grep -E '^(SESSION_SECRET|TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET|ADMIN_PASSWORD_HASH|POSTGRES_PASSWORD)=CHANGE_ME' "${ENV_FILE}" >/dev/null; then
    err "В ${ENV_FILE} остались placeholder-значения CHANGE_ME_*"
    err "Заполни всё перед запуском."
    grep -nE '^(SESSION_SECRET|TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET|ADMIN_PASSWORD_HASH|POSTGRES_PASSWORD)=CHANGE_ME' "${ENV_FILE}" >&2
    exit 1
fi

# Жёсткие права на env-файл.
chmod 600 "${ENV_FILE}"

# Подгружаем переменные, чтобы дальше использовать ${DOMAIN}, ${ACME_EMAIL}.
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

# ---- 5) nginx config (подставляем DOMAIN) ----------------------------------
log "Подставляю DOMAIN=${DOMAIN} в nginx-конфиг"
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "${NGINX_CONF_SRC}"

# ---- 6) Сертификат Let's Encrypt -------------------------------------------
CERT_PATH="/var/lib/docker/volumes/doobler_certbot_certs/_data/live/${DOMAIN}/fullchain.pem"

if [[ ! -f "${CERT_PATH}" ]]; then
    log "Поднимаю временный nginx без TLS для ACME challenge"

    # Создаём минимальный http-only конфиг, чтобы certbot мог пройти challenge.
    TMP_CONF="${PROJECT_DIR}/deploy/nginx/conf.d/dubler.conf"
    BACKUP_CONF="${TMP_CONF}.full"
    cp "${TMP_CONF}" "${BACKUP_CONF}"

    cat > "${TMP_CONF}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / { return 200 "ok"; }
}
EOF

    # Поднимаем только nginx + certbot (без app/postgres — они стартуют после).
    cd "${PROJECT_DIR}"
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d nginx

    log "Запускаю certbot для получения сертификата ${DOMAIN}"
    docker run --rm \
        -v doobler_certbot_certs:/etc/letsencrypt \
        -v doobler_certbot_www:/var/www/certbot \
        certbot/certbot:latest \
        certonly --webroot -w /var/www/certbot \
            --email "${ACME_EMAIL}" --agree-tos --no-eff-email \
            --cert-name "${DOMAIN}" \
            -d "${DOMAIN}" \
            -d "www.${DOMAIN}"

    # Возвращаем полный конфиг с TLS.
    mv "${BACKUP_CONF}" "${TMP_CONF}"
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec nginx nginx -s reload || true
else
    log "Сертификат для ${DOMAIN} уже есть — пропускаю выпуск"
fi

# ---- 7) Полный стек --------------------------------------------------------
log "Поднимаю app + postgres + nginx + certbot"
cd "${PROJECT_DIR}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build

log "Жду пока app станет здоровым..."
for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "https://${DOMAIN}/api/health"; then
        log "App жив на https://${DOMAIN}/api/health"
        break
    fi
    sleep 2
done

# ---- 8) Регистрация webhook у Telegram ------------------------------------
log "Регистрирую webhook у Telegram"
WEBHOOK_URL="${NEXT_PUBLIC_APP_URL%/}/api/bot/webhook"
curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc --arg url "${WEBHOOK_URL}" \
                --arg secret "${TELEGRAM_WEBHOOK_SECRET}" \
                '{url: $url, secret_token: $secret, allowed_updates: ["message"], drop_pending_updates: true}')" \
    | jq .

# ---- 9) Cron-бэкапы Postgres ----------------------------------------------
log "Ставлю cron на ежедневные бэкапы БД"
mkdir -p /var/backups/doobler
chmod 700 /var/backups/doobler

CRON_LINE="0 3 * * * root bash ${PROJECT_DIR}/deploy/scripts/backup-db.sh >> /var/log/doobler-backup.log 2>&1"
CRON_FILE="/etc/cron.d/doobler-backup"
echo "${CRON_LINE}" > "${CRON_FILE}"
chmod 644 "${CRON_FILE}"

# Cron на reload nginx после обновления сертификата.
echo "0 4 * * * root docker exec doobler-nginx nginx -s reload >/dev/null 2>&1" \
    > /etc/cron.d/doobler-nginx-reload
chmod 644 /etc/cron.d/doobler-nginx-reload

systemctl restart cron

log ""
log "✅ Готово. Дублер крутится на https://${DOMAIN}"
log ""
log "Полезное:"
log "  логи app   — docker logs -f doobler-app"
log "  логи nginx — docker logs -f doobler-nginx"
log "  shell в БД — docker exec -it doobler-postgres psql -U ${POSTGRES_USER} ${POSTGRES_DB}"
log "  бэкап БД   — bash ${PROJECT_DIR}/deploy/scripts/backup-db.sh"
log "  обновление — git pull && bash ${PROJECT_DIR}/deploy/deploy.sh"
