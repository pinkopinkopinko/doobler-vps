# Перенос ngrok-версии на VPS — шпаргалка

> Этот файл должен лежать в `pvz_zamena_bot/`. Цель: чтобы в будущих диалогах
> не пересобирать с нуля картину «как код из dev доезжает до prod».
> Создан после успешного деплоя 2026-05-15 (см. update-logs v97+).

## Контекст: два репо

| Папка/репо | Назначение | GitHub remote |
|---|---|---|
| `C:\Users\mintd\Documents\pvz_zamena_bot` (этот) | Активная dev-версия. Здесь идёт работа через `npm run dev:ngrok`. | `ozonowner/pvzbot` |
| `C:\Users\mintd\Documents\doobler-vps` | Production-таргет с deploy-инфрой (Dockerfile, nginx, certbot). | `ozonowner/doobler-vps` |

**В prod-репо есть лишний слой `deploy/`**:
```
doobler-vps/deploy/
├── bootstrap.sh           — первичная установка на чистом Ubuntu (один раз)
├── deploy.sh              — обновление работающего сервера (бэкап БД + build + restart)
├── Dockerfile             — production-образ Next.js (multi-stage: deps→builder→runner)
├── docker-compose.yml     — postgres + app + nginx + certbot + redis
├── env.production.template
├── nginx/                 — nginx.conf + conf.d/dubler.conf + njs для HMAC initData
├── postgres/postgresql.conf
└── scripts/               — backup-db.sh, restore-db.sh, gen-secrets.sh, register-webhook.sh
```

## Текущий боевой VPS

| Параметр | Значение |
|---|---|
| IP / SSH | `root@83.217.221.82` |
| Домен | `doobler.ru` |
| OS | Ubuntu (с Docker, fail2ban, ufw, certbot) |
| Project dir | `/opt/doobler/` |
| Env file | `/opt/doobler/.env.production` (права 600, **никогда не перезаписывать**) |
| БД-бэкапы | `/var/backups/doobler/doobler-YYYYMMDD-HHMMSS.sql.gz` (cron 03:00, retention 14д) |
| TLS | Let's Encrypt в docker-volume `doobler_certbot_certs`, auto-renew |
| Uploads | docker-volume, `UPLOADS_DIR=/var/lib/doobler/uploads` |

## Контейнеры в стеке

`docker compose --env-file /opt/doobler/.env.production -f /opt/doobler/deploy/docker-compose.yml ps` показывает 4 сервиса:

| Контейнер | Образ / build | Что делает | Порты |
|---|---|---|---|
| `doobler-postgres` | `postgres:16-alpine` | БД для app и support-bot | внутри сети, наружу не торчит |
| `doobler-app` | build из `deploy/Dockerfile` (контекст `..`) | Next.js 16 Mini App + admin + API | внутри сети `:3000`, наружу через nginx |
| `doobler-support-bot` | build из `support-bot/Dockerfile` (контекст `../support-bot`) | Standalone Telegram-бот техподдержки, polling | без HTTP-портов |
| `doobler-nginx` | build из `deploy/nginx/Dockerfile` (`nginx:1.27-alpine` + модуль `nginx-module-njs`) | Reverse-proxy + TLS + edge-валидация Telegram initData (HMAC-SHA256 в njs) + rate-limit'ы | `:80`, `:443` |
| `doobler-certbot` | `certbot/certbot:latest` | Auto-renew Let's Encrypt сертификата | без портов |

## Edge-фильтрация nginx (njs + HMAC initData + rate-limit'ы)

Развёрнуто 2026-05-16. До этого ручка `/api/*` была открыта — любой запрос
с поддельным session-cookie или без него доезжал до Next.js, где уже
проверялась авторизация. Это позволяло легко спамить ручки и нагружать
Postgres до того, как Node.js успевал отбить запрос.

### Что делает njs-модуль

Файл `deploy/nginx/njs/validate-init-data.js` — это JavaScript-модуль,
который nginx запускает прямо в worker-процессе через директиву `js_content`.
Реализует тот же HMAC-SHA256 алгоритм, что и `src/lib/auth/telegram.ts`:

1. Берёт заголовок `x-telegram-init-data` из запроса.
2. Парсит query-string, извлекает `hash`.
3. Сортирует остальные поля по ключу, склеивает в data-check-string.
4. `secret = HMAC_SHA256("WebAppData", BOT_TOKEN)`.
5. `expected_hash = HMAC_SHA256(secret, data_check_string)`.
6. Сравнивает с `hash` за constant-time.
7. Проверяет `auth_date < 1 час` (TTL должен совпадать с `src/lib/auth/telegram.ts`).
8. Возвращает 204 если ОК, 401 если что-то не так.

Подключается через `auth_request` в `deploy/nginx/conf.d/dubler.conf`:

```nginx
location = /_validate_init_data {
    internal;
    js_content init_data.validate;
}

location /api/ {
    auth_request /_validate_init_data;
    ...
}
```

nginx делает HEAD-subrequest в `/_validate_init_data` перед каждым проксированием
в Next.js. Если subrequest вернул не-200 — клиент получает 401, до Node.js
запрос не доходит. Это даёт примерно в 100 раз меньше CPU на отброс
невалидных запросов: njs работает в воркере nginx, без сетевого хопа.

### BOT_TOKEN внутри nginx

Токен пробрасывается в контейнер nginx через `docker-compose.yml`:

```yaml
nginx:
  environment:
    TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
```

При старте контейнера `/docker-entrypoint.d/40-bake-bot-token.sh`
(находится в `deploy/nginx/entrypoint-bake-bot-token.sh`) записывает токен
в `/etc/nginx/njs/.bot-token` с правами `0600`. njs-модуль читает этот
файл один раз при загрузке через `fs.readFileSync`.

Зачем отдельный файл, а не env-переменная в njs: njs может не иметь
надёжного `process.env` в nginx-режиме (зависит от версии). Файл — гарантия.

### Исключения из edge-валидации

Не все ручки умеют ходить с `x-telegram-init-data`. Эти ручки **намеренно**
оставлены без `auth_request` — защита есть на уровне Next.js
(session-cookie / cookie-сессия / IP-allowlist):

| Локация | Почему без auth_request |
|---|---|
| `/api/health` | Внешний мониторинг |
| `/api/bot/webhook` | server-to-server от Telegram, защищён `X-Telegram-Bot-Api-Secret-Token` + IP-allowlist |
| `/api/admin/*` | Cookie-сессия админа, не Telegram-сессия |
| `/api/auth/bot-token` | Bootstrap-fallback, initData может вообще отсутствовать |
| `/api/auth/client-debug` | Клиент пишет сюда логи bootstrap-фейлов до того, как есть initData |
| `/api/auth/debug` | Жёстко `return 404` в nginx, в app не идёт |
| `/api/profile-photo/[userId]` | Грузится через тег `<img src>`, браузер не ставит на это header |
| `/api/uploads/[id]` | То же — `<img>` / `<a href>` для вложений в чатах |
| `/admin`, `/admin-login` | HTML, открывается в обычном браузере |

**Если добавляешь новый `<img>`-источник или открытую ручку** — добавь
её в exception в `dubler.conf`. Иначе клиент будет получать 401 от nginx
вместо картинки/ответа.

### Rate-limit zones (в `nginx.conf`)

| Zone | Rate | Burst | Где применяется |
|---|---|---|---|
| `bot_webhook` | 30 r/s | 10 | `= /api/bot/webhook` |
| `api_rl` | 10 r/s | 20 | `/api/`, `/api/admin/`, `/api/profile-photo/*`, `/api/uploads/[id]` |
| `upload_rl` | 1 r/s | 3 | `= /api/uploads` (POST аплоадов) |
| `html_rl` | 5 r/s | 10 | `/`, `/admin`, `/admin-login` |
| `conn_per_ip` (limit_conn) | — | 20 | Все локации серверного блока |

Если юзер получает 503 «too many requests» — смотри в логах `limiting requests`
и пересмотри значение зоны. Burst — это размер очереди, `nodelay` означает что
запросы из burst'а обрабатываются сразу, а не сериализуются.

