# Дублер VPS

VDS-версия Telegram Mini App `Дублер` для замен в ПВЗ маркетплейсов. Эта папка хранит само приложение плюс production/VDS-инфраструктуру для будущего запуска на Ubuntu-сервере.

Полная инструкция по серверному деплою лежит в [DEPLOY.md](./DEPLOY.md) и [deploy/README.md](./deploy/README.md).

## Что входит в приложение

- Telegram Mini App auth через `initData`.
- Упрощенный bot flow: `/start` и `/app` открывают Mini App без лишнего одноразового login-token сценария.
- Явно контролируемый dev fallback через `ALLOW_DEV_AUTH_FALLBACK` и `ALLOW_DEV_DATA_FALLBACK`.
- Onboarding по ролям владельца, управляющего и работника.
- Создание смен, список смен, отклики и подтверждение кандидата.
- Запрет владельцам откликаться на смены.
- Чаты после мэтча, аватарки пользователей, вложения и счетчик непрочитанных.
- Завершение смены и двусторонние отзывы.
- Профиль, SVG/JPEG/PNG/WebP аватарки, имя/фамилия без цифр, возраст 16-99.
- Проверка телефона через Telegram contact share с автообновлением статуса в профиле.
- Админка, жалобы, баны, аудит действий.
- Светлая и темная темы с переключателем в Mini App.
- Smoke/utility тесты на auth, application flow, chat utils и profile photo.

## Стек

- `Next.js 16` App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- `PostgreSQL`
- `Prisma 7`
- `zod`
- `jose`
- `Vitest`
- Telegram Bot API
- Docker/nginx/certbot scripts for VDS deploy

## Структура

```text
src/
  app/                  Next.js App Router pages and route handlers
  components/           UI, profile, shifts, applications, chat, theme
  lib/                  auth, telegram, validation, uploads, helpers
  server/services/      business logic
  generated/prisma/     generated Prisma client
  proxy.ts              Next.js 16 proxy guard for admin/API

prisma/
  schema.prisma
  seed.ts

deploy/
  docker-compose.yml
  nginx/
  scripts/
  env.production.template

dark-mode/
  static dark-theme HTML/CSS concepts
```

## Локальный запуск

```bash
npm install
```

Создайте `.env.local` на базе `.env.example`.

Минимально важные переменные:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pvz_zamena_bot?schema=public"
SESSION_SECRET="replace-me"

TELEGRAM_BOT_TOKEN="replace-me"
TELEGRAM_BOT_USERNAME="replace_me"
TELEGRAM_WEBHOOK_SECRET=""

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Дублер"
NEXT_PUBLIC_DEV_TELEGRAM_ID="1000001"

ALLOW_DEV_AUTH_FALLBACK="false"
ALLOW_DEV_DATA_FALLBACK="false"

ADMIN_LOGIN=""
ADMIN_PASSWORD=""
ADMIN_PASSWORD_HASH=""

UPLOADS_DIR=""
```

Подготовить БД:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

Запуск:

```bash
npm run dev
```

Для Telegram/ngrok dev-проверки:

```bash
npm run dev:ngrok
```

## Проверки

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Перед production-деплоем обязательно прогнать весь набор. Текущий baseline после переноса из `pvz_zamena_bot`: 41 тест проходит.

## VDS deploy

Коротко:

1. Подготовить Ubuntu VDS.
2. Направить домен на IP сервера.
3. Залить проект в `/opt/doobler`.
4. Создать `/opt/doobler/.env.production` из `deploy/env.production.template`.
5. Запустить `sudo bash deploy/bootstrap.sh`.

Подробно: [DEPLOY.md](./DEPLOY.md).

## Git hygiene

Не коммитить:

- `.env*`
- `.next/`
- `node_modules/`
- `uploads/`
- `backups/`
- локальные dev/ngrok/postgres логи

`update-logs` фиксирует изменения по версиям. Новые записи добавляет Codex.
