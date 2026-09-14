import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("REDIS_URL", "");

const { checkInMemoryRateLimit, __resetInMemoryRateLimit } = await import(
  "./in-memory"
);

beforeEach(() => {
  __resetInMemoryRateLimit();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkInMemoryRateLimit (memory fallback)", () => {
  it("первое обращение проходит, remaining уменьшается", async () => {
    const r1 = await checkInMemoryRateLimit({
      key: "k1",
      windowMs: 1000,
      max: 3,
    });
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it("блокирует после превышения max", async () => {
    const params = { key: "k2", windowMs: 1000, max: 2 };
    expect((await checkInMemoryRateLimit(params)).ok).toBe(true);
    expect((await checkInMemoryRateLimit(params)).ok).toBe(true);
    const blocked = await checkInMemoryRateLimit(params);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("сбрасывается после окна", async () => {
    vi.useFakeTimers();
    const params = { key: "k3", windowMs: 1000, max: 1 };
    expect((await checkInMemoryRateLimit(params)).ok).toBe(true);
    expect((await checkInMemoryRateLimit(params)).ok).toBe(false);
    vi.advanceTimersByTime(1100);
    expect((await checkInMemoryRateLimit(params)).ok).toBe(true);
  });
});
