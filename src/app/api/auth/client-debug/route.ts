import { inspect } from "util";

import { ok } from "@/lib/api";
import { checkInMemoryRateLimit } from "@/lib/rate-limit/in-memory";
import { getClientIp } from "@/lib/rate-limit/ip";
import { buildRateLimitResponse } from "@/lib/rate-limit/response";

// Этот эндпоинт собирает debug-телеметрию по багам Telegram WebApp bootstrap
// (missing initData, reauth failed и т.д.), когда у пользователя ЕЩЁ нет
// сессии, поэтому требовать auth нельзя. Но открытый endpoint без ограничений
// — это log flooding на диск. Защищаем двумя вещами:
//   1) жёсткий лимит размера тела (любой разумный debug-пэйлоад укладывается
//      в 8 КБ; аплоад бинарника через этот канал нам не нужен).
//   2) rate-limit по IP — 20 запросов в минуту. Достаточно для честного
//      клиента (событий bootstrap у одного юзера единицы), отсекает bot-ботов.
const MAX_DEBUG_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

const SECRETISH_KEYS = new Set(["initData", "loginToken", "token", "authorization", "cookie"]);

function sanitizePayload(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/([?&](?:loginToken|token)=)[^&#]+/g, "$1<hidden>")
      .replace(/([?&]tgWebAppData=)[^&#]+/g, "$1<hidden>")
      .replace(/#tgWebAppData=.*$/g, "#<hidden>");
  }

  if (Array.isArray(value)) {
    return value.map(sanitizePayload);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRETISH_KEYS.has(key) ? "<hidden>" : sanitizePayload(item),
      ]),
    );
  }

  return value;
}

function getRequestMeta(request: Request, ip: string, contentLength: number) {
  return {
    receivedAt: new Date().toISOString(),
    ip,
    method: request.method,
    contentLength,
    userAgent: request.headers.get("user-agent") ?? "unknown",
    referer: sanitizePayload(request.headers.get("referer") ?? null),
    origin: request.headers.get("origin") ?? null,
    forwardedFor: request.headers.get("x-forwarded-for") ?? null,
    realIp: request.headers.get("x-real-ip") ?? null,
    forwardedHost: request.headers.get("x-forwarded-host") ?? null,
    forwardedProto: request.headers.get("x-forwarded-proto") ?? null,
  };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = await checkInMemoryRateLimit({
    key: `client-debug:${ip}`,
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
  });

  if (!rate.ok) {
    // Осознанно не логируем 429: если кто-то пытается завалить эндпоинт,
    // лог от отказов нагрузит диск так же, как и принятые запросы.
    return buildRateLimitResponse(rate.retryAfterMs);
  }

  // Быстрая проверка по заголовку; не ловит кейс, когда Content-Length
  // отсутствует, но отсекает явные попытки слать мегабайты.
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_DEBUG_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "payload too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Читаем как текст, чтобы самим контролировать размер: если клиент
  // не прислал Content-Length, defend-in-depth отсекает оверсайз.
  const rawBody = await request.text().catch(() => "");
  if (rawBody.length > MAX_DEBUG_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "payload too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown> | null = null;
  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }

  const logPayload = {
    ...getRequestMeta(request, ip, contentLength),
    payload: sanitizePayload(payload),
  };

  console.info(
    `[tg-debug] client-report ${inspect(logPayload, {
      colors: false,
      depth: null,
      breakLength: 140,
      maxArrayLength: 80,
      maxStringLength: 2000,
    })}`,
  );

  return ok({ received: true });
}