`/_next/static/` обрабатывается отдельным `location ^~` без `limit_req`.
Это immutable-чанки Next.js, которые браузер загружает параллельно при первом
рендере. Для них `conn_per_ip` переопределён до 64 и выставлен
`Cache-Control: public, max-age=31536000, immutable`. Не возвращай эти файлы
под `html_rl`: 503 на чанках ломает гидрацию и не даёт запуститься
`afterInteractive`-скриптам, включая Яндекс Метрику.

### Файлы (что лежит в репо)

```
deploy/nginx/
├── Dockerfile                       — nginx:1.27-alpine + apk add nginx-module-njs
├── entrypoint-bake-bot-token.sh     — пишет ${TELEGRAM_BOT_TOKEN} в .bot-token при старте
├── nginx.conf                       — load_module + limit_req_zones + js_import
├── conf.d/dubler.conf               — server-блоки + auth_request + per-location rate-limit
└── njs/validate-init-data.js        — HMAC-SHA256 валидация (~120 строк)
```

### Деплой обновлений edge (когда менял njs/Dockerfile/nginx-конфиг)

```bash
# Локально → залить файлы scp'ом в /opt/doobler/deploy/nginx/

# На сервере:
sed -i 's/\r$//' /opt/doobler/deploy/nginx/*.sh /opt/doobler/deploy/nginx/Dockerfile \
  /opt/doobler/deploy/nginx/njs/*.js /opt/doobler/deploy/nginx/nginx.conf \
  /opt/doobler/deploy/nginx/conf.d/*.conf
source /opt/doobler/.env.production
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /opt/doobler/deploy/nginx/conf.d/dubler.conf

# Если менял Dockerfile / njs-скрипт / entrypoint — нужен rebuild:
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml build --no-cache nginx

# Если менял только nginx.conf / dubler.conf — достаточно reload без rebuild:
docker exec doobler-nginx nginx -t && docker exec doobler-nginx nginx -s reload

# Если поднимаешь свежесобранный образ:
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml up -d --no-deps --force-recreate nginx
```

### Проверка после деплоя edge

```bash
# 1. health открыт
curl -fsS https://doobler.ru/api/health && echo

# 2. /api/auth/me без initData → 401 ОТ nginx (важно: server: nginx, не Next.js)
curl -sI https://doobler.ru/api/auth/me | head -5
# Должно быть: HTTP/2 401, server: nginx/..., content-type: text/html

# 3. Токен зашит в файле
docker exec doobler-nginx sh -c 'wc -c /etc/nginx/njs/.bot-token'
# Должно быть ~46 байт (длина BotFather-токена)

# 4. njs-модуль загружен
docker exec doobler-nginx ls /usr/lib/nginx/modules/ | grep -i js
# Должно быть ngx_http_js_module.so

# 5. njs стартует без ошибок
docker logs --tail 10 doobler-nginx | grep -i 'js vm'
# Должно быть: [notice] ... js vm init njs: 0x...
```

### Подводный камень: shebang CRLF после Windows-tar

`entrypoint-bake-bot-token.sh` начинается с `#!/bin/sh`. Если файл попадает
на Linux с CRLF — shebang становится `#!/bin/sh\r`, и контейнер падает в
restart-loop с сообщением:

```
/docker-entrypoint.sh: line 31: /docker-entrypoint.d/40-bake-bot-token.sh: not found
```

(файл существует, но интерпретатор `sh\r` не найден). Перед `docker build`
**обязательно**:

```bash
find /opt/doobler/deploy/nginx -type f \( -name '*.sh' -o -name '*.js' \
     -o -name '*.conf' -o -name 'Dockerfile' \) -exec sed -i 's/\r$//' {} \;
```

И если CRLF был на момент сборки — образ закеширован с битым скриптом,
нужно `--no-cache`:

```bash
docker compose ... build --no-cache nginx
```

### Откат edge-фильтра

Если edge-валидация по какой-то причине рубит всех юзеров и нужно срочно
вернуть до-edge поведение:

```bash
# Вариант 1 — закомментировать auth_request, оставить остальное
sed -i 's|^\(\s*\)auth_request /_validate_init_data;|\1# auth_request /_validate_init_data;|' \
  /opt/doobler/deploy/nginx/conf.d/dubler.conf
docker exec doobler-nginx nginx -t && docker exec doobler-nginx nginx -s reload

# Вариант 2 — полный откат до nginx:1.27-alpine (без njs). На сервере должны
# остаться бэкапы deploy/nginx.bak-* и docker-compose.yml.bak-* до перехода:
ls -lt /opt/doobler/deploy/ | grep -E 'bak-|nginx\.bak'
# Восстановить нужный бэкап и `docker compose up -d --no-deps --force-recreate nginx`.
```

## ⚠️ DaData и исходящие запросы на VPS

Раньше `DADATA_API_KEY` и proxy-env для `app` восстанавливались ручной
правкой `deploy/docker-compose.yml` на сервере. Теперь эти строки должны
лежать в репозитории в `doobler-vps/deploy/docker-compose.yml`, а секретные
значения — только в `/opt/doobler/.env.production`.

### 1. Прокси для исходящих запросов из app (DaData, Telegram API)

VPS на территории РФ → DaData/Telegram могут быть недоступны напрямую.
Поэтому в `deploy/docker-compose.yml` сервису `app` прокинуты переменные
из `.env.production`:

```yaml
    environment:
      ...
      DADATA_API_KEY: ${DADATA_API_KEY}
      HTTPS_PROXY: ${HTTPS_PROXY:-}
      HTTP_PROXY: ${HTTP_PROXY:-}
      NO_PROXY: "postgres,redis,localhost,127.0.0.1,app,nginx"
      NODE_OPTIONS: "--dns-result-order=ipv4first --use-env-proxy"
```

`--use-env-proxy` (Node.js 22) обязателен — без него нативный `fetch()`
игнорирует `HTTPS_PROXY`. `NO_PROXY` обязателен — без него запросы
к `postgres:5432` / `redis:6379` пойдут через прокси и сломаются.

Текущие credentials хранятся **только в `~/.bash_history` сервера** —
поднять их при необходимости:

```bash
grep -E 'HTTPS_PROXY|HTTP_PROXY' /root/.bash_history | tail -3
```

### 2. `DADATA_API_KEY` пробрасывается явно

В `/opt/doobler/.env.production` нужна строка:

```bash
DADATA_API_KEY=...
```

И в compose сервиса `app` нужна строка `DADATA_API_KEY: ${DADATA_API_KEY}`.
Без неё ключ из `.env.production` не доезжает до приложения, и API отвечает
`DADATA_NOT_CONFIGURED` в логах.

### 3. Быстрая проверка на VPS

```bash
grep -E 'DADATA_API_KEY|HTTPS_PROXY|HTTP_PROXY|NO_PROXY|NODE_OPTIONS' \
  /opt/doobler/deploy/docker-compose.yml
grep -E '^DADATA_API_KEY=|^HTTPS_PROXY=|^HTTP_PROXY=' /opt/doobler/.env.production

# Применить изменения env/compose без rebuild:
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml up -d --no-deps --force-recreate app

# Проверить что всё видно изнутри контейнера:
sleep 5
docker exec doobler-app sh -c 'env | grep -E "DADATA|PROXY|NODE_OPTIONS" | sort'
```

Важно: `HTTPS_PROXY`/`HTTP_PROXY` в `.env.production` должны быть либо пустыми,
либо реальным URL. Плейсхолдер `http://USER:PASS@HOST:PORT` ломает Node.js 22
с `ERR_INVALID_URL` ещё до старта Next.js.

### 4. Адресная структура: homepage и Telegram Mini App

После перехода на `doobler.ru` корень сайта больше не должен вести прямо в Mini App:

- `https://doobler.ru/` — публичная главная страница с описанием сервиса.
- `https://doobler.ru/offer` — оферта.
- `https://doobler.ru/privacy` — политика конфиденциальности.
- `https://doobler.ru/telegram/shifts` — основной вход в Telegram Mini App.
- `https://doobler.ru/telegram/*` — публичный префикс Telegram-версии приложения.

