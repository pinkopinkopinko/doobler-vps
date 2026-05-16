// Edge-валидация Telegram Mini App initData в nginx (njs).
//
// Зачем: nginx сам проверяет HMAC-SHA256 подпись initData ДО proxy_pass в
// Next.js. Все запросы без валидного initData режутся 401 на edge — не
// доходят до Node.js, не бьют Prisma, не нагружают CPU. Защита от спама
// и ботов, которые знают URL ручек, но не имеют валидного Telegram-токена.
//
// Алгоритм — точная копия `inspectTelegramInitData()` из
// `src/lib/auth/telegram.ts`, иначе edge будет отвергать запросы которые
// бэкенд считает валидными (или наоборот):
//   1) разбираем query-string из заголовка `x-telegram-init-data`
//   2) sorted (key1=val1\nkey2=val2\n...) без поля `hash`
//   3) secret = HMAC_SHA256("WebAppData", BOT_TOKEN)
//   4) expected_hash = HMAC_SHA256(secret, data_check_string)
//   5) сравниваем с переданным `hash` (constant-time)
//   6) auth_date < 1 час (TTL должен совпадать с серверным)
//
// BOT_TOKEN читается один раз при загрузке модуля из файла
// `/etc/nginx/njs/.bot-token`, который entrypoint-скрипт записывает из
// переменной окружения `TELEGRAM_BOT_TOKEN`. Сам токен НЕ инжектится в
// config-файлы и НЕ логируется.
//
// Использование в nginx.conf / dubler.conf:
//   load_module modules/ngx_http_js_module.so;
//   ...
//   js_import init_data from /etc/nginx/njs/validate-init-data.js;
//
//   location = /_validate_init_data {
//       internal;
//       js_content init_data.validate;
//   }
//
//   location /api/some-protected-route {
//       auth_request /_validate_init_data;
//       proxy_pass http://app:3000;
//   }

var crypto = require('crypto');
var fs = require('fs');
var qs = require('querystring');

// auth_date TTL — должен совпадать с `60 * 60` из src/lib/auth/telegram.ts.
var AUTH_DATE_MAX_AGE_SEC = 60 * 60;

var BOT_TOKEN = '';
try {
    BOT_TOKEN = fs.readFileSync('/etc/nginx/njs/.bot-token', 'utf8')
        .replace(/[\r\n\s]+/g, '');
} catch (e) {
    // Файл не доступен — validate() будет fail-closed (401 на всё).
    BOT_TOKEN = '';
}

function buildDataCheckString(params) {
    var keys = [];
    for (var k in params) {
        if (k !== 'hash') keys.push(k);
    }
    keys.sort();
    var lines = [];
    for (var i = 0; i < keys.length; i++) {
        var v = params[keys[i]];
        // qs.parse возвращает массив если ключ повторяется. Telegram такого
        // не делает, но на всякий случай берём первое значение.
        if (Array.isArray(v)) v = v[0];
        lines.push(keys[i] + '=' + v);
    }
    return lines.join('\n');
}

function constantTimeEqual(aHex, bHex) {
    if (aHex.length !== bHex.length) return false;
    var diff = 0;
    for (var i = 0; i < aHex.length; i++) {
        diff |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
    }
    return diff === 0;
}

function isValidHash(dataCheckString, receivedHashHex) {
    if (!BOT_TOKEN || !receivedHashHex) return false;
    var secret = crypto.createHmac('sha256', 'WebAppData')
        .update(BOT_TOKEN).digest();
    var calcHex = crypto.createHmac('sha256', secret)
        .update(dataCheckString).digest('hex');
    return constantTimeEqual(calcHex, receivedHashHex.toLowerCase());
}

// Точка входа для js_content. Возвращает:
//   204 — initData валидный, auth_request пропускает дальше
//   401 — невалидный/просроченный/отсутствует, auth_request режет запрос
//
// Никаких заголовков в ответе не ставим — auth_request от nginx смотрит
// только на статус-код subrequest'а.
function validate(r) {
    var initData = r.headersIn['x-telegram-init-data'];
    if (!initData) {
        r.return(401);
        return;
    }

    var params;
    try {
        params = qs.parse(initData);
    } catch (e) {
        r.return(401);
        return;
    }

    var hash = params['hash'];
    if (!hash || typeof hash !== 'string') {
        r.return(401);
        return;
    }

    if (!isValidHash(buildDataCheckString(params), hash)) {
        r.return(401);
        return;
    }

    var authDateStr = params['auth_date'];
    var authDate = authDateStr ? Number(authDateStr) : NaN;
    if (!authDate || !isFinite(authDate)) {
        r.return(401);
        return;
    }

    var nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - authDate > AUTH_DATE_MAX_AGE_SEC) {
        r.return(401);
        return;
    }

    r.return(204);
}

export default { validate: validate };
