import { afterEach, describe, expect, it, vi } from "vitest";

// Тестируем in-memory путь: REDIS_URL не задан → safeRedisCall возвращает
// fallback, и реальная логика работает на Map. Этого достаточно для проверки
// контракта (TTL, LRU, инвалидация, sync→async API).
//
// Redis-путь покрывать unit-тестами без реального инстанса бессмысленно —
// будем мокать ioredis, а это тестирует мок, а не код. Для Redis-стороны
// есть smoke-проверка через `npm run dev` + ручная инспекция логов.

vi.stubEnv("REDIS_URL", "");

const {
  readCachedUserRecord,
  writeCachedUserRecord,
  invalidateCachedUserRecord,
  clearUserRecordCache,
} = await import("./user-record-cache");

afterEach(async () => {
  await clearUserRecordCache();
});

describe("user-record-cache (in-memory fallback)", () => {
  it("read возвращает undefined для отсутствующего ключа", async () => {
    expect(await readCachedUserRecord("missing")).toBeUndefined();
  });

  it("write → read возвращает то же значение", async () => {
    const value = { id: "u1", name: "Alice" };
    await writeCachedUserRecord("u1", value);
    expect(await readCachedUserRecord<typeof value>("u1")).toEqual(value);
  });

  it("сохраняет null (отсутствующий пользователь) и возвращает его", async () => {
    await writeCachedUserRecord<null>("u2", null);
    expect(await readCachedUserRecord<null>("u2")).toBeNull();
  });

  it("invalidate удаляет запись", async () => {
    await writeCachedUserRecord("u3", { id: "u3" });
    await invalidateCachedUserRecord("u3");
    expect(await readCachedUserRecord("u3")).toBeUndefined();
  });

  it("истёкшая по TTL запись возвращает undefined", async () => {
    vi.useFakeTimers();
    await writeCachedUserRecord("u4", { id: "u4" });
    // CACHE_TTL_MS = 30_000 в модуле; сдвигаем чуть дальше.
    vi.advanceTimersByTime(31_000);
    expect(await readCachedUserRecord("u4")).toBeUndefined();
    vi.useRealTimers();
  });
});
