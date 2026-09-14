import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  prisma,
  createSessionToken,
  setSessionCookie,
  inspectTelegramInitData,
  getDevelopmentTelegramUser,
  isDevFallbackEnabled,
  tgDebug,
} = vi.hoisted(() => ({
  prisma: {
    user: {
      upsert: vi.fn(),
    },
  },
  createSessionToken: vi.fn(),
  setSessionCookie: vi.fn(),
  inspectTelegramInitData: vi.fn(),
  getDevelopmentTelegramUser: vi.fn(),
  isDevFallbackEnabled: vi.fn(() => false),
  tgDebug: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma,
}));

vi.mock("@/lib/auth/session", () => ({
  createSessionToken,
  setSessionCookie,
}));

vi.mock("@/lib/auth/telegram", () => ({
  inspectTelegramInitData,
  getDevelopmentTelegramUser,
}));

vi.mock("@/lib/dev-fallback", () => ({
  isDevFallbackEnabled,
}));

vi.mock("@/lib/log", () => ({
  tgDebug,
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/telegram", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "TelegramTest/1.0",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/telegram", () => {
  afterEach(() => {
    vi.clearAllMocks();
    isDevFallbackEnabled.mockReturnValue(false);
  });

  it("creates a session from valid Telegram initData", async () => {
    inspectTelegramInitData.mockReturnValue({
      ok: true,
      user: {
        id: 123456,
        first_name: "Ильфар",
        last_name: "Набиуллин",
        username: "ilfar",
        photo_url: "https://example.com/avatar.jpg",
      },
      authDate: 1_714_571_200,
      initDataLength: 128,
    });
    prisma.user.upsert.mockResolvedValue({
      id: "user-1",
      telegramId: "123456",
      username: "ilfar",
      photoUrl: "https://example.com/avatar.jpg",
      isOnboardingCompleted: false,
    });
    createSessionToken.mockResolvedValue("session-token");
    setSessionCookie.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ initData: "signed-init-data" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { telegramId: "123456" },
      update: {
        username: "ilfar",
        lastActiveAt: expect.any(Date),
      },
      create: {
        telegramId: "123456",
        firstName: "Ильфар",
        lastName: "Набиуллин",
        username: "ilfar",
      },
    });
    expect(createSessionToken).toHaveBeenCalledWith({
      userId: "user-1",
      telegramId: "123456",
    });
    expect(setSessionCookie).toHaveBeenCalledWith("session-token");
    expect(payload).toMatchObject({
      user: {
        id: "user-1",
        telegramId: "123456",
      },
    });
  });

  it("denies login when initData is missing and dev fallback is disabled", async () => {
    inspectTelegramInitData.mockReturnValue({
      ok: false,
      reason: "missing_user",
      initDataLength: 0,
    });

    const response = await POST(makeRequest({ initData: "" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(createSessionToken).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      error: expect.any(String),
    });
  });

  it("uses the explicit dev fallback user when auth fallback is enabled", async () => {
    inspectTelegramInitData.mockReturnValue({
      ok: false,
      reason: "invalid_hash",
      authDate: 1_714_571_200,
      initDataLength: 32,
    });
    isDevFallbackEnabled.mockReturnValue(true);
    getDevelopmentTelegramUser.mockReturnValue({
      id: 777,
      first_name: "Dev",
      last_name: "User",
      username: "dev-user",
      photo_url: undefined,
    });
    prisma.user.upsert.mockResolvedValue({
      id: "user-dev",
      telegramId: "777",
      username: "dev-user",
      photoUrl: null,
      isOnboardingCompleted: true,
    });
    createSessionToken.mockResolvedValue("dev-session-token");
    setSessionCookie.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ initData: "broken-init-data" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { telegramId: "777" },
      }),
    );
    expect(payload).toMatchObject({
      user: {
        id: "user-dev",
        telegramId: "777",
      },
    });
  });

  it("denies login when auth fallback is enabled but no explicit dev user is configured", async () => {
    inspectTelegramInitData.mockReturnValue({
      ok: false,
      reason: "invalid_hash",
      authDate: 1_714_571_200,
      initDataLength: 32,
    });
    isDevFallbackEnabled.mockReturnValue(true);
    getDevelopmentTelegramUser.mockReturnValue(null);

    const response = await POST(makeRequest({ initData: "broken-init-data" }));

    expect(response.status).toBe(401);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(createSessionToken).not.toHaveBeenCalled();
  });

  it("returns 500 when the user upsert fails after successful inspection", async () => {
    inspectTelegramInitData.mockReturnValue({
      ok: true,
      user: {
        id: 123456,
        first_name: "Ильфар",
        username: "ilfar",
      },
      authDate: 1_714_571_200,
      initDataLength: 128,
    });
    prisma.user.upsert.mockRejectedValue(new Error("db_down"));

    const response = await POST(makeRequest({ initData: "signed-init-data" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(createSessionToken).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      error: expect.any(String),
    });
  });
});
