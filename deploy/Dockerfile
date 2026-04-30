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
COPY --from=builder /app/src/generated ./src/generated
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
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start"]
