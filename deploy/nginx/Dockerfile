# Кастомный nginx-образ с njs-модулем для edge-валидации Telegram initData.
#
# nginx-module-njs — официальный пакет от nginx team в той же Alpine-репе,
# которую использует базовый образ `nginx:1.27-alpine`. Версия модуля
# автоматически совпадает с версией nginx в образе.
#
# Зачем не использовать стоковый `nginx:1.27-alpine`:
#   - нужен ngx_http_js_module.so для `js_import` и `js_content` директив,
#   - стоковый образ модуль не включает.
#
# Что внутри:
#   /etc/nginx/njs/validate-init-data.js  — модуль HMAC-валидации
#   /etc/nginx/njs/.bot-token             — заполняется entrypoint'ом при старте
#   /docker-entrypoint.d/40-bake-bot-token.sh — entrypoint-hook nginx-образа

FROM nginx:1.27-alpine

# Устанавливаем njs-модуль из официального apk-репозитория nginx.
# Пакет называется `nginx-module-njs` (новый) или `nginx-mod-http-js` (legacy);
# пробуем оба, чтобы образ собирался независимо от состояния apk.
RUN set -eux; \
    (apk add --no-cache nginx-module-njs \
     || apk add --no-cache nginx-mod-http-js); \
    # sanity-check: модуль должен лежать там, куда смотрит `load_module`
    test -f /usr/lib/nginx/modules/ngx_http_js_module.so

# Папка под njs-модули и токен. Права 0700 — внутрь могут смотреть только
# процессы nginx (worker'ы запускаются от nginx user'а, master root).
RUN mkdir -p /etc/nginx/njs \
    && chown -R nginx:nginx /etc/nginx/njs \
    && chmod 0750 /etc/nginx/njs

COPY njs/validate-init-data.js /etc/nginx/njs/validate-init-data.js
COPY entrypoint-bake-bot-token.sh /docker-entrypoint.d/40-bake-bot-token.sh

# В Linux выполняемость надо явно ставить (тарбол из Windows её теряет).
RUN chmod +x /docker-entrypoint.d/40-bake-bot-token.sh \
    && chmod 0640 /etc/nginx/njs/validate-init-data.js \
    && chown nginx:nginx /etc/nginx/njs/validate-init-data.js
