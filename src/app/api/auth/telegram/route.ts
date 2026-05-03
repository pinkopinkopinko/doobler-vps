import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { isDevFallbackEnabled } from "@/lib/dev-fallback";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import {
  getDevelopmentTelegramUser,
  inspectTelegramInitData,
} from "@/lib/auth/telegram";
import { tgDebug } from "@/lib/log";
import { prisma } from "@/lib/prisma";

function allowDevAuthFallback() {
  return isDevFallbackEnabled("auth");
}

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
  const body = (await request.json().catch(() => null)) as { initData?: string } | null;
  const initData = body?.initData ?? "";
  const inspection = inspectTelegramInitData(initData);
  const fallbackUser = allowDevAuthFallback() ? getDevelopmentTelegramUser() : null;
  const telegramUser = inspection.ok ? inspection.user : fallbackUser;
  const meta = getClientMeta(request);

  tgDebug("server:auth-telegram-start", {
    initDataLength: inspection.initDataLength,
    inspectionOk: inspection.ok,
    inspectionReason: inspection.ok ? null : inspection.reason,
    authDate: inspection.ok ? inspection.authDate : inspection.authDate,
    telegramUserId: telegramUser?.id ? String(telegramUser.id) : null,
    hasUsername: Boolean(telegramUser?.username),
    usedDevFallbackCandidate: !inspection.ok && Boolean(fallbackUser),
    ...meta,
  });

  if (!telegramUser) {
    const logPayload = {
      reason: inspection.ok ? "unknown" : inspection.reason,
      initDataLength: inspection.initDataLength,
      authDate: inspection.ok ? inspection.authDate : inspection.authDate,
      ...meta,
    };

    if (inspection.initDataLength === 0) {
      console.info("[tg-auth] auth/telegram skipped", logPayload);
    } else {
      console.warn("[tg-auth] auth/telegram denied", logPayload);
    }

    tgDebug("server:auth-telegram-denied", logPayload);

    return fail("Не удалось подтвердить вход через Telegram.", 401);
  }

  try {
    // ВАЖНО: на повторный логин НЕ затираем firstName/lastName/photoUrl —
    // их пользователь редактирует в форме профиля, и затирание данными из
    // Telegram сбрасывало бы профиль на каждом /start. Обновляем только
    // username (его в форме нельзя поменять — только Telegram) и активность.
    const user = await prisma.user.upsert({
      where: { telegramId: String(telegramUser.id) },
      update: {
        username: telegramUser.username ?? null,
        lastActiveAt: new Date(),
      },
      create: {
        telegramId: String(telegramUser.id),
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name ?? null,
        username: telegramUser.username ?? null,
        photoUrl: telegramUser.photo_url ?? null,
      },
    });

    const sessionToken = await createSessionToken({
      userId: user.id,
      telegramId: user.telegramId,
    });

    await setSessionCookie(sessionToken);

    console.info("[tg-auth] auth/telegram success", {
      telegramId: user.telegramId,
      userId: user.id,
      usedDevFallback: !inspection.ok && Boolean(fallbackUser),
      inspection: inspection.ok
        ? {
            ok: true,
            initDataLength: inspection.initDataLength,
            authDate: inspection.authDate,
          }
        : {
            ok: false,
            reason: inspection.reason,
            initDataLength: inspection.initDataLength,
            authDate: inspection.authDate,
          },
      onboardingCompleted: user.isOnboardingCompleted,
      ...meta,
    });

    tgDebug("server:auth-telegram-success", {
      telegramId: user.telegramId,
      userId: user.id,
      onboardingCompleted: user.isOnboardingCompleted,
      hasUsername: Boolean(user.username),
      hasPhoto: Boolean(user.photoUrl),
      ...meta,
    });

    return ok({ user });
  } catch (error) {
    console.error("[tg-auth] auth/telegram failed", {
      message: error instanceof Error ? error.message : "unknown error",
      usedDemoProfile: false,
      ...meta,
    });

    tgDebug("server:auth-telegram-failed", {
      message: error instanceof Error ? error.message : "unknown error",
      stack: error instanceof Error ? error.stack : null,
      telegramUserId: telegramUser?.id ? String(telegramUser.id) : null,
      ...meta,
    });

    return fail("Не удалось выполнить вход через Telegram.", 500);
  }
}
