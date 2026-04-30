import { fail, ok } from "@/lib/api";
import {
  createAdminSessionToken,
  hasConfiguredAdminCredentials,
  setAdminSessionCookie,
  validateAdminCredentials,
} from "@/lib/auth/admin-session";
import { peekDbRateLimit, recordDbAttempt } from "@/lib/rate-limit/db";
import { getClientIp } from "@/lib/rate-limit/ip";

export const dynamic = "force-dynamic";

// Брутфорс-защита: 10 неудачных попыток с одного IP за час → 429.
// Записываем ТОЛЬКО неудачи, чтобы легитимный админ не блокировал себя
// нормальным циклом login → logout → login.
const ADMIN_LOGIN_RATE_LIMIT = {
  scope: "admin-login",
  windowMs: 60 * 60 * 1000,
  max: 10,
} as const;

function buildRetryAfterSeconds(ms: number) {
  return Math.max(1, Math.ceil(ms / 1000));
}

export async function POST(request: Request) {
  if (!hasConfiguredAdminCredentials()) {
    return fail("Админ-логин не настроен на сервере.", 503);
  }

  const ip = getClientIp(request);

  // Сначала проверяем лимит — ДО разбора body и до scrypt-сравнения.
  // Если кто-то уже исчерпал квоту, не даём ему даже шанс сжечь CPU
  // на хеш-проверках.
  try {
    const peek = await peekDbRateLimit({
      ...ADMIN_LOGIN_RATE_LIMIT,
      identifier: ip,
    });

    if (!peek.ok) {
      const retryAfter = buildRetryAfterSeconds(peek.retryAfterMs);
      console.warn("[admin-auth] rate limited", { ip, retryAfter });
      return new Response(
        JSON.stringify({
          error: "Слишком много попыток входа. Попробуйте позже.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
          },
        },
      );
    }
  } catch (error) {
    // Если БД недоступна — продолжаем без rate-limit'а, чтобы не уронить
    // легитимный логин из-за сторонней проблемы. Логируем, чтобы заметить.
    console.error("[admin-auth] rate-limit check failed", error);
  }

  let body: { login?: string; password?: string } | null = null;

  try {
    body = (await request.json()) as { login?: string; password?: string };
  } catch {
    return fail("Некорректный формат запроса.", 400);
  }

  const login = body?.login?.trim() ?? "";
  const password = body?.password ?? "";

  if (!login || !password) {
    return fail("Введите логин и пароль.", 400);
  }

  if (!validateAdminCredentials(login, password)) {
    // Записываем неудачу (best-effort). Если БД ляжет — просто не считаем.
    void recordDbAttempt({
      scope: ADMIN_LOGIN_RATE_LIMIT.scope,
      identifier: ip,
    }).catch((error) => {
      console.error("[admin-auth] failed to record attempt", error);
    });
    return fail("Неверный логин или пароль.", 401);
  }

  const token = await createAdminSessionToken({
    username: login,
    mode: "password",
  });

  await setAdminSessionCookie(token);

  return ok({ ok: true });
}