`src/proxy.ts` переписывает `/telegram/*` внутрь app-маршрутов: `/telegram/shifts` -> `/shifts`, `/telegram/profile` -> `/profile` и т.д. В запрос добавляются headers `x-doobler-platform: telegram` и `x-doobler-platform-prefix: /telegram`. Это оставляет корень домена под лендинг/документы и дает нормальную базу для будущих входов вроде `/web/...`, `/vk/...` или других платформ.

После деплоя проверить:

```bash
curl -fsS https://doobler.ru/ | grep -q 'doobler_bot' && echo 'homepage ok'
curl -sI https://doobler.ru/telegram/shifts | head -5
```

Menu button в Telegram должен вести не на `/shifts`, а на `${NEXT_PUBLIC_APP_URL}/telegram/shifts`.

### 5. Telegram menu button и текст /start кешируются у Telegram

Тексты в `src/lib/telegram/bot.ts`:
- `/start` reply: «Дублер - поиск замены в Пункт Выдачи. ...»
- Menu button label: «Открыть Дублер»
- Menu button URL: `${NEXT_PUBLIC_APP_URL}/telegram/shifts`

После изменения текста кода **код применяется при первом `/start` после рестарта**,
но **menu button (кнопка слева в чате)** хранится у Telegram и не обновляется
автоматически. Перерегистрация после деплоя:

```bash
source /opt/doobler/.env.production
WEBAPP_URL="${NEXT_PUBLIC_APP_URL%/}/telegram/shifts"

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg url "$WEBAPP_URL" '{menu_button:{type:"web_app",text:"Открыть Дублер",web_app:{url:$url}}}')" \
  | jq .

# Проверки:
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMenuButton" | jq .
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq '.result.url'
# url должен быть https://doobler.ru/api/bot/webhook
```

Telegram-клиенту может потребоваться рестарт чтобы кнопка протухла из кеша.

---

## Полный алгоритм переноса (dev → prod)

### Этап 0. Подготовка локально

Требования:
- `rsync` (через scoop: `scoop install cwrsync` — иначе путь через `cp -r` + `tar`)
- SSH-ключ или пароль для `root@83.217.221.82`
- В `pvz_zamena_bot` всё закоммичено / устраивающее тебя состояние

Бэкапы существующего `doobler-vps`:

```bash
cd /c/Users/mintd/Documents/doobler-vps
git stash push -u -m "vps-state-before-ngrok-sync-$(date +%Y%m%d-%H%M)"

# Двойная страховка: tar-архив вне репо
cd /c/Users/mintd/Documents
tar --exclude='./doobler-vps/node_modules' --exclude='./doobler-vps/.next' \
    -czf doobler-vps-backup-$(date +%Y%m%d-%H%M).tar.gz doobler-vps
```

### Этап 1. Sync `pvz_zamena_bot` → `doobler-vps`

**Стратегия**: полная замена `src/` + конфигов из ngrok-репо, `deploy/` остаётся
нетронутым.

```bash
cd /c/Users/mintd/Documents/doobler-vps

# Полная замена src/
rm -rf src
cp -r /c/Users/mintd/Documents/pvz_zamena_bot/src ./

# Конфиги и схемы
cp /c/Users/mintd/Documents/pvz_zamena_bot/prisma/schema.prisma   prisma/schema.prisma
cp /c/Users/mintd/Documents/pvz_zamena_bot/prisma/seed.ts          prisma/seed.ts
cp /c/Users/mintd/Documents/pvz_zamena_bot/package.json            ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/package-lock.json       ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/tsconfig.json           ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/next.config.ts          ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/postcss.config.mjs      ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/eslint.config.mjs       ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/vitest.config.ts        ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/prisma.config.ts        ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/.gitignore              ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/.dockerignore           ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/update-logs             ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/README.md               ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/AGENTS.md               ./
cp /c/Users/mintd/Documents/pvz_zamena_bot/theme-audit.md          ./
```

**ВАЖНО что НЕ копировать:**
- `.env`, `.env.local`, `.env.example` — на сервере свой `.env.production`
- `node_modules/`, `.next/`, `*.tsbuildinfo`
- `.devin/`, `uploads/`, `backups/`
- Корневые `Dockerfile` и `docker-compose.yml` ngrok-репо (на VPS используются
  `deploy/Dockerfile` и `deploy/docker-compose.yml`)
- `doobler.tar.gz`, любые `.*.log`, `.dev-ngrok-url`

### Этап 2. Проверка схемы БД на разрушительные изменения

```bash
cd /c/Users/mintd/Documents/doobler-vps
git diff HEAD -- prisma/schema.prisma | grep -E '^-' | grep -vE '^-{3}'
```

**Должно быть пусто или только модификации существующих строк.** Если видишь:
- `-model NAME` — таблица удаляется
- `-  fieldName Type` — поле удаляется
- `enum X { -VALUE }` — значение enum удаляется

→ это разрушительная миграция, `prisma db push` молча потеряет данные.
**Останавливайся и решай отдельно** (через `prisma migrate` с downstream-фиксом).

В нашей текущей истории все изменения — **additive only** (новые таблицы
IdentityVerification/Photo, новые поля lat/lng на ShiftPost).

### Этап 3. Локальная проверка

```bash
cd /c/Users/mintd/Documents/doobler-vps
npm install

# Prisma 7 требует DATABASE_URL даже на generate — используем фейковый
DATABASE_URL='postgresql://x:x@localhost:5432/x?schema=public' npm run db:generate
DATABASE_URL='postgresql://x:x@localhost:5432/x?schema=public' npm run typecheck
DATABASE_URL='postgresql://x:x@localhost:5432/x?schema=public' npm run test
# Build с заглушками всех ENV-валидаторов:
DATABASE_URL='postgresql://x:x@localhost:5432/x?schema=public' \
SESSION_SECRET='dummy' TELEGRAM_BOT_TOKEN='dummy' TELEGRAM_BOT_USERNAME='dummy' \
NEXT_PUBLIC_APP_URL='https://example.com' NEXT_PUBLIC_APP_NAME='Дублер' \
npm run build
```

Должно быть зелёным:
- `typecheck`: clean
- `test`: 52/52 (или больше — растёт с фичами)
- `build`: `Compiled successfully` + 42+ страницы, prisma-ошибки про БД можно
  игнорить (это из-за dummy URL, на проде есть реальный)

### Этап 4. Подготовка tar-архива для VPS

GNU tar требует `--exclude` **без `./` префикса** (это грабли — путь exclude
должен начинаться так же как путь в архиве).

```bash
cd /c/Users/mintd/Documents
tar \
  --exclude='doobler-vps/node_modules' \
  --exclude='doobler-vps/.next' \
  --exclude='doobler-vps/.git' \
  --exclude='doobler-vps/.env' \
  --exclude='doobler-vps/.env.local' \
  --exclude='doobler-vps/.env.production' \
  --exclude='doobler-vps/.devin' \
  --exclude='doobler-vps/uploads' \
  --exclude='doobler-vps/backups' \
  --exclude='doobler-vps/tsconfig.tsbuildinfo' \
  --exclude='doobler-vps/doobler.tar.gz' \
  --exclude='doobler-vps/.app-start.*' \
  --exclude='doobler-vps/.codex-*.log' \
  --exclude='doobler-vps/.postgres-*.log' \
  --exclude='doobler-vps/.ngrok*.log' \
  --exclude='doobler-vps/.dev-ngrok-url' \
  -czf doobler-upload-$(date +%Y%m%d-%H%M).tar.gz doobler-vps

# Sanity: размер должен быть ~1 MB (НЕ 200+ MB — это значит exclude не сработал)
ls -la doobler-upload-*.tar.gz

# Sanity: 400-500 файлов, deploy/ и src/ на месте
tar -tzf doobler-upload-*.tar.gz | wc -l
tar -tzf doobler-upload-*.tar.gz | head -20
```

### Этап 5. Заливка на VPS и распаковка

```bash
# С локалки
VPS=root@83.217.221.82
scp /c/Users/mintd/Documents/doobler-upload-*.tar.gz $VPS:/tmp/
ssh $VPS
```

Дальше на сервере (`cd /opt/doobler`):

