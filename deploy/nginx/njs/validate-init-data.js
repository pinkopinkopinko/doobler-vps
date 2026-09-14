// Edge validation for Telegram/MAX Mini App initData in nginx (njs).
//
// The app still validates initData on the server. This edge guard rejects obvious
// garbage before requests reach Next.js, Prisma, or application rate limits.
//
// Supported headers:
//   - x-telegram-init-data, signed with TELEGRAM_BOT_TOKEN
//   - x-max-init-data, signed with MAX_BOT_TOKEN
//
// HMAC algorithm must match src/lib/auth/telegram.ts and src/lib/auth/max.ts:
//   1) parse query-string from the platform initData header
//   2) build sorted "key=value\n..." data check string without "hash"
//   3) secret = HMAC_SHA256("WebAppData", bot_token)
//   4) expected_hash = HMAC_SHA256(secret, data_check_string)
//   5) constant-time compare with the received hash
//   6) reject auth_date older than 1 hour

var crypto = require('crypto');
var fs = require('fs');
var qs = require('querystring');

var AUTH_DATE_MAX_AGE_SEC = 60 * 60;

function readToken(path) {
    try {
        return fs.readFileSync(path, 'utf8').replace(/[\r\n\s]+/g, '');
    } catch (e) {
        return '';
    }
}

var TELEGRAM_BOT_TOKEN = readToken('/etc/nginx/njs/.bot-token');
var MAX_BOT_TOKEN = readToken('/etc/nginx/njs/.max-bot-token');

function buildDataCheckString(params) {
    var keys = [];
    for (var k in params) {
        if (k !== 'hash') keys.push(k);
    }

    keys.sort();

    var lines = [];
    for (var i = 0; i < keys.length; i++) {
        var v = params[keys[i]];
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

function isValidHash(dataCheckString, receivedHashHex, botToken) {
    if (!botToken || !receivedHashHex) return false;

    var secret = crypto.createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();
    var calcHex = crypto.createHmac('sha256', secret)
        .update(dataCheckString)
        .digest('hex');

    return constantTimeEqual(calcHex, receivedHashHex.toLowerCase());
}

function validateInitData(initData, botToken) {
    if (!initData || !botToken) return false;

    var params;
    try {
        params = qs.parse(initData);
    } catch (e) {
        return false;
    }

    var hash = params['hash'];
    if (!hash || typeof hash !== 'string') {
        return false;
    }

    if (!isValidHash(buildDataCheckString(params), hash, botToken)) {
        return false;
    }

    var authDateStr = params['auth_date'];
    var authDate = authDateStr ? Number(authDateStr) : NaN;
    if (!authDate || !isFinite(authDate)) {
        return false;
    }

    var nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - authDate > AUTH_DATE_MAX_AGE_SEC) {
        return false;
    }

    return true;
}

function validate(r) {
    if (validateInitData(r.headersIn['x-telegram-init-data'], TELEGRAM_BOT_TOKEN)) {
        r.return(204);
        return;
    }

    if (validateInitData(r.headersIn['x-max-init-data'], MAX_BOT_TOKEN)) {
        r.return(204);
        return;
    }

    r.return(401);
}

export default { validate: validate };
