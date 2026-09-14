# Production Dockerfile для Дублера. Многоэтапная сборка:
#   1) deps    — ставим зависимости (с кешированием слоя)
#   2) builder — генерируем Prisma client и собираем Next.js
#   3) runner  — минимальный runtime-образ
#
# Сборку делаем с --memory ≥ 2.5 GB, иначе Next.js 16 + React 19
# может упасть на оптимизации Tailwind.

# ---------- 1) deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- 2) builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma 7 prisma.config.ts требует DATABASE_URL даже на generate; реальный URL
# приходит в runtime из .env.production. На build этап подключения к БД нет.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
# NEXT_PUBLIC_* инлайнятся в client bundle на этапе билда. Принимаем ARG из
# docker-compose build.args (значения берутся из .env.production через :-).
# Если ARG не задан — будет пустая строка, и Analytics-компонент скипнет рендер.
ARG NEXT_PUBLIC_YANDEX_METRIKA_ID=""
ENV NEXT_PUBLIC_YANDEX_METRIKA_ID=$NEXT_PUBLIC_YANDEX_METRIKA_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build

# ---------- 3) runner ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Непривилегированный пользователь.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts

# Каталог под uploads — будет смонтирован volume'ом.
RUN mkdir -p /var/lib/doobler/uploads \
 && chown -R nextjs:nodejs /var/lib/doobler /app/.next

USER nextjs

EXPOSE 3000

# Запускаем prisma db push при старте, потом next start. Если в схеме
# появилось разрушительное изменение (DROP COLUMN и т.п.), prisma
# свалится в non-TTY — это хорошо, ловим деплой-ошибку до запуска.
# Используем shell-form, чтобы не плодить лишний entrypoint-файл.
CMD ["sh", "-c", "npx prisma db push && npm run start"]
