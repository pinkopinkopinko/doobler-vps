#!/usr/bin/env bash
#
# restore-db.sh — восстановление БД из бэкапа, созданного backup-db.sh.
# Использование:
#   bash deploy/scripts/restore-db.sh /var/backups/doobler/doobler-20260101-030000.sql.gz
#
# ВНИМАНИЕ: это destructive — pg_dump делается с --clean, существующие
# таблицы будут пересозданы. Запускать только осознанно.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/doobler}"
ENV_FILE="${PROJECT_DIR}/.env.production"

if [[ $# -ne 1 ]]; then
    echo "Использование: $0 <путь-до-доампа.sql.gz>" >&2
    exit 1
fi

DUMP="$1"
if [[ ! -f "${DUMP}" ]]; then
    echo "Файл ${DUMP} не найден" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

read -rp "Точно восстановить ${DUMP} в БД ${POSTGRES_DB}? [yes/NO] " ans
[[ "${ans}" == "yes" ]] || { echo "Отмена."; exit 0; }

echo "Останавливаю app..."
docker compose --env-file "${ENV_FILE}" -f "${PROJECT_DIR}/deploy/docker-compose.yml" stop app

echo "Восстанавливаю из ${DUMP}..."
gunzip -c "${DUMP}" | docker exec -i doobler-postgres \
    psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

echo "Стартую app обратно..."
docker compose --env-file "${ENV_FILE}" -f "${PROJECT_DIR}/deploy/docker-compose.yml" start app

echo "✅ Готово."
