# Дублер

`Дублер` — Telegram Mini App для поиска подмен, смен и сотрудников для ПВЗ маркетплейсов в России (Ozon, Wildberries, Яндекс Маркет).

Проект собирается как быстрый MVP внутри Telegram:
- владельцы и управляющие ПВЗ публикуют смены и вакансии;
- сотрудники и подменные работники откликаются на них;
- после мэтча стороны общаются в чате внутри Mini App, завершают смену и оставляют друг другу отзывы.

## Что уже реализовано

- Telegram Mini App на `Next.js 16` + `React 19` + `TypeScript`
- `PostgreSQL` + `Prisma 7` (сгенерированный клиент лежит в `src/generated/prisma`)
- авторизация через Telegram `initData` + cookie-сессия на `jose`
- fallback-вход через одноразовый bot login token, если Telegram не передал `initData`
- onboarding с ролями работодателя, менеджера, сотрудника и подменного работника
- профили пользователей, ПВЗ, доступы менеджеров (`PickupPointManagerAccess`)
- создание смен, отклики, ранжирование откликов (`lib/scoring/match-score`)
- подтверждение кандидата работодателем, завершение смены, двусторонние отзывы
- чаты после мэтча с фото-вложениями и счётчиком непрочитанных
- уведомления через Telegram Bot API + хранение в `Notification`
- модерация: жалобы, аудит-лог, real-бан пользователей
- отдельный вход в админку по логину и паролю + middleware-гард для всех `/admin*` маршрутов
- забаненный пользователь видит только свой профиль и метку блокировки, без загрузки остального Mini App
- адресные подсказки и валидация адреса через DaData
- запуск через `ngrok` с автоматической синхронизацией webhook, menu button и bot commands

## Текущий стек

- Frontend: `Next.js App Router`, `React 19`, `TypeScript`, `Tailwind CSS v4`
- Backend: `Next.js Route Handlers` + сервисный слой в `src/server/services`
- Database: `PostgreSQL`
- ORM: `Prisma 7` (`@prisma/adapter-pg` + `pg`)
- Auth: Telegram WebApp `initData` + cookie session (`jose` JWT)
- Validation: `zod`
- Storage: локальное файловое хранилище для MVP uploads (`UPLOADS_DIR`)
- Notifications: `Telegram Bot API`
- Address autocomplete: DaData
- Шрифт: локальный `Wix Madefor Display`

## Структура проекта

```
src/
  app/
    (app)/             — экраны Mini App (home, shifts, posts, applications,
                          chats, reviews, profile, profiles/[userId],
                          onboarding, moderation)
    admin/             — админка (page, layout, audit, reports, shifts,
                          users, users/[id])
    admin-login/       — отдельный экран входа в админку
    api/               — route handlers
      auth/            — telegram, bot-token, me, client-debug, debug
      bot/webhook      — приём апдейтов Telegram
      address-suggestions, address-verify — DaData
      cities, regions, marketplaces, pickup-points, managers — справочники
      shift-posts/[id]/{applications,cancel,favorite}
      applications/{[id]/confirm,mine}
      assignments/{[id]/{complete,reviews},mine}
      chats/{[id]/{messages,read},unread}
      notifications/{[id]/read}
      reports, moderation/reports/[id]/resolve
      uploads/[id]
      profile/[userId]
      health
      admin/{auth/{login,logout},audit,stats,
             reports/[id]/action,
             shifts/[id]/cancel,
             users/{search,[id]/{ban,unban,roles}}}
    fonts/             — локальный Wix Madefor Display
  components/
    admin, applications, chat, layout, navigation, profile, shifts, ui
  lib/
    auth/              — session, telegram, admin-session, app-access,
                          require-admin-access, require-moderator
    chat/              — participant-key, uploads (+ unit-тесты)
    geocoder/          — DaData-клиент (suggest + geocode)
    notifications/     — отправка через Telegram Bot API
    telegram/          — bot, webapp helpers
    scoring/           — ранжирование откликов
    validations/       — zod-схемы
    constants, types, utils, prisma, profile-completion,
    russian-million-cities, demo-data, api, client/reference-cache
  server/services/     — application, shift-post, profile, manager-access,
                          chat, chat-notifier, media-storage, admin
  generated/prisma/    — сгенерированный Prisma 7 client
  proxy.ts             — middleware (в Next.js 16 переименовано из middleware
                          в proxy) — baseline-гард для /admin и /api/admin
prisma/
  schema.prisma        — схема БД
  seed.ts              — demo seed
scripts/
  dev-ngrok, ngrok-utils, sync-ngrok-url,
  register-telegram-webhook, hash-admin-password
public/                — статика
design/, design-test/  — дизайн-макеты (не входят в рантайм)
```

## Локальный запуск

### 1. Установить зависимости

```bash
npm install
```

### 2. Подготовить `.env.local`

Скопируйте `.env.example` в `.env.local` и заполните значения:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pvz_zamena_bot?schema=public"
SESSION_SECRET="change-me-to-a-long-random-string"