```bash
cd /opt/doobler

# Подстраховочный бэкап БД (поверх того, что сделает deploy.sh)
bash deploy/scripts/backup-db.sh
ls -la /var/backups/doobler/ | tail -3

# Превью архива
TARGZ=/tmp/$(ls /tmp/doobler-upload-*.tar.gz | xargs -n1 basename | tail -1)
tar -tzf "$TARGZ" | head -10
tar -tzf "$TARGZ" | wc -l

# Распаковка. --strip-components=1 убирает префикс doobler-vps/
tar -xzf "$TARGZ" -C /opt/doobler/ --strip-components=1 --overwrite

# Проверь что .env.production цел и не перетёрт
ls -la /opt/doobler/.env.production
# Должно быть: -rw------- 1 root root ... <старая дата>
```

### Этап 5.5. Удаление obsolete-файлов (КРИТИЧНО, фикс 2026-05-22)

**`tar --overwrite` перезаписывает существующие файлы, но НЕ удаляет те,
что были удалены из source-репо.** В результате на VPS остаются устаревшие
файлы из старых версий, которые ломают билд.

**Симптом:** билд падает на typecheck с ошибкой вида:

```
./src/app/api/shift-posts/[id]/favorite/route.ts:35:35
Type error: Property 'favorite' does not exist on type 'PrismaClient<...>'.
Next.js build worker exited with code: 1
```

Это значит на VPS лежит код, ссылающийся на сущность, которой больше нет
в новой схеме Prisma / новом коде.

**Фикс — после каждого `tar -xzf` удалить известные obsolete-пути:**

```bash
# v101: Favorite модель и роут
rm -rf /opt/doobler/src/app/api/shift-posts/[id]/favorite
rm -f /opt/doobler/src/generated/prisma/models/Favorite.ts

# v85: переименован russian-million-cities → russian-cities
rm -f /opt/doobler/src/lib/russian-million-cities.ts

# v89: telegram-webapp-script.tsx стал частью telegram-theme-provider.tsx
rm -f /opt/doobler/src/components/layout/telegram-webapp-script.tsx

# На всякий случай — снести .next кеш
rm -rf /opt/doobler/.next
```

**Профилактика на будущее:** перед каждым деплоем сверять список удалённых
файлов с `update-logs`. Когда видишь `D src/...` в `git status` или запись
вида "Removed/Deleted ..." в update-logs — обязательно дописать `rm` в
этот блок.

Альтернатива (более радикальная) — заменить `tar --overwrite` на
`rsync --delete` с явной заливкой, но это требует rsync на Windows-стороне
и аккуратного списка exclude'ов (`.env.production`, `uploads/`, `backups/`).

### SEO / Analytics: подключение Yandex.Metrika и verification meta-тегов

В `.env.production` используются 3 переменные:

```bash
YANDEX_VERIFICATION=         # из <meta name="yandex-verification" content="...">
GOOGLE_SITE_VERIFICATION=    # из <meta name="google-site-verification" content="...">
NEXT_PUBLIC_YANDEX_METRIKA_ID=  # 8-9 цифр счётчика Метрики
```

**Verification meta-теги** (`YANDEX_VERIFICATION` / `GOOGLE_SITE_VERIFICATION`)
рендерятся server-side через `metadata.verification` в `src/app/layout.tsx`.
Это серверные env-переменные, поэтому достаточно перезапустить app-контейнер
БЕЗ ребилда:

```bash
# Положил новые значения в .env.production → 
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml up -d --no-deps --force-recreate app

# Проверка:
curl -s https://doobler.ru/ | grep -E 'yandex-verification|google-site-verification'
```

**Счётчик** (`NEXT_PUBLIC_YANDEX_METRIKA_ID`) —
ВАЖНО: Next.js инлайнит их в client bundle НА ЭТАПЕ БИЛДА. Если изменил их —
**нужен полный ребилд app-образа**:

```bash
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml build --no-cache app

docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml up -d --no-deps app

# Проверка:
curl -s https://doobler.ru/ | grep -E 'mc.yandex.ru/metrika|ym\('
```

В `deploy/docker-compose.yml` сервис `app` принимает счётчик через
`build.args.NEXT_PUBLIC_YANDEX_METRIKA_ID`, в `deploy/Dockerfile`
builder-stage есть соответствующий `ARG NEXT_PUBLIC_YANDEX_METRIKA_ID=""`.
Без ARG компонент `<Analytics />` тихо ничего не рендерит. Google Analytics
не подключается. Вебвизор в Метрике отключён. Даже при заполненном ID скрипт
Метрики запускается только на публичной главной странице и только после
нажатия пользователем `Разрешить`; в Mini App, профилях и формах Метрика
не запускается.

После версии с отдельными согласиями перед запуском приложения обязательно
применить новую Prisma-схему: она добавляет `UserLegalEvent`, где сохраняются
предоставление/отзыв согласия, версия текста и источник действия.

### Удаление документов ПВЗ и журналирование

Документы, которые владелец или управляющий загружает для проверки ПВЗ,
удаляются не позднее чем через 30 дней. Сервис `document-cleaner` ежедневно
запускает `npm run documents:purge` с тем же volume загрузок и БД, что у `app`.
Команда также удаляет сохранившиеся паспортные фото и остаточные записи
паспортной проверки из отключённого старого flow. После перехода на отдельные
согласия она удалит старые подтверждённые номера телефона и документы ПВЗ,
для которых в `UserLegalEvent` нет зафиксированного согласия: пользователи
подтвердят номер заново, а владельцы при необходимости заново загрузят
документ ПВЗ. Загрузка, просмотр администратором, решение и удаление
документа фиксируются в `AuditLog`.

Проверка после деплоя на VPS:

```bash
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml logs --tail 40 document-cleaner
```

### ⚠️ Подводный камень: плейсхолдер `USER:PASS@HOST:PORT` ломает Node 22 на старте (фикс 2026-05-22)

**Симптом:** контейнер `doobler-app` в restart-loop, в логах:

```
TypeError: Invalid URL
    at new URL (node:internal/url:818:25)
    at new ProxyConfig (node:internal/http:112:68)
    at parseProxyConfigFromEnv (node:internal/http:209:10)
    at new Agent (node:_http_agent:118:26)
  code: 'ERR_INVALID_URL',
  input: 'http://USER:PASS@HOST:PORT'
```

**Причина:** Node.js 22 с флагом `--use-env-proxy` парсит `HTTPS_PROXY`/`HTTP_PROXY`
**на старте процесса**. Если там литералом стоит `http://USER:PASS@HOST:PORT`
(плейсхолдер из VPS_DEPLOY.md), `new URL(...)` бросает `ERR_INVALID_URL` ещё до
загрузки Next.js, и контейнер падает мгновенно после старта → restart-loop.

Это классическое последствие копипасты из инструкции без замены плейсхолдера.
Возникает либо когда:
- python-скрипт восстановления compose-env запустили БЕЗ подстановки реального
  проксика (скопировали как есть из доки);
- compose был перезаписан после правильной подстановки (например `tar --overwrite`
  или `deploy.sh` затёр свежий блок);
- запустили `docker compose up` со старым кешем compose.

**Фикс:** больше не нужно вручную вставлять proxy URL в compose. В compose
должны стоять ссылки на env (`${HTTPS_PROXY:-}` / `${HTTP_PROXY:-}`), а реальные
значения должны лежать только в `/opt/doobler/.env.production`. После правки
env/compose пересоздай контейнер БЕЗ ребилда:

```bash
# 1. Проверка текущего состояния
grep -E 'DADATA_API_KEY|HTTPS_PROXY|HTTP_PROXY|NO_PROXY|NODE_OPTIONS' \
  /opt/doobler/deploy/docker-compose.yml

# В compose должно быть:
# DADATA_API_KEY: ${DADATA_API_KEY}
# HTTPS_PROXY: ${HTTPS_PROXY:-}
# HTTP_PROXY: ${HTTP_PROXY:-}

# 2. Убедиться, что секреты есть в env
grep -E '^DADATA_API_KEY=|^HTTPS_PROXY=|^HTTP_PROXY=' /opt/doobler/.env.production

# 3. Пересоздать app-контейнер БЕЗ ребилда (compose-env читается на старте)
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml up -d --no-deps --force-recreate app

sleep 5
docker logs --tail 30 doobler-app
# Должно быть ▲ Next.js и ✓ Ready in ...ms
```

