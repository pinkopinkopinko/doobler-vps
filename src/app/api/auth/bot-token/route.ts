import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { inspectTelegramInitData } from "@/lib/auth/telegram";
import { tgDebug } from "@/lib/log";
import { prisma } from "@/lib/prisma";

function getClientMeta(request: NextRequest) {
  return {
    userAgent: request.headers.get("user-agent") ?? "unknown",
    referer: request.headers.get("referer") ?? "unknown",
    origin: request.headers.get("origin") ?? null,
    forwardedHost: request.headers.get("x-forwarded-host") ?? null,
    forwardedProto: request.headers.get("x-forwarded-proto") ?? null,
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { token?: string; initData?: string }
    | null;
  const token = body?.token?.trim() ?? "";
  const initData = body?.initData ?? "";
  const meta = getClientMeta(request);

  tgDebug("server:auth-bot-token-start", {
    tokenPresent: Boolean(token),
    tokenLength: token.length,
    initDataLength: initData.length,
    ...meta,
  });

  if (!token) {
    console.warn("[tg-auth] server:auth-bot-token-denied", {
      reason: "missing_token",
      ...meta,
    });
    return fail("Не удалось подтвердить вход через бота.", 401);
  }

  // Если в Mini App пришёл подписанный initData — это надёжный источник
  // identity текущего Telegram-юзера. Сверим его с владельцем токена,
  // чтобы пересланная ссылка с чужим loginToken не открывала чужую сессию.
  let verifiedIncomingTelegramId: string | null = null;
  if (initData) {
    const inspection = inspectTelegramInitData(initData);
    if (!inspection.ok) {
      console.warn("[tg-auth] server:auth-bot-token-denied", {
        reason: "init_data_invalid",
        inspectionReason: inspection.reason,
        ...meta,
      });
      return fail("Ссылка входа недействительна.", 401);
    }
    verifiedIncomingTelegramId = String(inspection.user.id);
  }

  try {
    // Сначала смотрим токен, проверяем владельца. Только если совпадает —
    // помечаем как использованный и создаём сессию. Если не совпадает —
    // токен НЕ сжигаем, чтобы у настоящего владельца ссылка осталась рабочей.
    const existing = await prisma.botLoginToken.findUnique({ where: { token } });

    if (!existing) {
      console.warn("[tg-auth] server:auth-bot-token-denied", {
        reason: "not_found",
        ...meta,
      });
      return fail("Ссылка входа устарела. Отправьте боту /start ещё раз.", 401);
    }

    if (verifiedIncomingTelegramId && existing.telegramId !== verifiedIncomingTelegramId) {
      console.warn("[tg-auth] server:auth-bot-token-denied", {
        reason: "telegram_mismatch",
        tokenTelegramId: existing.telegramId,
        incomingTelegramId: verifiedIncomingTelegramId,
        ...meta,
      });
      return fail(
        "Эта ссылка для другого Telegram-аккаунта. Отправьте боту /start со своего.",
        401,
      );
    }

    if (existing.usedAt) {
      console.warn("[tg-auth] server:auth-bot-token-denied", {
        reason: "already_used",
        telegramId: existing.telegramId,
        usedAt: existing.usedAt.toISOString(),
        ...meta,
      });
      return fail("Ссылка входа уже использована.", 401);
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      console.warn("[tg-auth] server:auth-bot-token-denied", {
        reason: "expired",
        telegramId: existing.telegramId,
        expiresAt: existing.expiresAt.toISOString(),
        ...meta,
      });
      return fail("Ссылка входа устарела. Отправьте боту /start ещё раз.", 401);
    }

    // Atomically claim the token: only one concurrent caller can flip usedAt from null.
    const claimed = await prisma.botLoginToken.updateMany({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (claimed.count === 0) {
      console.warn("[tg-auth] server:auth-bot-token-denied", {
        reason: "race_lost",
        telegramId: existing.telegramId,
        ...meta,
      });
      return fail("Ссылка входа устарела. Отправьте боту /start ещё раз.", 401);
    }

    const loginToken = await prisma.botLoginToken.findUniqueOrThrow({ where: { token } });

    const user = await prisma.user.upsert({
      where: { telegramId: loginToken.telegramId },
      update: {
        ...(loginToken.username ? { username: loginToken.username } : {}),
        lastActiveAt: new Date(),
      },
      create: {
        telegramId: loginToken.telegramId,
        username: loginToken.username,
        firstName: loginToken.firstName,
        lastName: loginToken.lastName,
      },
    });

    const sessionToken = await createSessionToken({
      userId: user.id,
      telegramId: user.telegramId,
    });

    await setSessionCookie(sessionToken);

    tgDebug("server:auth-bot-token-success", {
      userId: user.id,
      telegramId: user.telegramId,
      onboardingCompleted: user.isOnboardingCompleted,
      hasUsername: Boolean(user.username),
      ...meta,
    });

    return ok({ user });
  } catch (error) {
    console.error("[tg-auth] server:auth-bot-token-failed", {
      message: error instanceof Error ? error.message : "unknown error",
      stack: error instanceof Error ? error.stack : null,
      ...meta,
    });

    return fail("Не удалось выполнить вход через бота.", 500);
  }
}
