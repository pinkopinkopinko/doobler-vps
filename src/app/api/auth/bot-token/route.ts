import { createHash } from "crypto";

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { inspectTelegramInitData } from "@/lib/auth/telegram";
import { tgDebug } from "@/lib/log";
import { prisma } from "@/lib/prisma";

function sanitizeUrlForAuthLog(value: string) {
  return value
    .replace(/([?&](?:loginToken|token)=)[^&#]+/g, "$1<hidden>")
    .replace(/([?&]tgWebAppData=)[^&#]+/g, "$1<hidden>")
    .replace(/#tgWebAppData=.*$/g, "#<hidden>");
}

function getTokenFingerprint(token: string) {
  if (!token) {
    return null;
  }

  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

function dateToLog(value: unknown) {
  return value instanceof Date ? value.toISOString() : null;
}

function getClientMeta(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const referer = request.headers.get("referer") ?? "unknown";
  const ua = userAgent.toLowerCase();

  return {
    userAgent,
    referer: sanitizeUrlForAuthLog(referer),
    refererHasLoginToken: referer.includes("loginToken="),
    origin: request.headers.get("origin") ?? null,
    forwardedFor: request.headers.get("x-forwarded-for") ?? null,
    realIp: request.headers.get("x-real-ip") ?? null,
    forwardedHost: request.headers.get("x-forwarded-host") ?? null,
    forwardedProto: request.headers.get("x-forwarded-proto") ?? null,
    dublerClient: request.headers.get("x-dubler-client") ?? null,
    isTelegramLikeUserAgent:
      ua.includes("telegram-android") ||
      ua.includes("telegram-ios") ||
      ua.includes("telegramios") ||
      ua.includes("tgwebview"),
  };
}

function getBotTokenLogMeta(token: string, initData: string) {
  return {
    tokenPresent: Boolean(token),
    tokenLength: token.length,
    tokenFingerprint: getTokenFingerprint(token),
    hasInitData: Boolean(initData),
    initDataLength: initData.length,
  };
}

function getSafeRedirectTarget(value: string | null) {
  const target = value?.trim() || "/telegram/shifts";
  if (!target.startsWith("/") || target.startsWith("//")) {
    return "/telegram/shifts";
  }
  return target;
}

async function redeemBotLoginToken({
  token,
  initData,
  request,
}: {
  token: string;
  initData: string;
  request: NextRequest;
}) {
  const meta = getClientMeta(request);
  const tokenLogMeta = getBotTokenLogMeta(token, initData);
  const authLogMeta = { ...tokenLogMeta, ...meta };
  const startedAt = Date.now();

  console.info("[tg-auth] server:auth-bot-token-start", authLogMeta);

  tgDebug("server:auth-bot-token-start", authLogMeta);

  if (!token) {
    console.warn("[tg-auth] server:auth-bot-token-denied", {
      reason: "missing_token",
      ...authLogMeta,
    });
    return { ok: false as const, response: fail("Не удалось подтвердить вход через бота.", 401) };
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
        ...authLogMeta,
      });
      return { ok: false as const, response: fail("Ссылка входа недействительна.", 401) };
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
        ...authLogMeta,
      });
      return {
        ok: false as const,
        response: fail("Ссылка входа устарела. Отправьте боту /start ещё раз.", 401),
      };
    }

    console.info("[tg-auth] server:auth-bot-token-found", {
      tokenTelegramId: existing.telegramId,
      tokenCreatedAt: dateToLog(existing.createdAt),
      tokenExpiresAt: dateToLog(existing.expiresAt),
      tokenPreviouslyUsed: Boolean(existing.usedAt),
      tokenUsedAt: dateToLog(existing.usedAt),
      verifiedIncomingTelegramId,
      tokenAgeMs: existing.createdAt instanceof Date ? Date.now() - existing.createdAt.getTime() : null,
      ...authLogMeta,
    });

    if (verifiedIncomingTelegramId && existing.telegramId !== verifiedIncomingTelegramId) {
      console.warn("[tg-auth] server:auth-bot-token-denied", {
        reason: "telegram_mismatch",
        tokenTelegramId: existing.telegramId,
        incomingTelegramId: verifiedIncomingTelegramId,
        ...authLogMeta,
      });
      return {
        ok: false as const,
        response: fail(
          "Эта ссылка для другого Telegram-аккаунта. Отправьте боту /start со своего.",
          401,
        ),
      };
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      console.warn("[tg-auth] server:auth-bot-token-denied", {
        reason: "expired",
        telegramId: existing.telegramId,
        expiresAt: existing.expiresAt.toISOString(),
        ...authLogMeta,
      });
      return {
        ok: false as const,
        response: fail("Ссылка входа устарела. Отправьте боту /start ещё раз.", 401),
      };
    }

    // The bot login link is valid until expiresAt. Keep usedAt as last-use telemetry,
    // not as a single-use burn flag: Telegram clients may open the same button twice.
    const claimed = await prisma.botLoginToken.updateMany({
      where: {
        token,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (claimed.count === 0) {
      console.warn("[tg-auth] server:auth-bot-token-denied", {
        reason: "expired_during_claim",
        telegramId: existing.telegramId,
        ...authLogMeta,
      });
      return {
        ok: false as const,
        response: fail("Ссылка входа устарела. Отправьте боту /start ещё раз.", 401),
      };
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

    const successLogPayload = {
      userId: user.id,
      telegramId: user.telegramId,
      onboardingCompleted: user.isOnboardingCompleted,
      hasUsername: Boolean(user.username),
      tokenTelegramId: loginToken.telegramId,
      tokenExpiresAt: dateToLog(loginToken.expiresAt),
      tokenUsedAt: dateToLog(loginToken.usedAt),
      durationMs: Date.now() - startedAt,
      ...authLogMeta,
    };

    console.info("[tg-auth] server:auth-bot-token-success", successLogPayload);

    tgDebug("server:auth-bot-token-success", successLogPayload);

    return { ok: true as const, user, response: ok({ user }) };
  } catch (error) {
    console.error("[tg-auth] server:auth-bot-token-failed", {
      message: error instanceof Error ? error.message : "unknown error",
      stack: error instanceof Error ? error.stack : null,
      durationMs: Date.now() - startedAt,
      ...authLogMeta,
    });

    return { ok: false as const, response: fail("Не удалось выполнить вход через бота.", 500) };
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const redirectTarget = getSafeRedirectTarget(request.nextUrl.searchParams.get("redirect"));
  const result = await redeemBotLoginToken({ token, initData: "", request });
  const redirectUrl = new URL(redirectTarget, request.url);

  if (!result.ok) {
    redirectUrl.searchParams.set("authError", "bot-token");
  }

  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { token?: string; initData?: string }
    | null;
  const token = body?.token?.trim() ?? "";
  const initData = body?.initData ?? "";
  const result = await redeemBotLoginToken({ token, initData, request });
  return result.response;
}
