// Rate limiter с двумя backend'ами:
//   - Redis (если задан REDIS_URL и доступен) — fixed-window через INCR+PEXPIRE.
//     Переживает редеплои app-контейнера, шарится между инстансами.
//   - In-memory Map — fallback. Сбрасывается при рестарте процесса.
//
// Имя файла оставлено как in-memory.ts ради обратной совместимости импортов;
// фактически модуль теперь гибридный.
//
// Когда использовать:
// - анти-спам POST'ы от пользователей (chats, reports);
// - умеренные ограничения на DaData-прокси;
// - всё, где «забыли счётчик при рестарте» — допустимо при отсутствии Redis.
//
// Когда НЕ использовать:
// - персистентные защиты от брутфорса (admin login → используйте db.ts);
//   там нужна атомарная блокировка с историей попыток, а тут просто счётчик.
//
// Реализация: fixed-window — проще sliding-window и достаточно для наших
// целей. По истечении окна счётчик сбрасывается.

import { getRedis } from "@/lib/redis/client";

const MAX_BUCKETS = 50_000;
const REDIS_NAMESPACE = "rl:";

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

export type RateLimitParams = {
  // Логический ключ. Как правило — `${scope}:${identifier}`.
  key: string;
  // Длина окна (мс).
  windowMs: number;
  // Максимум обращений за окно.
  max: number;
};

export async function checkInMemoryRateLimit(
  params: RateLimitParams
): Promise<InMemoryRateLimitResult> {
  // Попытка через Redis: атомарный INCR + (на первом обращении) PEXPIRE.
  // При любой ошибке Redis падаем в memory-логику — на rate-limit'е лучше
  // временно подсчитать недостоверно, чем уронить весь handler.
  const redis = getRedis();
  if (redis) {
    try {
      const redisKey = REDIS_NAMESPACE + params.key;
      const pipeline = redis.multi();
      pipeline.incr(redisKey);
      pipeline.pttl(redisKey);
      const exec = await pipeline.exec();
      if (exec) {
        const count = Number(exec[0]?.[1] ?? 0);
        let ttl = Number(exec[1]?.[1] ?? -1);

        if (count === 1 || ttl < 0) {
          // Только что создали ключ либо у него почему-то не было TTL —
          // выставляем окно. PEXPIRE NX в ioredis есть, но он на старых
          // Redis может быть не поддержан; явный set безопаснее.
          await redis.pexpire(redisKey, params.windowMs);
          ttl = params.windowMs;
        }

        if (count > params.max) {
          return {
            ok: false,
            remaining: 0,
            retryAfterMs: ttl > 0 ? ttl : params.windowMs,
          };
        }

        return {
          ok: true,
          remaining: Math.max(params.max - count, 0),
          retryAfterMs: 0,
        };
      }
    } catch {
      // fall through на memory
    }
  }

  return checkMemory(params);
}

function checkMemory(params: RateLimitParams): InMemoryRateLimitResult {
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
