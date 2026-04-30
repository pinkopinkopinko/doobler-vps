#!/usr/bin/env bash
#
# gen-secrets.sh — генерирует все секреты, которые нужны в .env.production.
# Запускать ЛОКАЛЬНО (не на VPS), чтобы не светить токены в логах сервера.
#
#   bash deploy/scripts/gen-secrets.sh
#
# ADMIN_PASSWORD_HASH генерируется через npm run admin:hash-password
# (нужен установленный node_modules) — отдельной командой.

set -euo pipefail

cat <<EOF
# ============================================================
# Сгенерированные секреты — скопируй в .env.production
# ============================================================

POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/' | head -c 32)
SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)

# DATABASE_URL надо собрать с тем же POSTGRES_PASSWORD:
#   postgresql://doobler:<POSTGRES_PASSWORD>@postgres:5432/doobler?schema=public

# ADMIN_PASSWORD_HASH — отдельной командой, требует node_modules:
#   npm install
#   npm run admin:hash-password
# и скопируй хеш из stdout.
EOF
