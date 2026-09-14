# Production-образ для doobler-support-bot.
# Standalone Telegram-бот техподдержки на чистом Node.js, polling-режим.
# Зависимостей кот наплакал (один pg), поэтому простой single-stage build.

FROM node:22-alpine

WORKDIR /app

# pg иногда тянет нативные либы — libc6-compat для надёжности.
RUN apk add --no-cache libc6-compat

# Сначала только манифесты, чтобы npm ci кешировался по их изменению.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Дальше код.
COPY src ./src

# Непривилегированный пользователь.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 botuser \
 && chown -R botuser:nodejs /app

USER botuser

# Бот сам поллит api.telegram.org, никаких HTTP-портов наружу не светит.
# .env передаём через docker-compose env-секцию, не через --env-file=.env.
CMD ["node", "src/bot.js"]
