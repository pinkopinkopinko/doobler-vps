// In-memory sliding-window rate limiter.
//
// Когда использовать:
// - анти-спам POST'ы от пользователей (chats, reports);
// - умеренные ограничения на DaData-прокси;
// - всё, где «забыли счётчик при рестарте» — допустимо.
//
// Когда НЕ использовать:
// - персистентные защиты от брутфорса (admin login → используйте db.ts);
// - multi-instance деплои (нужен Redis/db).
//
// Реализация: для простоты — fixed-window. Проверили, что окно ещё активно,
// инкрементнули, если перебор — отказ. По истечении окна счётчик сбрасывается.
// Это достаточно для наших целей; «true sliding window» добавляет сложности,
// которой здесь не нужно.

const MAX_BUCKETS = 50_000;

type Bucket = {
  count: number;
  // Эпоха в миллисекундах, когда окно «сгорает» и счётчик сбрасывается.
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type InMemoryRateLimitResult = {
  ok: boolean;
  // Сколько ещё раз можно дёрнуть в текущем окне (0 если уже отказ).
  remaining: number;
  // Сколько мс подождать до сброса окна (0 если ещё допускаем).
  retryAfterMs: number;
};

export function checkInMemoryRateLimit(params: {
  // Логический ключ. Как правило — `${scope}:${identifier}`.
  key: string;
  // Длина окна (мс).
  windowMs: number;
  // Максимум обращений за окно.
  max: number;
}): InMemoryRateLimitResult {
  const now = Date.now();
  const existing = buckets.get(params.key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(params.key, { count: 1, resetAt: now + params.windowMs });
    cleanupIfNeeded(now);
    return { ok: true, remaining: params.max - 1, retryAfterMs: 0 };
  }

  if (existing.count >= params.max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(existing.resetAt - now, 0),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: params.max - existing.count,
    retryAfterMs: 0,
  };
}

// Срубает протухшие bucket'ы, когда Map разрастается.
// На 2k DAU и небольших max-значениях суммарный размер не превысит ~10k,
// так что в обычной жизни этот код не вызывается. На всякий случай — есть.
function cleanupIfNeeded(now: number) {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
    if (buckets.size < MAX_BUCKETS / 2) {
      break;
    }
  }
}

// Тесты могут понадобиться, выпустим хук для очистки.
export function __resetInMemoryRateLimit() {
  buckets.clear();
}
