# Деплой Дублера на VPS

Готовый набор для разворачивания проекта на чистом Ubuntu 22.04/24.04 VPS
(Selectel VDS 2-4-50 или аналог: 2 vCPU / 4 GB / 50 GB NVMe).

Стек поднимается полностью в Docker:
- `postgres` — PostgreSQL 16, тюненый под 4 GB RAM
- `app` — Next.js 16 + Prisma client (этот репозиторий)
- `nginx` — reverse-proxy 80/443 → app:3000, TLS от Let's Encrypt
- `certbot` — авто-обновление сертификата

## Содержимое `deploy/`

```
deploy/
├── README.md                       — этот файл
├── bootstrap.sh                    — поднимает всё с нуля на чистом VPS
├── deploy.sh                       — обновление после git pull
├── docker-compose.yml              — production-стек
├── Dockerfile                      — production-образ Next.js
├── env.production.template         — шаблон переменных окружения
├── nginx/
│   ├── nginx.conf                  — общий конфиг nginx
│   └── conf.d/dubler.conf          — vhost (HTTP→HTTPS, webhook, app)
├── postgres/
│   └── postgresql.conf             — тюнинг под 2 vCPU / 4 GB
└── scripts/
    ├── gen-secrets.sh              — генерация SESSION_SECRET и других
    ├── backup-db.sh                — pg_dump с retention 14 дней
    ├── restore-db.sh               — откат из дампа
    └── register-webhook.sh         — перепривязка Telegram webhook
```

## Что нужно перед деплоем

1. **Купленный VPS** с Ubuntu 22.04 или 24.04 LTS
   - рекомендуем Selectel VDS 2-4-50 (~650 ₽/мес)
2. **Купленный домен** с A-записью на IP сервера
   - например `dubler.ru` → `1.2.3.4`
3. **Telegram-бот** с токеном от `@BotFather`
4. **SSH-доступ** к серверу под root (или sudo-пользователем)

## Шаги деплоя

### 1. Подготовка на локальной машине

```bash
# Сгенерировать секреты:
bash deploy/scripts/gen-secrets.sh > /tmp/secrets.txt

# Сгенерировать хеш админ-пароля (нужен установленный node_modules):
npm install
npm run admin:hash-password
# Скопировать выведенный scrypt$... хеш.
```

### 2. Загрузка проекта на сервер

```bash
# С локалки (или через `git clone` на самом сервере, если у вас приватный репо):
ssh root@1.2.3.4 'mkdir -p /opt/doobler'
rsync -av --exclude=node_modules --exclude=.next --exclude=.git \
    --exclude='*.log' --exclude=backups --exclude=uploads \
    ./ root@1.2.3.4:/opt/doobler/
```

### 3. Создание `.env.production` на сервере

```bash
ssh root@1.2.3.4
cd /opt/doobler
cp deploy/env.production.template .env.production
nano .env.production
# Заполни все значения — DOMAIN, ACME_EMAIL, секреты, токен бота, хеш админа.
chmod 600 .env.production
```

### 4. Запуск bootstrap

```bash
sudo bash /opt/doobler/deploy/bootstrap.sh
```

Скрипт сам:
- поставит Docker, ufw, fail2ban
- выпустит Let's Encrypt сертификат для DOMAIN
- поднимет полный стек
- зарегистрирует webhook у Telegram
- настроит cron на ежедневные бэкапы

После выполнения — проверь:
```bash
curl -fsS https://${DOMAIN}/api/health
docker logs -f doobler-app
```

## Обновления

Когда вышел новый код (push в `main`):

```bash
ssh root@1.2.3.4
cd /opt/doobler

# Если используется git:
git pull

# Если деплоите rsync'ом — заново скопируйте файлы с локалки.

sudo bash deploy/deploy.sh
```

`deploy.sh` сделает бэкап БД, пересоберёт образ, применит миграции через
`prisma db push` и перезапустит app.

## Полезные команды

```bash
# Логи
docker logs -f doobler-app
docker logs -f doobler-nginx
docker logs -f doobler-postgres

# Шелл в БД
docker exec -it doobler-postgres psql -U doobler doobler

# Шелл в app-контейнере
docker exec -it doobler-app sh

# Бэкап вручную
sudo bash /opt/doobler/deploy/scripts/backup-db.sh

# Перепривязать webhook (после смены домена/secret'а)
sudo bash /opt/doobler/deploy/scripts/register-webhook.sh

# Полный рестарт
docker compose --env-file /opt/doobler/.env.production \
    -f /opt/doobler/deploy/docker-compose.yml restart
```

## Что мониторить

- `curl https://${DOMAIN}/api/health` должен возвращать `{"ok":true}`
- `docker stats` — память app не должна расти бесконечно (есть лимит 2 GB)
- `df -h` — диск под uploads и БД
- `/var/backups/doobler/` — свежие дампы должны появляться раз в сутки

## Что точно не забыть

- В Selectel/Timeweb включить **снапшоты VPS** раз в сутки — это второй
  слой защиты помимо `pg_dump` (восстановит и uploads, и систему).
- Если бот-токен где-то светился (в локальных `.env`, в чатах) —
  перевыпустить его в `@BotFather` ПЕРЕД заливкой `.env.production`.
- DNS A-запись должна указывать на IP VPS **до** запуска bootstrap.sh,
  иначе Let's Encrypt не выдаст сертификат.
