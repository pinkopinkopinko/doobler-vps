/**
 * Кеш «толстого» User-record'а, который читает `getCurrentUserRecord`
 * (см. `src/lib/auth/app-access.ts`).
 *
 * Backend выбирается автоматически:
 *   - Если задан `REDIS_URL` и Redis доступен — кеш в Redis (shared между
 *     инстансами, переживает редеплои отдельного app-контейнера).
 *   - Иначе — per-process LRU+TTL Map (как было до внедрения Redis,
 *     ровно тот же контракт).
 *
 * Проблема, которую решает кеш: все страницы `(app)/*` помечены
 * `dynamic = "force-dynamic"`, поэтому на каждом переходе layout зовёт
 * `prisma.user.findUnique` с wide-select (verifications + identityVerifications
 * + city). React `cache()` дедуплицирует только внутри одного рендера, а
 * между навигациями пуст. Этот модуль добавляет shared-cross-request кеш
 * с коротким TTL — компромисс между «всегда свежие данные» и «не бить БД
 * на каждый клик в нижней навигации».
 *
 * Инварианты:
 *   - Кешируется только `user`-часть, НЕ session: session всегда читается
 *     из cookies заново — иначе после logout/login юзер видел бы данные
 *     предыдущей сессии.
 *   - TTL короткий (`CACHE_TTL_MS`) чтобы устаревание не проявлялось
 *     визуально. Для мутаций, которые юзер замечает мгновенно (профиль,
 *     ban/unban), вызывается явная инвалидация через
 *     `invalidateCachedUserRecord`.
 *   - Любая ошибка Redis = cache miss. Падать в layout из-за упавшего
 *     Redis нельзя.
 */

import { safeRedisCall } from "@/lib/redis/client";

const CACHE_TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;
const REDIS_NAMESPACE = "user:";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const memoryStore = new Map<string, CacheEntry<unknown>>();

function memoryRead<T>(userId: string): T | undefined {
  const entry = memoryStore.get(userId);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(userId);
    return undefined;
  }
  // LRU: подвинуть запись в конец итерации Map.
  memoryStore.delete(userId);
  memoryStore.set(userId, entry);
  return entry.data as T;
}

function memoryWrite<T>(userId: string, data: T): void {
  if (memoryStore.size >= MAX_ENTRIES) {
    const oldest = memoryStore.keys().next().value;
    if (oldest !== undefined) {
      memoryStore.delete(oldest);
    }
  }
  memoryStore.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Прочитать запись. Возвращает `undefined` если её нет в кеше; запись
 * со значением `null` (юзер не существует) сохраняется и возвращается
 * как `null`.
 */
export async function readCachedUserRecord<T>(
  userId: string
): Promise<T | undefined> {
  // Сначала пробуем Redis, если он доступен.
  const fromRedis = await safeRedisCall<string | null>(
    (client) => client.get(REDIS_NAMESPACE + userId),
    null
  );
  if (fromRedis !== null) {
    try {
      return JSON.parse(fromRedis) as T;
    } catch {
      // Битая запись — игнорируем, упадём в memory/refresh.
    }
  }

  return memoryRead<T>(userId);
}

export async function writeCachedUserRecord<T>(
  userId: string,
  data: T
): Promise<void> {
  // Дублируем в обе стороны: memory остаётся «горячим» уровнем на случай
  // если Redis ляжет посреди запроса.
  memoryWrite(userId, data);

  await safeRedisCall(
    (client) =>
      client.set(
        REDIS_NAMESPACE + userId,
        JSON.stringify(data),
        "PX",
        CACHE_TTL_MS
      ),
    null
  );
}

/**
 * Сбросить запись для конкретного пользователя — вызывать сразу после
 * мутаций, влияющих на закешированные поля (профиль, роли, ban-статус,
 * верификации). await обязателен: следующий запрос пользователя должен
 * увидеть свежие данные.
 */
export async function invalidateCachedUserRecord(userId: string): Promise<void> {
  memoryStore.delete(userId);
  await safeRedisCall(
    (client) => client.del(REDIS_NAMESPACE + userId),
    0
  );
}

/**
 * Полная очистка — используется в тестах, чтобы кеш не протекал между
 * сценариями.
 */
export async function clearUserRecordCache(): Promise<void> {
  memoryStore.clear();
  await safeRedisCall(async (client) => {
    // FLUSHDB опасен — у нас может шариться БД. Удаляем только наш ns.
    const keys = await client.keys(REDIS_NAMESPACE + "*");
    if (keys.length > 0) {
      // ioredis с keyPrefix двойного префикса не добавляет в DEL — но
      // keys() возвращает уже с keyPrefix внутри, который ioredis потом
      // повторно префиксит. Срезаем префикс вручную.
      const prefix = client.options.keyPrefix ?? "";
      const stripped = keys.map((k) =>
        prefix && k.startsWith(prefix) ? k.slice(prefix.length) : k
      );
      await client.del(...stripped);
    }
    return null;
  }, null);
}