TELEGRAM_BOT_TOKEN="replace-with-bot-token"
TELEGRAM_BOT_USERNAME="replace_with_bot_username"
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

Важно:
- `.env.local` не коммитится в git
- если токен бота где-то засветился, его нужно сразу перевыпустить
- `ALLOW_DEV_*_FALLBACK` работают только при `NODE_ENV !== "production"`
- в проде используйте `ADMIN_PASSWORD_HASH` (генерится через `npm run admin:hash-password`); plaintext `ADMIN_PASSWORD` в проде отклоняется
- `UPLOADS_DIR` обязателен в проде — fallback на `/tmp` запрещён
- `TELEGRAM_WEBHOOK_SECRET` — длинная случайная строка для заголовка `X-Telegram-Bot-Api-Secret-Token`; если пусто, в dev используется детерминированное значение из токена

### 3. Поднять PostgreSQL

Если Postgres установлен локально, достаточно создать базу и указать `DATABASE_URL`.

Если используете Docker:

```bash
docker compose up -d postgres
```

### 4. Применить Prisma

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

Или одной командой:

```bash
npm run dev:setup
```

### 5. Сгенерировать хеш админ-пароля

```bash
npm run admin:hash-password
```

Скопируйте полученный хеш в `ADMIN_PASSWORD_HASH` и задайте `ADMIN_LOGIN`.

### 6. Запустить приложение

Обычный локальный запуск:

```bash
npm run dev
```

Запуск для Telegram Mini App через `ngrok`:

```bash
npm run dev:ngrok
```

Этот режим:
- подхватывает текущий публичный `ngrok` URL;
- обновляет `NEXT_PUBLIC_APP_URL`;
- сохраняет runtime URL в `.dev-ngrok-url`;
- обновляет webhook Telegram-бота;
- обновляет menu button и bot commands.

## Полезные команды

```bash
npm run lint
npm run build
npm run db:studio
npm run bot:register
npm run ngrok:sync
npm run admin:hash-password
```

## Telegram bot flow

Основной сценарий для теста:

1. Запустить проект через `npm run dev:ngrok`
2. Отправить боту `/start`
3. Открыть свежую inline-кнопку Mini App из нового сообщения

Почему это важно:
- Telegram не всегда стабильно отдаёт `initData`;
- для таких случаев в проекте есть fallback-вход через одноразовый `loginToken`;
- токен подставляется именно в свежую кнопку из сообщения бота.

## Админка

- Доступ: `/admin-login` → форма с логином и паролем (`ADMIN_LOGIN` / `ADMIN_PASSWORD_HASH`)
- Все маршруты `/admin*` и `/api/admin*` дополнительно защищены middleware (`src/proxy.ts`):
  - без cookie-сессии UI редиректит на `/admin-login`;
  - API возвращает `401`;
  - криптографическая проверка сессии и роли выполняется ниже, в `requireAdminAccess()`
- Возможности: поиск пользователей, выдача и снятие ролей, бан/разбан, отмена смен, разбор жалоб, аудит-лог, метрики

## Тесты

Юнит-тесты есть для критичных утилит чата:

- `src/lib/chat/participant-key.test.ts`
- `src/lib/chat/uploads.test.ts`

Отдельный `npm test` пока не настроен — запускаются вручную через `tsx` или вашу IDE.

## Что важно знать

- это **Next.js 16**, у него своя специфика (см. `AGENTS.md`); в частности middleware теперь называется `proxy` и лежит в `src/proxy.ts`
- `main` — единственная актуальная ветка, на неё и ориентируемся
- папка `backups/` локальная, в репозиторий не входит
- uploads в MVP пока локальные (`UPLOADS_DIR`), позже — S3-compatible
- сгенерированный Prisma client коммитится в `src/generated/prisma`, чтобы не зависеть от postinstall на CI
- дизайн ещё будет дорабатываться: сервис уже называется `Дублер`, визуальный стиль позже обновим отдельно

## Реализованные продуктовые блоки

### Для работодателя

- регистрация и профиль
- публикация смены
- просмотр откликов и профиля кандидата
- подтверждение исполнителя
- завершение смены
- отзыв о работнике
- чат с подтверждённым кандидатом

### Для работника

- регистрация и профиль
- просмотр ленты смен с фильтрами по городу/району/маркетплейсу
- избранное
- отклик на смену
- история откликов
- чат после мэтча
- отзыв о работодателе после завершения смены

### Для платформы

- Telegram auth (initData + bot login token fallback)
- trust signals и отзывы
- жалобы и модерация
- admin-метрики и поиск пользователей
- логирование auth/debug сценариев
- audit-лог админ-действий
- real-бан с гейтом на входе в Mini App

## Ближайшие шаги

- обновить дизайн приложения под новый бренд `Дублер`
- привести весь UI к единой дизайн-системе
- улучшить realtime для чатов
- вынести uploads в S3-compatible storage
- усилить антифрод и trust & safety
- добавить полноценный production deploy и CI
- настроить запуск тестов из `npm test`