**Профилактика:** не вставлять реальные proxy credentials прямо в
`deploy/docker-compose.yml`. Они должны жить в `.env.production`, иначе
следующий sync легко затрет или засветит секреты.

### Этап 6. Грабли Windows → Linux (КРИТИЧНО)

**Файлы из Windows-tar приходят с CRLF, Linux bash на них падает с
`/script.sh: line 1: $'\r': command not found`.** Чистим всё, что исполняется:

```bash
# Все shell-скрипты
find /opt/doobler/deploy -type f \( -name '*.sh' -o -name '*.conf' -o -name '*.js' \) \
  -exec sed -i 's/\r$//' {} \;
find /opt/doobler/scripts -type f -name '*.sh' -exec sed -i 's/\r$//' {} \;

# Исполняемые биты могли потеряться
chmod +x /opt/doobler/deploy/*.sh /opt/doobler/deploy/scripts/*.sh

# Проверка: должно быть просто $ в конце, без ^M
head -1 /opt/doobler/deploy/deploy.sh | cat -A
```

### Этап 7. Подстановка домена в nginx-конфиг

`tar --overwrite` сбивает уже-подставленный конфиг `dubler.conf` обратно к
шаблонному состоянию с `DOMAIN_PLACEHOLDER`. **Повторяем подстановку каждый
раз после заливки:**

```bash
source /opt/doobler/.env.production
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /opt/doobler/deploy/nginx/conf.d/dubler.conf

# Проверь: должны быть пути с реальным доменом, не DOMAIN_PLACEHOLDER
grep -n 'ssl_certificate\|DOMAIN_PLACEHOLDER' /opt/doobler/deploy/nginx/conf.d/dubler.conf
```

> TODO для будущего: переписать `deploy.sh` так, чтобы он сам делал sed после
> каждого распаковывания (либо хранить `dubler.conf.template` отдельно от
> подставленного `dubler.conf`).

### Этап 8. Грабли Prisma 7

**Dockerfile builder-stage требует DATABASE_URL** (даже для `prisma generate`).
Добавляется в `deploy/Dockerfile`:

```dockerfile
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma 7 prisma.config.ts требует DATABASE_URL даже на generate; реальный URL
# приходит в runtime из .env.production. На build этап подключения к БД нет.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
```

**В Prisma 7 убран флаг `--skip-generate`** у `prisma db push`. CMD в
Dockerfile должен быть:

```dockerfile
CMD ["sh", "-c", "npx prisma db push && npm run start"]
```

Эти правки уже **в коммите v97+** доехали до `doobler-vps/deploy/Dockerfile`,
но если делаешь rsync с ngrok-репо и видишь старый Dockerfile — проверь.

### Этап 9. Грабли Docker Hub rate-limit

На свежем/долго-непользованном IP первый pull `node:22-alpine` может упасть с:

```
toomanyrequests: You have reached your unauthenticated pull rate limit.
```

Лечение — registry mirror:

```bash
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://mirror.gcr.io"]
}
EOF
systemctl restart docker
docker pull node:22-alpine
```

Если `mirror.gcr.io` не работает (бывает у российских хостеров), запасной:
`https://huecker.io`.

### Этап 10. Запуск апдейта

```bash
bash /opt/doobler/deploy/deploy.sh
```

Скрипт делает (см. `deploy/deploy.sh`):

1. `bash deploy/scripts/backup-db.sh` — снапшот БД
2. `docker compose build app` — пересборка образа (~3-5 мин при первом, ~2 мин при инкрементальном)
3. `docker compose up -d --no-deps app` — запуск app
4. `docker compose exec nginx nginx -s reload` — релоад nginx
5. `setWebhook` — перепривязка Telegram webhook (с `drop_pending_updates: false`)

### Этап 11. Если nginx не поднимается после деплоя

Чек-лист — что точно произошло:

```bash
docker logs --tail 50 doobler-nginx
```

Типовые причины и фиксы:

| Симптом в логе | Причина | Фикс |
|---|---|---|
| `cannot load certificate ... DOMAIN_PLACEHOLDER ...` | Этап 7 не выполнен | `sed -i "s/DOMAIN_PLACEHOLDER/doobler.ru/g" ...dubler.conf` |
| `host not found in upstream "app"` | app в restart-loop, его DNS-имя не резолвится | Сначала чинить app (смотри его логи), nginx сам подцепится |
| `$'\r': command not found` (в логах нет, но контейнер крашится) | CRLF в nginx.conf или njs-файлах | Этап 6 |
| Контейнер сказал «Started» но статус всё равно Restarting | Конфиг не подхватился | `docker compose restart nginx` (или `up -d --force-recreate nginx`) |

### ⚠️ Подводный камень: бесконечная петля `/api/chats` 301↔308 (фикс 2026-05-16)

**Симптом:** «Сеть недоступна» при открытии любого чата и отправке сообщений
в Mini App. В логах nginx — десятки парных записей в одну и ту же секунду:

```
GET /api/chats/ HTTP/2.0" 308 10   ← Next.js: trailingSlash=false, редирект на без слэша
GET /api/chats  HTTP/2.0" 301 169  ← сам nginx: автодобавление слэша из-за prefix-location
GET /api/chats/ HTTP/2.0" 308 ...  ← цикл
```

**Корень:** в `dubler.conf` исторически был отдельный `location /api/chats/ { ... }`
с пробросом WebSocket-апгрейда «на будущее». У nginx есть встроенное поведение:

> If a location is defined by a prefix string that ends with the slash character,
> and requests are processed by `proxy_pass` (...), then in response to a request
> with URI equal to this string but **without the trailing slash, a permanent
> redirect with the code 301 will be returned** to the requested URI with the
> slash appended.

То есть nginx сам, без всяких `rewrite`/`return`, шлёт 301 `/api/chats` →
`/api/chats/`. А Next.js 16 (`trailingSlash: false` по умолчанию) шлёт 308
обратно. Браузер ловит `ERR_TOO_MANY_REDIRECTS` → нативный `fetch()` падает
в exception → catch ставит «Сеть недоступна». Список чатов работал, потому
что `/api/chats` (без слэша) **по идее** должен матчиться с `location /` —
но как только у нас появился именно `/api/chats/` location, nginx начал
форсить редирект.

Дополнительная зацепка: тот же location проставлял
`proxy_set_header Connection "upgrade"` хардкодом, что для обычных HTTP-запросов
тоже было ошибкой (Node.js видел upgrade-намерение без обработчика и
подвешивал TCP-коннект).

**Фикс:**

1. Удалить `location /api/chats/` из `deploy/nginx/conf.d/dubler.conf` совсем.
   Чаты работают через обычный polling, спецтаймауты и WS-апгрейд не нужны.
   Запросы пойдут через единый `location /`.
2. В `deploy/nginx/nginx.conf` всё-таки оставлен `map $http_upgrade $connection_upgrade`
   на случай, если в будущем понадобится WebSocket или SSE — тогда добавлять
   **отдельный** location с **точным** URL (`location = /api/something`), не
   prefix с trailing slash.

**Профилактика при следующих заливках:**
- Если редактируешь `dubler.conf` — НИКОГДА не вводи prefix-location с trailing
  slash для путей, по которым реально ходят клиенты (`/api/chats/`, `/api/foo/`).
  Используй либо exact match (`location = /api/foo`), либо prefix без слэша
  (`location /api/foo`).
- После любых правок nginx — открыть Mini App, зайти в чат, отправить сообщение.
  Если «Сеть недоступна» — первым делом `docker logs doobler-nginx | grep 'api/chats'`
  и искать парные 301/308.
- В чек-листе финальной проверки (Этап 12) **обязательно** прокликать чаты
  (создать тестовый чат с другим аккаунтом или открыть существующий, отправить
  одно сообщение, прикрепить фото). Голый `/api/health 200` ничего не говорит
  про работоспособность чата.

### Этап 12. Проверка прода

