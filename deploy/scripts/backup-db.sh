#!/usr/bin/env bash
#
# backup-db.sh — pg_dump в /var/backups/doobler с retention 14 дней.
# Запускается из cron'а, см. bootstrap.sh.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/doobler}"
ENV_FILE="${PROJECT_DIR}/.env.production"
BACKUP_DIR="/var/backups/doobler"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Нет ${ENV_FILE}" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

TS="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/doobler-${TS}.sql.gz"

echo "[$(date -Iseconds)] Делаю бэкап ${OUT}"
docker exec -i doobler-postgres \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --clean --if-exists \
  | gzip -9 > "${OUT}"

# Retention: удаляем дампы старше N дней.
find "${BACKUP_DIR}" -type f -name 'doobler-*.sql.gz' -mtime +"${RETENTION_DAYS}" -print -delete

echo "[$(date -Iseconds)] Готово. Размер: $(du -h "${OUT}" | cut -f1)"
