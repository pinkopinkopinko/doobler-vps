import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { fetchAddressSuggestions } from "@/lib/geocoder/yandex-suggest";
import { checkInMemoryRateLimit } from "@/lib/rate-limit/in-memory";
import { buildRateLimitResponse } from "@/lib/rate-limit/response";

// Двухуровневый лимит DaData per-user:
// - Минутный — защита от случайных спам-keystroke'ов (debounce упал, и т.п.).
// - Суточный — защита квоты DaData (10k/день в платных тарифах). Один
//   зловред мог бы спалить всю квоту за час.
const PER_MINUTE_LIMIT = { windowMs: 60_000, max: 30 } as const;
const PER_DAY_LIMIT = { windowMs: 24 * 60 * 60 * 1000, max: 500 } as const;

export async function GET(request: Request) {
  const session = await getSessionPayload();
  const { searchParams } = new URL(request.url);
  const cityId = searchParams.get("cityId")?.trim();
  const q = searchParams.get("q")?.trim() ?? "";
  const sessionToken = searchParams.get("sessionToken");
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");
  const userAgent = request.headers.get("user-agent");

  if (!session) {
    console.warn("[address-suggestions] denied", {
      reason: "missing_session",
      cityId: cityId ?? null,
      queryLength: q.length,
      referer,
      origin,
      userAgent,
    });
    return fail("Нужен вход через Telegram.", 401);
  }

  if (!cityId) {
    return fail("Сначала выберите город.", 400);
  }

  if (q.length < 3) {
    return ok({ suggestions: [] });
  }

  // Лимиты применяем ПОСЛЕ early-return'ов (короткий q даёт пустой ответ
  // и не должен жечь квоту). Per-user, не per-IP — так фейр'нее в Telegram
  // WebView, где у нескольких юзеров может оказаться один общий IP.
  const minuteCheck = await checkInMemoryRateLimit({
    key: `dadata-suggest-min:${session.userId}`,
    ...PER_MINUTE_LIMIT,
  });
  if (!minuteCheck.ok) {
    return buildRateLimitResponse(minuteCheck.retryAfterMs);
  }

  const dayCheck = await checkInMemoryRateLimit({
    key: `dadata-suggest-day:${session.userId}`,
    ...PER_DAY_LIMIT,
  });
  if (!dayCheck.ok) {
    return buildRateLimitResponse(
      dayCheck.retryAfterMs,
      "Дневной лимит подсказок адреса исчерпан.",
    );
  }

  console.log("[address-suggestions] request", {
    userId: session.userId,
    cityId,
    queryLength: q.length,
    sessionTokenPresent: Boolean(sessionToken?.trim()),
    referer,
    origin,
    userAgent,
  });

  try {
    const suggestions = await fetchAddressSuggestions({
      cityId,
      query: q,
      sessionToken,
      referer,
      origin,
    });

    console.log("[address-suggestions] success", {
      userId: session.userId,
      cityId,
      queryLength: q.length,
      suggestionsCount: suggestions.length,
    });

    return ok({ suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("[address-suggestions] failed", {
      userId: session.userId,
      cityId,
      queryLength: q.length,
      referer,
      origin,
      userAgent,
      error: message,
    });

    if (message === "DADATA_NOT_CONFIGURED") {
      return fail("На сервере не настроен API-ключ DaData.", 503);
    }

    if (message === "CITY_NOT_FOUND") {
      return fail("Не удалось определить выбранный город.", 404);
    }

    return fail("Не удалось загрузить подсказки адреса.", 502);
  }
}
