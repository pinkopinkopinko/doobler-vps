// Singleton Redis-клиент с graceful fallback.
//
// Дизайн:
//   - Если `REDIS_URL` не задан → клиент не создаётся, getRedis() возвращает
//     null. Потребители (user-record-cache, rate-limit) делают fallback на
//     in-memory. Это обязательное поведение для dev на Windows и для случая
//     когда Redis-сервис умер.
//   - Если задан → создаётся один ioredis-инстанс на процесс, lazyConnect=true
//     (никаких сетевых обращений при импорте модуля). При первом use вызов
//     `client.connect()` идёт в фоне, ioredis буферизует команды до коннекта
//     и автоматически переподключается при потере соединения.
//   - Любая ошибка Redis в потребителях ловится и трактуется как cache-miss /
//     rate-limit-allow. Падать в HTTP-handler'ы из-за упавшего Redis нельзя.
//
// Namespace ключей: `doobler:<bucket>:<id>`. Префикс позволяет в будущем
// шарить Redis-инстанс с другими сервисами не боясь коллизий.

import Redis, { type Redis as RedisClient, type RedisOptions } from "ioredis";

const KEY_PREFIX = "doobler:";

let cachedClient: RedisClient | null | undefined;
let warnedAboutMissingUrl = false;

function buildOptions(url: string): RedisOptions {
  return {
    // Не открываем сокет при импорте модуля; ioredis сам подключится при
    // первой команде. Это спасает SSR / build-time от падения если Redis
    // ещё не поднят.
    lazyConnect: true,
    // Не плодим логи и не падаем: при недоступности Redis потребители
    // делают fallback. Возвращаем `null` чтобы ioredis перестал ретраить
    // дальше указанной отметки и шёл в error-обработчик.
    maxRetriesPerRequest: 2,
    // Backoff на реконнекты — экспоненциальный, до 5с.
    retryStrategy(times) {
      const delay = Math.min(50 * 2 ** times, 5_000);
      return delay;
    },
    // Не пытаемся подключиться к Sentinel/Cluster — обычный standalone.
    enableOfflineQueue: true,
    connectionName: "doobler-app",
    keyPrefix: KEY_PREFIX,
    // ioredis заполняет URL → options сам, но password/host/port из URL
    // имеют приоритет.
    ...parseRedisUrl(url),
  };
}

function parseRedisUrl(url: string): Partial<RedisOptions> {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      db: parsed.pathname && parsed.pathname.length > 1
        ? Number(parsed.pathname.slice(1)) || 0
        : 0,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Вернуть singleton Redis-клиента или `null`, если Redis не сконфигурирован.
 *
 * Потребители должны быть готовы к `null` и к ошибкам в командах — оба
 * случая означают «работаем как раньше, без Redis».
 */
export function getRedis(): RedisClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    if (!warnedAboutMissingUrl && process.env.NODE_ENV === "production") {
      // В проде хотим знать, что Redis не сконфигурирован — но не падать.
      console.warn(
        "[redis] REDIS_URL не задан, используется in-memory fallback. " +
          "Кэш и rate-limit сбрасываются при рестарте инстанса."
      );
      warnedAboutMissingUrl = true;
    }
    cachedClient = null;
    return null;
  }

  const client = new Redis(buildOptions(url));

  client.on("error", (err: Error) => {
    // Не спамим — ioredis сам ретраит. Логируем только сменой состояния
    // на крупные события.
    if (process.env.LOG_VERBOSE === "true") {
      console.warn("[redis] connection error:", err.message);
    }
  });

  client.on("ready", () => {
    console.info("[redis] connected");
  });

  cachedClient = client;
  return client;
}

/**
 * Полное закрытие соединения. Использовать только в тестах и graceful
 * shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (cachedClient) {
    try {
      await cachedClient.quit();
    } catch {
      cachedClient.disconnect();
    }
  }
  cachedClient = undefined;
  warnedAboutMissingUrl = false;
}

/**
 * Хелпер для потребителей: выполнить операцию с Redis, при любой ошибке
 * вернуть `fallback`. Не логируем — потребитель сам решает, что делать.
 */
export async function safeRedisCall<T>(
  op: (client: RedisClient) => Promise<T>,
  fallback: T
): Promise<T> {
  const client = getRedis();
  if (!client) return fallback;
  try {
    return await op(client);
  } catch {
    return fallback;
  }
}
