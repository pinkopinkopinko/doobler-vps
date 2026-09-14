# Дублер

`Дублер` - Telegram Mini App для замен в ПВЗ маркетплейсов. Сервис помогает владельцам и управляющим быстро публиковать смены, а работникам - находить подработки, откликаться, переписываться после подтверждения и закрывать смены с отзывами.

Проект сейчас ориентирован на Telegram/ngrok-разработку. VDS/production-настройки будут отдельно, когда появится сервер и DNS.

## Что уже есть

- Telegram Mini App auth через `initData`.
- Упрощенный bot flow: `/start` и `/app` открывают Mini App.
- Резервный `bot-token` вход для случаев, когда Telegram WebApp-контекст не приехал.
- Onboarding по ролям владельца, управляющего и работника.
- Создание смен, список смен, отклики, подтверждение кандидата.
- Запрет владельцам откликаться на смены.
- Чаты между сторонами после мэтча, включая аватарки и вложения.
- Завершение смены и двусторонние отзывы.
- Профиль, проверка телефона через Telegram contact share и автообновление статуса.
- Верификация личности по фото документов: пользователь загружает фото из профиля, модератор в админке отмечает `APPROVED`, `REJECTED` или просит дополнить (`NEEDS_MORE_PHOTOS`). Статус и замечание возвращаются в профиль.
- Подсказки и верификация адресов ПВЗ через DaData (с 3-секундным таймаутом на запрос).
- Админка, жалобы, баны, аудит действий, очередь identity-verification.
- Светлая и темная темы, переключатель темы в Mini App.
- Валидация профиля: SVG/JPEG/PNG/WebP аватарки, имя/фамилия без цифр, возраст 16-99.
- Rate-limit на abuse-prone endpoints: admin login (в БД, персистентно), `client-debug` и другие публичные POST'ы (in-memory по IP).
- Smoke/utility тесты на auth, application flow, chat utils, profile photo и identity verification.

## Стек

- `Next.js 16` App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- `PostgreSQL`
- `Prisma 7` + `@prisma/adapter-pg`
- `Redis 7` + `ioredis` — опционально, для shared-кэша user-record и rate-limit; без `REDIS_URL` всё работает на in-memory fallback
- `zod`
- `jose`
- `Vitest`
- Telegram Bot API + Telegram WebApp SDK
- DaData Suggestions API (геокодер)

## Структура

```text
src/
  app/
    (app)/                пользовательские страницы Mini App (home, shifts, applications, chats, profile, onboarding, reviews, posts, profiles, moderation)
    admin/                админка (users, shifts, reports, audit, verifications)
    admin-login/          вход в админку
    api/                  route handlers (auth, bot, chats, shift-posts, uploads, profile/identity-verification, admin/verifications, address-* и др.)
  components/
    admin/                админ-UI + identity verifications list
    applications/         отклики и назначения
    chat/                 список чатов и диалог
    layout/               оболочка Mini App и banned-screen
    moderation/           модерация жалоб
    navigation/           нижняя навигация
    profile/              профиль, phone и identity verification
    reviews/              двусторонние отзывы
    shifts/               смены и формы
    theme/                переключатель темы
    ui/                   общие UI-компоненты
  lib/
    auth/                 session, telegram init-data, app-access guard
    chat/                 утилиты для сообщений и вложений
    geocoder/             DaData suggest/verify + shared fetch с timeout
    notifications/        Telegram уведомления
    rate-limit/           in-memory и Postgres лимитеры, IP helper, 429-ответ
    scoring/              ранжирование откликов
    validations/          zod-схемы форм
    ... и прочие helpers (profile-photo, profile-completion, log, api)
  server/services/        бизнес-логика (shift-post, application, chat, profile, identity-verification, admin, moderation)
  generated/prisma/       сгенерированный Prisma client (коммитится)
  proxy.ts                guard для admin/API

prisma/
  schema.prisma
  seed.ts

scripts/
  dev-ngrok.ts
  sync-ngrok-url.ts
  register-telegram-webhook.ts
  hash-admin-password.ts

```

## Локальный запуск

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить окружение

Скопируйте `.env.example` в `.env.local` и заполните значения.

Минимально важные переменные:

```env
# Обязательные — приложение падает на старте, если не заданы
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pvz_zamena_bot?schema=public"
SESSION_SECRET="replace-me"

TELEGRAM_BOT_TOKEN="replace-me"
TELEGRAM_BOT_USERNAME="replace_me"
TELEGRAM_WEBHOOK_SECRET=""

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Дублер"
NEXT_PUBLIC_DEV_TELEGRAM_ID="1000001"

# Dev-only фолбэки — на проде должны быть false
ALLOW_DEV_AUTH_FALLBACK="false"
ALLOW_DEV_DATA_FALLBACK="false"

# Админка
ADMIN_LOGIN=""
ADMIN_PASSWORD=""
ADMIN_PASSWORD_HASH=""

# Uploads (по умолчанию ./uploads внутри репо)
UPLOADS_DIR=""

# DaData — геокодер адресов ПВЗ; без ключа подсказки отключаются
DADATA_API_KEY=""
```

