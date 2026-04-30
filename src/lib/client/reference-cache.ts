"use client";

type CacheEnvelope<T> = {
  expiresAt: number;
  value: T;
};

const memoryCache = new Map<string, CacheEnvelope<unknown>>();

function readCache<T>(key: string) {
  const fromMemory = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  if (fromMemory && fromMemory.expiresAt > Date.now()) {
    return fromMemory.value;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    memoryCache.set(key, parsed as CacheEnvelope<unknown>);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T, ttlMs: number) {
  const payload: CacheEnvelope<T> = {
    expiresAt: Date.now() + ttlMs,
    value,
  };

  memoryCache.set(key, payload as CacheEnvelope<unknown>);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage quota / privacy mode errors
  }
}

export async function getCachedResource<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = 30 * 60_000,
) {
  const cached = readCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const loaded = await loader();
  writeCache(key, loaded, ttlMs);
  return loaded;
}

export function invalidateCachedResource(key: string) {
  memoryCache.delete(key);

  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(key);
}