```bash
curl -fsS https://doobler.ru/api/health
# {"ok":true,"service":"pvz-zamena-bot","timestamp":"...","env":{"databaseUrlConfigured":true,...}}

docker logs --tail 60 doobler-app | grep -iE 'error|warn|ready'
# Ищем "✓ Ready in ...ms"

docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml ps
# Все три (app, nginx, postgres) — Up. redis тоже если включён.

source /opt/doobler/.env.production
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool
# url должен быть https://doobler.ru/api/bot/webhook, pending_update_count = 0
```

Дальше **открыть Mini App в Telegram** и проверить руками:
- логин (нет «Сессия не найдена», нет вечного splash)
- список смен `/telegram/shifts`
- для OWNER: создание смены с DaData-подсказками + Yandex static map
- чаты (отправка сообщения, polling)
- профиль (theme-toggle, форма регистрации, identity-verification если есть)

---

## Откат если что-то пошло не так

### Локально (после Этапа 1, до отправки)

```bash
cd /c/Users/mintd/Documents/doobler-vps
git checkout -- .              # вернёт код к последнему коммиту
git stash pop                  # вернёт твою предыдущую работу
```

### На VPS (после Этапа 10)

```bash
# Откат кода — найди предыдущий tar-архив на локалке и залей снова
# Откат БД из самого свежего бэкапа (его сделал Этап 5 и Этап 10):
ls -lt /var/backups/doobler/ | head -5
bash /opt/doobler/deploy/scripts/restore-db.sh /var/backups/doobler/doobler-YYYYMMDD-HHMMSS.sql.gz
```

---

## Support-bot (бот техподдержки)

Отдельный Telegram-бот, обрабатывает обращения юзеров и пересылает их админу.
Живёт в docker-стеке как `doobler-support-bot`, polling-режим (без webhook,
без HTTP-портов).

### Где код

```
doobler-vps/support-bot/
├── Dockerfile           — production-образ (node:22-alpine, single-stage)
├── .dockerignore
├── package.json         — зависимости (только pg)
├── package-lock.json
├── README.md
├── .env.example
└── src/bot.js           — весь бот в одном файле (~340 строк)
```

В корне `pvz_zamena_bot` локальная dev-копия НЕ хранится — отдельный
проект `C:\Users\mintd\Documents\doobler_tech_support_bot\` (запускается
через `npm start` / `start.bat`). При синхронизации
изменений из dev в prod копировать `src/bot.js` и `package.json` в
`doobler-vps/support-bot/`.

### Конфигурация

В `.env.production` нужны строки:

```
SUPPORT_BOT_TOKEN=<токен от @BotFather для бота техподдержки>
SUPPORT_ADMIN_CHAT_ID=6344041488
SUPPORT_MAX_FILE_BYTES=10485760
SUPPORT_MESSAGE_INTERVAL_SECONDS=5
```

`DUBLER_DATABASE_URL` (для pg-запросов к БД) и `DUBLER_APP_URL` бот
получает через docker-compose из общих переменных `${DATABASE_URL}` и
`${NEXT_PUBLIC_APP_URL}` — отдельных env-переменных не нужно.

### Блок в `deploy/docker-compose.yml`

```yaml
  support-bot:
    build:
      context: ../support-bot
      dockerfile: Dockerfile
    image: doobler-support-bot:latest
    container_name: doobler-support-bot
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      TELEGRAM_BOT_TOKEN: ${SUPPORT_BOT_TOKEN}        # ВАЖНО: НЕ основной TELEGRAM_BOT_TOKEN!
      SUPPORT_ADMIN_CHAT_ID: ${SUPPORT_ADMIN_CHAT_ID}
      DUBLER_DATABASE_URL: ${DATABASE_URL}
      DUBLER_APP_URL: ${NEXT_PUBLIC_APP_URL}
      SUPPORT_MAX_FILE_BYTES: ${SUPPORT_MAX_FILE_BYTES:-10485760}
      SUPPORT_MESSAGE_INTERVAL_SECONDS: ${SUPPORT_MESSAGE_INTERVAL_SECONDS:-5}
      HTTPS_PROXY: "http://USER:PASS@HOST:PORT"
      HTTP_PROXY: "http://USER:PASS@HOST:PORT"
      NO_PROXY: "postgres,redis,localhost,127.0.0.1,app,nginx"
      NODE_OPTIONS: "--dns-result-order=ipv4first --use-env-proxy"
    networks:
      - internal
    deploy:
      resources:
        limits:
          memory: 256m
```

### Передеплой бота (после изменений в `src/bot.js`)

С локалки скопировать обновлённый код:

```powershell
scp "C:\Users\mintd\Documents\doobler_tech_support_bot\src\bot.js" `
    root@83.217.221.82:/opt/doobler/support-bot/src/bot.js
```

На сервере:

```bash
sed -i 's/\r$//' /opt/doobler/support-bot/src/bot.js

docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml up -d --build support-bot

docker logs --tail 30 doobler-support-bot
```

### Если бот не отвечает

```bash
# 1) Контейнер живой?
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml ps support-bot

# 2) Логи (бот часто молчит, ошибки в stderr)
docker logs --tail 100 doobler-support-bot

# 3) Виден ли токен?
docker exec doobler-support-bot sh -c 'env | grep -E "TELEGRAM|SUPPORT|DUBLER|PROXY"'

# 4) Проверить связь с api.telegram.org из контейнера
docker exec doobler-support-bot sh -c 'wget -q -O- --timeout=5 https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe'
```

Типовые причины:
- `TELEGRAM_BOT_TOKEN is not configured` → не подставился `${SUPPORT_BOT_TOKEN}` (либо пустой в `.env.production`, либо `--env-file` не передан)
- `getaddrinfo ENOTFOUND api.telegram.org` → проблема с прокси (нет `--use-env-proxy` в `NODE_OPTIONS`, или прокси упал)
- Бот молча игнорит сообщения юзеров, но `/start` работает → длинный `lastUserMessageAt`-кулдаун (см. `SUPPORT_MESSAGE_INTERVAL_SECONDS`) или `pg`-коннект к БД упал

### Первичная установка (если support-bot ещё не на сервере)

См. отдельный архив `support-bot-upload-*.tar.gz` и пошаговую инструкцию
из обсуждения 2026-05-15:
1. `scp support-bot-upload-*.tar.gz root@83.217.221.82:/tmp/`
2. На сервере: `tar -xzf ... -C /opt/doobler/ --strip-components=1 --overwrite`
3. CRLF-чистка, добавление env-полей в `.env.production`
4. Python-патч `deploy/docker-compose.yml` для добавления блока (переиспользует прокси из app-секции)
5. `docker compose up -d --build support-bot`

---

## ⚠️ Known issue: Telegram MTProxy/MTProto в РФ и сетевая доступность Mini App

**Симптом, который НЕ является багом нашего стека:** юзер пишет «не открывается
Mini App с телефона», при том что:
- бот отвечает на `/start`;
- этот же юзер с ПК заходит нормально;
- с того же телефона через VPN — заходит.

**Причина:** в Telegram у юзера включён MTProxy/MTProto-прокси (часто для обхода
блокировки самого Telegram в РФ). Прокси прокидывает через себя **только
коннект Telegram-клиента к Telegram-серверам**. Mini App открывается в нативном
WebView (WKWebView на iOS / WebView на Android), который ходит **напрямую**
через системный TCP-стек **в обход** Telegram-прокси.

Если мобильный провайдер юзера режет `doobler.ru` по SNI/DPI/IP — Mini App
не откроется, при этом бот будет работать как ни в чём не бывало. С ПК
проблемы нет, потому что Telegram Desktop использует системные прокси/VPN
настройки, и у юзера на ПК обычно отдельный VPN.

В логах nginx access.log на такие случаи **нет вообще ничего** — запрос не
доходит до сервера, режется на маршрутизаторе провайдера.

### Что делать с этим

Глобально стек никак исправить не может — это сетевая проблема на стороне
устройства. Но можно дать юзерам обходные пути:

