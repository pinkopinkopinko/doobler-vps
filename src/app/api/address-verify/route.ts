import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { verifyAddressSelection } from "@/lib/geocoder/yandex-geocode";
import { checkInMemoryRateLimit } from "@/lib/rate-limit/in-memory";
import { buildRateLimitResponse } from "@/lib/rate-limit/response";

// Verify дёргается реже suggestions (только при submit формы), поэтому лимит
// мягче. Главное — не дать одному юзеру забить всю DaData-квоту через
// автоматический скрипт.
const PER_MINUTE_LIMIT = { windowMs: 60_000, max: 10 } as const;
const PER_DAY_LIMIT = { windowMs: 24 * 60 * 60 * 1000, max: 200 } as const;

export async function POST(request: Request) {
  const session = await getSessionPayload();
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");
  const userAgent = request.headers.get("user-agent");

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  let body: { cityId?: string; query?: string; uri?: string | null } | null = null;

  try {
    body = (await request.json()) as { cityId?: string; query?: string; uri?: string | null };
  } catch {
    return fail("Некорректный формат запроса.", 400);
  }

  const cityId = body?.cityId?.trim() ?? "";
  const query = body?.query?.trim() ?? "";
  const uri = body?.uri?.trim() ?? null;

  if (!cityId) {
    return fail("Сначала выберите город.", 400);
  }

  if (query.length < 3) {
    return fail("Введите минимум 3 символа адреса.", 400);
  }

  const minuteCheck = await checkInMemoryRateLimit({
    key: `dadata-verify-min:${session.userId}`,
    ...PER_MINUTE_LIMIT,
  });
  if (!minuteCheck.ok) {
    return buildRateLimitResponse(minuteCheck.retryAfterMs);
  }

  const dayCheck = await checkInMemoryRateLimit({
    key: `dadata-verify-day:${session.userId}`,
    ...PER_DAY_LIMIT,
  });
  if (!dayCheck.ok) {
    return buildRateLimitResponse(
      dayCheck.retryAfterMs,
      "Дневной лимит проверок адреса исчерпан.",
    );
  }

  console.log("[address-verify] request", {
    userId: session.userId,
    cityId,
    queryLength: query.length,
    hasUri: Boolean(uri),
    referer,
    origin,
    userAgent,
  });

  try {
    const verified = await verifyAddressSelection({
      cityId,
      query,
      expectedUri: uri,
    });

    console.log("[address-verify] success", {
      userId: session.userId,
      cityId,
      district: verified.district,
      precision: verified.precision,
    });

    return ok({ verified });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("[address-verify] failed", {
      userId: session.userId,
      cityId,
      queryLength: query.length,
      hasUri: Boolean(uri),
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

    if (message === "ADDRESS_CITY_MISMATCH") {
      return fail("Адрес относится к другому городу.", 400);
    }

    if (message === "DISTRICT_NOT_FOUND") {
      return fail("Не удалось определить район по этому адресу.", 400);
    }

    if (message === "ADDRESS_NOT_FOUND" || message === "ADDRESS_NOT_VERIFIED") {
      return fail("Не удалось подтвердить адрес.", 400);
    }

    if (message.startsWith("DADATA_")) {
      return fail("DaData временно недоступна. Попробуйте ещё раз.", 502);
    }

    return fail("Не удалось проверить адрес.", 502);
  }
}
