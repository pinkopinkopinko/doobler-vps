import { prisma } from "@/lib/prisma";

// Postgres-backed rate limiter. Используется для брутфорс-защит, которые
// должны переживать рестарт процесса (admin login, в будущем — verification
// codes и т.п.). Каждая запись = один зафиксированный «инцидент» в окне.
//
// API даёт две операции, чтобы вызвать в правильном порядке:
//
//   peekDbRateLimit  → проверить, не превышен ли лимит ДО операции;
//                      ничего не пишет.
//   recordDbAttempt  → залогировать попытку (после неудачи).
//
// Для admin login считаем ТОЛЬКО неудачные попытки. Это значит, что
// легитимный админ не упирается в лимит, а атакующий со словарём — упирается
// после N подряд неудач.
//
// Старые записи периодически вычищаем (см. clearExpired).

export type DbRateLimitResult = {
  ok: boolean;
  // Сколько ещё неудач можно перед тем как сработает блок.
  remaining: number;
  // Сколько мс ждать до сброса окна (0 если ещё допускаем).
  retryAfterMs: number;
};

type RateLimitParams = {
  scope: string;
  identifier: string;
  windowMs: number;
  max: number;
};

export async function peekDbRateLimit(params: RateLimitParams): Promise<DbRateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - params.windowMs);

  const count = await prisma.rateLimitAttempt.count({
    where: {
      scope: params.scope,
      identifier: params.identifier,
      createdAt: { gte: windowStart },
    },
  });

  if (count < params.max) {
    return {
      ok: true,
      remaining: params.max - count,
      retryAfterMs: 0,
    };
  }

  // Сработал лимит — берём самую старую запись внутри окна, чтобы
  // вернуть честный retry-after (когда она «выпадет» из окна).
  const oldest = await prisma.rateLimitAttempt.findFirst({
    where: {
      scope: params.scope,
      identifier: params.identifier,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const retryAfterMs = oldest
    ? Math.max(oldest.createdAt.getTime() + params.windowMs - now.getTime(), 0)
    : 0;

  return {
    ok: false,
    remaining: 0,
    retryAfterMs,
  };
}

export async function recordDbAttempt(params: {
  scope: string;
  identifier: string;
}): Promise<void> {
  await prisma.rateLimitAttempt.create({
    data: {
      scope: params.scope,
      identifier: params.identifier,
    },
  });
}

// Вызывайте периодически (cron / handler), чтобы таблица не пухла.
// Сейчас не подключено к scheduler'у; раз в сутки запустить руками
// или из скрипта обслуживания достаточно.
export async function clearExpiredRateLimitAttempts(olderThanMs: number) {
  const cutoff = new Date(Date.now() - olderThanMs);
  return prisma.rateLimitAttempt.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });
}