1. **Backup-домен.** Уже есть домен `doobler.pro` (запасной). Если основной
   `doobler.ru` начнут массово резать — поднять nginx на втором домене с тем
   же сертификатом (Let's Encrypt спокойно подписывает оба) и менять
   `NEXT_PUBLIC_APP_URL` + menu-button у бота на новый домен. Юзеров можно
   плавно перевести через `/start` (сообщение бота с актуальной ссылкой).
2. **Cloudflare proxy** перед `doobler.ru` — IP меняется на CF, большинство
   IP-блокировок обходится. Минус: SNI всё ещё `doobler.ru`, DPI-блокировка
   останется. Плюс: бесплатно, легко включить.
3. **TLS-фронт с другим SNI** (Reality / Sing-box и т.п.) — обходит SNI-блок,
   но требует кастомной сборки nginx и сложной настройки. Делать только если
   домен полностью режут.

### Как объяснить юзеру

Шаблон ответа в поддержке:

> Mini App открывается в браузере телефона, а не в Telegram. Браузер у вас
> может ходить мимо MTProxy, который вы настроили в Telegram, и поэтому
> провайдер режет наш домен. Самое простое — включить любой VPN (хотя бы
> на пару минут чтобы зайти в приложение). Долгое решение — переходите
> по ссылке: https://doobler.pro (как только запустим).

## Чеклист всех граблей в одном месте

### Файловые/системные
- [ ] **Obsolete-файлы после `tar --overwrite`** (см. Этап 5.5): tar не удаляет файлы, которые были удалены из source. Прогнать `rm` для известных удалённых путей (`favorite/route.ts`, `Favorite.ts`, `russian-million-cities.ts`, `telegram-webapp-script.tsx`) ПЕРЕД билдом, иначе typecheck падает.
- [ ] **CRLF**: после `tar -x` на Linux прогнать `find ... -exec sed -i 's/\r$//' {} \;` на `.sh`, `.conf`, `.js`
- [ ] **chmod +x**: shell-скрипты могут потерять исполняемый бит
- [ ] **DOMAIN_PLACEHOLDER**: `sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" .../dubler.conf` после каждой заливки
- [ ] **tar --exclude путь без `./`**: иначе ничего не исключается, архив 200+ MB
- [ ] **PowerShell vs git-bash пути**: PowerShell — `C:\Users\...`, git-bash/cwRsync — `/c/Users/...`. Не путать.
- [ ] **`sed -i` для многострочной YAML-вставки** ломается в SSH-терминале — использовать `python3 <<'PYEOF'`

### Сохранить от перетирания
- [ ] **`.env.production`**: НИКОГДА не перезаписывать через sync (там ручные правки)
- [ ] **Postgres volume**: не удалять между деплоями, иначе теряем все данные
- [ ] **Cert volume `doobler_certbot_certs`**: тоже не трогать, иначе re-issue Let's Encrypt
- [ ] **`deploy/docker-compose.yml` блок `app.environment`**: должен содержать `DADATA_API_KEY`, `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`, `NODE_OPTIONS` как repo-tracked env references. Реальные секреты — только в `.env.production`.

### Prisma 7 (новые требования)
- [ ] **DATABASE_URL на build**: в `deploy/Dockerfile` builder-stage должна быть `ENV DATABASE_URL=...`
- [ ] **`--skip-generate` удалён**: CMD = `npx prisma db push && npm run start` (без `--skip-generate`)
- [ ] **`prisma.config.ts` требует ENV даже на `prisma generate`** локально → передавать `DATABASE_URL='postgresql://x:x@localhost:5432/x?schema=public'` в shell-команду

### Сетевые
- [ ] **Docker Hub rate-limit**: при первом fail-е — `mirror.gcr.io` в `/etc/docker/daemon.json`
- [ ] **`HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY`/`NODE_OPTIONS`** в `app.environment` — обязательны для DaData/Telegram (см. отдельную секцию)
- [ ] **Плейсхолдер `USER:PASS@HOST:PORT` НЕ лежит в `.env.production`**: Node 22 с `--use-env-proxy` парсит URL на старте и роняет контейнер в restart-loop с `ERR_INVALID_URL` ДО загрузки Next.js.
- [ ] **`DADATA_API_KEY: ${DADATA_API_KEY}`** в `app.environment` — без проброса env из `.env.production` не виден

### Telegram
- [ ] **Menu button** (`setChatMenuButton`) — переустановить после деплоя через curl-блок (см. секцию выше). Иначе у юзеров кнопка с устаревшим URL/текстом.
- [ ] **Webhook URL** — проверять что не на ngrok: `getWebhookInfo` должен показывать `https://doobler.ru/api/bot/webhook`. Если ушёл — `setWebhook` с актуальным URL.
- [ ] **Кеш Telegram-клиента**: после `setChatMenuButton` юзеру может потребоваться рестарт Telegram чтобы кнопка протухла.
- [ ] **Support-bot токен**: `SUPPORT_BOT_TOKEN` в `.env.production` — это **отдельный** бот техподдержки, не путать с `TELEGRAM_BOT_TOKEN` основного приложения.
- [ ] **Support-bot polling**: ему НЕ нужен webhook, не пытаться `setWebhook` для его токена.

---

## Команды одной портянкой (для копи-паста на следующий деплой)

Когда репо `pvz_zamena_bot` готов к выкатке и есть рабочее `doobler-vps`:

```bash
# === ЛОКАЛЬНО ===
cd /c/Users/mintd/Documents/doobler-vps
git stash push -u -m "pre-sync-$(date +%Y%m%d-%H%M)"

# Sync (см. Этап 1)
rm -rf src && cp -r /c/Users/mintd/Documents/pvz_zamena_bot/src ./
for f in prisma/schema.prisma prisma/seed.ts package.json package-lock.json \
         tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs \
         vitest.config.ts prisma.config.ts .gitignore .dockerignore \
         update-logs README.md AGENTS.md theme-audit.md; do
  cp "/c/Users/mintd/Documents/pvz_zamena_bot/$f" "./$f"
done

# Проверки
npm install
DATABASE_URL='postgresql://x:x@localhost:5432/x?schema=public' npm run db:generate
DATABASE_URL='postgresql://x:x@localhost:5432/x?schema=public' npm run typecheck
DATABASE_URL='postgresql://x:x@localhost:5432/x?schema=public' npm run test
DATABASE_URL='postgresql://x:x@localhost:5432/x?schema=public' \
  SESSION_SECRET='dummy' TELEGRAM_BOT_TOKEN='dummy' TELEGRAM_BOT_USERNAME='dummy' \
  NEXT_PUBLIC_APP_URL='https://example.com' NEXT_PUBLIC_APP_NAME='Дублер' \
  npm run build

# Архив
cd /c/Users/mintd/Documents
TS=$(date +%Y%m%d-%H%M)
tar \
  --exclude='doobler-vps/node_modules' --exclude='doobler-vps/.next' \
  --exclude='doobler-vps/.git' --exclude='doobler-vps/.env' \
  --exclude='doobler-vps/.env.local' --exclude='doobler-vps/.env.production' \
  --exclude='doobler-vps/.devin' --exclude='doobler-vps/uploads' \
  --exclude='doobler-vps/backups' --exclude='doobler-vps/tsconfig.tsbuildinfo' \
  --exclude='doobler-vps/doobler.tar.gz' --exclude='doobler-vps/.*.log' \
  --exclude='doobler-vps/.dev-ngrok-url' \
  -czf doobler-upload-${TS}.tar.gz doobler-vps

scp doobler-upload-${TS}.tar.gz root@83.217.221.82:/tmp/

# === НА VPS ===
ssh root@83.217.221.82
cd /opt/doobler
TARGZ=$(ls -t /tmp/doobler-upload-*.tar.gz | head -1)

bash deploy/scripts/backup-db.sh
tar -xzf "$TARGZ" -C /opt/doobler/ --strip-components=1 --overwrite

# Удаляем obsolete-файлы (tar --overwrite не удаляет удалённые в source файлы — см. Этап 5.5)
rm -rf /opt/doobler/src/app/api/shift-posts/[id]/favorite
rm -f /opt/doobler/src/generated/prisma/models/Favorite.ts
rm -f /opt/doobler/src/lib/russian-million-cities.ts
rm -f /opt/doobler/src/components/layout/telegram-webapp-script.tsx
rm -rf /opt/doobler/.next

# Чистим CRLF после Windows-архива
find /opt/doobler/deploy -type f \( -name '*.sh' -o -name '*.conf' -o -name '*.js' \) \
  -exec sed -i 's/\r$//' {} \;
find /opt/doobler/scripts -type f -name '*.sh' -exec sed -i 's/\r$//' {} \;
chmod +x /opt/doobler/deploy/*.sh /opt/doobler/deploy/scripts/*.sh

# Подставляем домен в nginx-конфиг (sed -i ОБЯЗАТЕЛЬНО каждый раз!)
source /opt/doobler/.env.production
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /opt/doobler/deploy/nginx/conf.d/dubler.conf

# Проверяем DaData/proxy env. Реальные значения должны быть в .env.production,
# а compose должен ссылаться на них через ${...}, без встроенных секретов.
grep -E 'DADATA_API_KEY|HTTPS_PROXY|HTTP_PROXY|NO_PROXY|NODE_OPTIONS' \
  /opt/doobler/deploy/docker-compose.yml
grep -E '^DADATA_API_KEY=|^HTTPS_PROXY=|^HTTP_PROXY=' /opt/doobler/.env.production

# Деплой (build + restart app + reload nginx + setWebhook)
bash /opt/doobler/deploy/deploy.sh

# После изменений Prisma-схемы обязательно применяем схему БД на VPS.
# Сейчас это нужно, чтобы удалить устаревшую таблицу Favorite и добавить
# индексы Report(reporterUserId,targetType,targetId,status) и Notification(userId,createdAt).
docker exec doobler-app npm run db:push

# Перерегистрируем menu button (тексты + URL могли поменяться)
WEBAPP_URL="${NEXT_PUBLIC_APP_URL%/}/telegram/shifts"
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg url "$WEBAPP_URL" '{menu_button:{type:"web_app",text:"Открыть Дублер",web_app:{url:$url}}}')" \
  | jq .

# Проверки
curl -fsS https://doobler.ru/ | grep -q 'doobler_bot' && echo 'homepage ok'
curl -sI https://doobler.ru/telegram/shifts | head -5
curl -fsS https://doobler.ru/api/health && echo
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml ps
docker logs --tail 40 doobler-app | grep -iE 'ready|error'
docker exec doobler-app sh -c 'env | grep -E "DADATA|PROXY|NODE_OPTIONS" | sort'
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMenuButton" | jq .
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq '.result.url'
```

---

## 2026-05-25: Yandex Metrika blocked by static chunk rate-limit

Symptom: the HTML contained `ym(109372629`, but browsers did not send
requests to `mc.yandex.ru`. nginx logs showed `limiting requests` for
`GET /_next/static/chunks/...`, and repeated parallel chunk fetches returned
503 responses.

Root cause: Next.js assets were falling through to `location /`, which applies
`html_rl` (`5 r/s`, burst `10`). A cold page load requests many versioned chunks
at once; blocked chunks prevent hydration, so the `afterInteractive` Metrika
script never executes.

Fix in the production repository's `deploy/nginx/conf.d/dubler.conf`:

```nginx
location ^~ /_next/static/ {
    limit_conn conn_per_ip 64;
    # proxy headers omitted here; see tracked config
    proxy_hide_header Cache-Control;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    access_log off;
}
```

This location intentionally has no `limit_req`. The HTML/API locations remain
rate-limited.

Apply only the nginx config on VPS; do not run `deploy/deploy.sh` for this
hotfix because it currently calls `setWebhook`, while `@doobler_bot` must stay
on the VPS poller workaround.

```bash
# LOCAL PowerShell:
scp C:\Users\mintd\Documents\doobler-vps\deploy\nginx\conf.d\dubler.conf root@83.217.221.82:/tmp/dubler.conf

# VPS:
cd /opt/doobler
cp deploy/nginx/conf.d/dubler.conf "deploy/nginx/conf.d/dubler.conf.bak-$(date +%Y%m%d-%H%M%S)"
sed -i 's/\r$//' /tmp/dubler.conf
source /opt/doobler/.env.production
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /tmp/dubler.conf
install -m 0644 /tmp/dubler.conf /opt/doobler/deploy/nginx/conf.d/dubler.conf
docker exec doobler-nginx nginx -t
docker exec doobler-nginx nginx -s reload
```

Verification on VPS:

```bash
curl -fsS https://doobler.ru/api/health && echo
HTML="$(curl -fsS https://doobler.ru/)"
CHUNK="$(printf '%s' "$HTML" | grep -oE '/_next/static/[^"]+\.js' | head -1)"
echo "$CHUNK"
curl -sI "https://doobler.ru${CHUNK}" | grep -iE 'HTTP/|cache-control'
printf '%s' "$HTML" | grep -oE '/_next/static/[^"]+\.js' | head -10 | \
  xargs -P10 -I{} sh -c 'printf "%s %s\n" "$(curl -s -o /dev/null -w "%{http_code}" "https://doobler.ru{}")" "{}"'
docker logs --since 5m doobler-nginx | grep -E '_next/static|limiting requests' || true
```

Then hard-refresh `https://doobler.ru/` in a browser. In Network, Next.js
chunks should return `200`, followed by requests to:

```text
https://mc.yandex.ru/metrika/tag.js
https://mc.yandex.ru/watch/109372629
```

---

## 2026-05-24: main bot polling on Russian VPS

Context: the main bot `@doobler_bot` used to rely on Telegram webhooks:

```text
Telegram -> https://doobler.ru/api/bot/webhook -> nginx -> doobler-app
```

After the 2026-05-24 VPS update, `/start` stopped answering even though:

- `doobler-app` was healthy and `/api/health` worked.
- `https://doobler.ru/api/bot/webhook` accepted manual external POST requests.
- nginx forwarded those manual POST requests to Next.js.
- `doobler-app` could call Telegram API through `HTTPS_PROXY` / `HTTP_PROXY` with `NODE_OPTIONS=--use-env-proxy`.
- manual `/start` payloads forwarded to `/api/bot/webhook` returned `mini_app_invite` and sent Telegram messages.

The failing direction was specifically:

```text
Telegram webhook delivery -> doobler.ru:443
```

`getWebhookInfo` showed `Connection timed out`, `pending_update_count` grew, and nginx had no access-log entries from Telegram. This means the proxy was not the issue: the app's outbound Telegram API path worked. The failing path was inbound Telegram -> VPS.

### Production workaround

The main bot now uses polling on the VPS, like the support bot:

```text
doobler-main-bot-poller -> Telegram getUpdates via proxy -> app internal webhook
```

Runtime files/services created on VPS:

```text
/opt/doobler/scripts/main-bot-poller.mjs
docker compose service: main-bot-poller
container: doobler-main-bot-poller
```

The poller:

1. Calls `deleteWebhook`.
2. Polls `getUpdates` for `TELEGRAM_BOT_TOKEN`.
3. Forwards each update to `http://app:3000/api/bot/webhook`.
4. Adds `x-telegram-bot-api-secret-token: ${TELEGRAM_WEBHOOK_SECRET}` so the existing Next.js webhook handler is reused unchanged.

### Check polling

Run on VPS:

```bash
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml ps main-bot-poller

docker logs --tail 80 doobler-main-bot-poller

docker logs --tail 80 doobler-app | grep -iE 'bot-debug|telegram-api|webhook|error|warn'
```

Send `/start` to `@doobler_bot`; expected logs:

```text
update ... /start
{"received":true,"result":{"handled":true,"action":"mini_app_invite"}}
```

If `getUpdates` returns `409 Conflict`, another process is polling the same `TELEGRAM_BOT_TOKEN`. Check on VPS:

```bash
ps aux | grep -E 'node|bot|poller|getUpdates' | grep -v grep
docker ps -a | grep -i bot
```

There should be one main poller process:

```text
node /app/scripts/main-bot-poller.mjs
```

and the separate support bot process:

```text
node src/bot.js
```

### Deploy warning

Important: `deploy/deploy.sh` currently registers a webhook through `setWebhook`.

Until Telegram -> VPS webhook delivery is fixed, future deploys must not leave the main bot on webhook mode. After deploy, either:

```bash
docker compose --env-file /opt/doobler/.env.production \
  -f /opt/doobler/deploy/docker-compose.yml up -d main-bot-poller
```

or update `deploy/deploy.sh` so it does not call `setWebhook` for the main bot and instead ensures `main-bot-poller` is running.
