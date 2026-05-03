import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  prisma,
  createSessionToken,
  setSessionCookie,
  inspectTelegramInitData,
  tgDebug,
} = vi.hoisted(() => ({
  prisma: {
    botLoginToken: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      upsert: vi.fn(),
    },
  },
  createSessionToken: vi.fn(),
  setSessionCookie: vi.fn(),
  inspectTelegramInitData: vi.fn(),
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
}));

vi.mock("@/lib/log", () => ({
  tgDebug,
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/bot-token", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "TelegramTest/1.0",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/bot-token", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a session from a valid unused bot token", async () => {
    prisma.botLoginToken.findUnique.mockResolvedValue({
      token: "token-1",
      telegramId: "123456",
      username: "ilfar",
      firstName: "Ильфар",
      lastName: "Набиуллин",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    prisma.botLoginToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.botLoginToken.findUniqueOrThrow.mockResolvedValue({
      token: "token-1",
      telegramId: "123456",
      username: "ilfar",
      firstName: "Ильфар",
      lastName: "Набиуллин",
    });
    prisma.user.upsert.mockResolvedValue({
      id: "user-1",
      telegramId: "123456",
      username: "ilfar",
      isOnboardingCompleted: false,
    });
    createSessionToken.mockResolvedValue("session-token");
    setSessionCookie.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ token: "token-1", initData: "" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.botLoginToken.updateMany).toHaveBeenCalledWith({
      where: {
        token: "token-1",
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { telegramId: "123456" },
      update: {
        username: "ilfar",
        lastActiveAt: expect.any(Date),
      },
      create: {
        telegramId: "123456",
        username: "ilfar",
        firstName: "Ильфар",
        lastName: "Набиуллин",
      },
    });
    expect(setSessionCookie).toHaveBeenCalledWith("session-token");
    expect(payload).toMatchObject({
      user: {
        id: "user-1",
        telegramId: "123456",
      },
    });
  });

  it("rejects a reused bot token", async () => {
    prisma.botLoginToken.findUnique.mockResolvedValue({
      token: "token-1",
      telegramId: "123456",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(Date.now() - 1_000),
    });

    const response = await POST(makeRequest({ token: "token-1", initData: "" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(prisma.botLoginToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      error: expect.any(String),
    });
  });

  it("rejects a token when signed initData belongs to another Telegram account", async () => {
    inspectTelegramInitData.mockReturnValue({
      ok: true,
      user: {
        id: 999999,
        first_name: "Другой",
      },
      authDate: 1_714_571_200,
      initDataLength: 120,
    });
    prisma.botLoginToken.findUnique.mockResolvedValue({
      token: "token-1",
      telegramId: "123456",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    const response = await POST(makeRequest({ token: "token-1", initData: "signed-init-data" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(prisma.botLoginToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      error: expect.any(String),
    });
  });

  it("rejects invalid initData before claiming the token", async () => {
    inspectTelegramInitData.mockReturnValue({
      ok: false,
      reason: "invalid_hash",
      authDate: 1_714_571_200,
      initDataLength: 48,
    });

    const response = await POST(makeRequest({ token: "token-1", initData: "broken-init-data" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(prisma.botLoginToken.findUnique).not.toHaveBeenCalled();
    expect(prisma.botLoginToken.updateMany).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      error: expect.any(String),
    });
  });
});