Важно:

- `.env.local` не коммитится.
- `DATABASE_URL` теперь **обязателен** — `src/lib/prisma.ts` бросает ошибку на старте, если переменная не задана. Раньше был тихий fallback на `postgres:postgres@localhost`, что приводило к деплоям в не ту БД.
- В проде используйте `ADMIN_PASSWORD_HASH`, а не plaintext пароль.
- `ALLOW_DEV_*_FALLBACK` должны быть выключены вне dev.
- Если bot token где-то светился, его лучше перевыпустить.

### 3. Поднять Postgres

Если используете Docker:

```bash
docker compose up -d postgres
```

Если Postgres установлен локально, достаточно создать БД и проверить `DATABASE_URL`.

### 4. Подготовить Prisma

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

Или одной командой:

```bash
npm run dev:setup
```

### 5. Настроить админский пароль

```bash
npm run admin:hash-password
```

Результат положить в `ADMIN_PASSWORD_HASH`.

### 6. Запустить приложение

Обычный dev:

```bash
npm run dev
```

Telegram Mini App через ngrok:

```bash
npm run dev:ngrok
```

`dev:ngrok` поднимает Next dev server, синхронизирует публичный ngrok URL, обновляет Telegram webhook, menu button и команды бота.

## Основные команды

```bash
npm run lint
npm run typecheck
npm run test
npm run build

npm run db:generate
npm run db:push
npm run db:seed
npm run db:studio

npm run bot:register
npm run ngrok:sync
npm run admin:hash-password
```

## Проверка Telegram flow

1. Запустить `npm run dev:ngrok`.
2. Отправить боту `/start`.
3. Открыть Mini App из кнопки бота.
4. Пройти onboarding.
5. Проверить профиль, смены, отклики, чат и завершение смены.

Проверка телефона:

1. Открыть профиль.
2. Нажать `Подтвердить номер телефона`.
3. В Telegram отправить контакт через кнопку бота.
4. Вернуться в Mini App и дождаться автообновления статуса.

Верификация личности:

1. Открыть профиль, в карточке «Профиль требует верификации» нажать `Подтвердить документы`.
2. Загрузить до 5 фото (JPEG/PNG/WebP, до 10 МБ каждое).
3. В админке `/admin/verifications` модератор видит новую заявку со статусом `PENDING`.
4. Модератор ставит `APPROVED`, `REJECTED` или `NEEDS_MORE_PHOTOS` с комментарием.
5. В профиле пользователя появляется соответствующий статус; при `NEEDS_MORE_PHOTOS` кнопка меняется на `Дополнить заявку`.

## Проверки перед пушем

Перед отправкой изменений желательно прогонять:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Текущий baseline: 44 теста проходит.

## Админка

- UI входа: `/admin-login`.
- Guard находится в `src/proxy.ts`.
- Для работы нужны `ADMIN_LOGIN` и `ADMIN_PASSWORD_HASH`.
- Rate-limit на admin login — персистентный, через Postgres (`src/lib/rate-limit/db.ts`).

Админка умеет искать пользователей, выдавать роли, банить и разбанивать, модерировать жалобы, смотреть аудит и метрики, а также разбирать очередь identity-verification на `/admin/verifications`.

## Важные заметки

- Это `Next.js 16`, поэтому проект использует `proxy.ts`, а не старый `middleware.ts`.
- Prisma client коммитится в `src/generated/prisma`. При изменении `prisma/schema.prisma` обязательно запускать `npm run db:generate`, иначе запущенный dev-сервер продолжит держать старый клиент в памяти.
- `uploads/`, `backups/`, dev-логи (`.codex-*.log`, `.postgres-*.log`, `.ngrok*.log`), ngrok-URL-файлы и env-файлы не должны попадать в Git — они покрыты `.gitignore`.
- DaData-вызовы обёрнуты в `fetchDaData` (`src/lib/geocoder/dadata-fetch.ts`) с 3-секундным `AbortController`. Ошибки нормализуются до `DADATA_TIMEOUT` / `DADATA_<status>` и маппятся на 502 на клиент.
- `update-logs` в корне фиксирует изменения по версиям. Новые записи добавляют агенты (Codex, Claude и др.) за своей подписью.

## Ближайшие направления

- Дальше полировать UX темной темы.
- Добавлять smoke-тесты на core-flow.
- Подготовить VDS/production-деплой отдельно от ngrok-версии, перейти на nonce-based CSP (сейчас в prod ещё `script-src 'unsafe-inline'`).
- Вынести rate-limit в Redis, когда появится multi-instance deploy.
- Перенести uploads во внешнее хранилище.
- Позже добавить email-регистрацию как отдельный способ входа.
