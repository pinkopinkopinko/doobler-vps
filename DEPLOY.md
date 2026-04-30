# Деплой Дублера на VPS — быстрая шпаргалка

Полная инструкция: [`deploy/README.md`](./deploy/README.md).

## TL;DR

1. Купить **Selectel VDS 2-4-50** (2 vCPU / 4 GB / 50 GB NVMe, ~650 ₽/мес),
   Ubuntu 24.04 LTS.
2. Купить домен, поставить A-запись на IP сервера.
3. Залить проект на сервер в `/opt/doobler/`.
4. Создать `/opt/doobler/.env.production` из шаблона
   `deploy/env.production.template`.
5. Запустить `sudo bash /opt/doobler/deploy/bootstrap.sh`.

Готово. Сервер сам поднимет Docker, Postgres, Next.js, nginx, выпустит TLS,
зарегистрирует Telegram webhook и поставит cron на бэкапы.

## Команды одной портянкой

На локальной машине:

```bash
# 1. Сгенерировать секреты
bash deploy/scripts/gen-secrets.sh

# 2. Сгенерировать админ-хеш (требует npm install)
npm run admin:hash-password

# 3. Залить проект на сервер
ssh root@1.2.3.4 'mkdir -p /opt/doobler'
rsync -av --exclude=node_modules --exclude=.next --exclude=.git \
    --exclude='*.log' --exclude=backups --exclude=uploads \
    ./ root@1.2.3.4:/opt/doobler/
```

На сервере:

```bash
ssh root@1.2.3.4
cd /opt/doobler
cp deploy/env.production.template .env.production
nano .env.production       # заполнить все CHANGE_ME_*
chmod 600 .env.production

sudo bash deploy/bootstrap.sh
```

## Обновления потом

```bash
ssh root@1.2.3.4 'cd /opt/doobler && git pull && sudo bash deploy/deploy.sh'
```

## Что делать, если упало

```bash
docker logs --tail 200 doobler-app
docker logs --tail 200 doobler-nginx
docker compose --env-file /opt/doobler/.env.production \
    -f /opt/doobler/deploy/docker-compose.yml ps
```
