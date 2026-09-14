import { fail, ok } from "@/lib/api";
import { getAppAccessState, getCurrentUserRecord } from "@/lib/auth/app-access";
import { inspectTelegramInitData } from "@/lib/auth/telegram";
import { tgDebug } from "@/lib/log";
import {
  getProfileCompletionScore,
  resolveOnboardingCompleted,
} from "@/lib/profile-completion";

function sanitizeUrlForAuthLog(value: string) {
  return value.replace(/([?&](?:loginToken|token)=)[^&#]+/g, "$1<hidden>");
}

function isTelegramLikeUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("telegram-android") ||
    ua.includes("telegram-ios") ||
    ua.includes("telegramios") ||
    ua.includes("tgwebview")
  );
}

export async function GET(request: Request) {
  const initData = request.headers.get("x-telegram-init-data") ?? "";
  const record = await getCurrentUserRecord();
  const access = await getAppAccessState();
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const referer = request.headers.get("referer") ?? "unknown";
  const baseLogPayload = {
    userAgent,
    referer: sanitizeUrlForAuthLog(referer),
    refererHasLoginToken: referer.includes("loginToken="),
    origin: request.headers.get("origin") ?? null,
    forwardedFor: request.headers.get("x-forwarded-for") ?? null,
    realIp: request.headers.get("x-real-ip") ?? null,
    forwardedHost: request.headers.get("x-forwarded-host") ?? null,
    forwardedProto: request.headers.get("x-forwarded-proto") ?? null,
    dublerClient: request.headers.get("x-dubler-client") ?? null,
    isTelegramLikeUserAgent: isTelegramLikeUserAgent(userAgent),
    cookiePresent: Boolean(request.headers.get("cookie")),
    initDataLength: initData.length,
  };
  const shouldLogVerboseAuthMe =
    baseLogPayload.refererHasLoginToken ||
    baseLogPayload.isTelegramLikeUserAgent ||
    baseLogPayload.dublerClient === "telegram-mini-app" ||
    initData.length === 0;

  if (shouldLogVerboseAuthMe) {
    console.info("[tg-auth] auth/me start", {
      hasSession: Boolean(record?.session),
      sessionUserId: record?.session.userId ?? null,
      sessionTelegramId: record?.session.telegramId ?? null,
      accessKind: access.kind,
      ...baseLogPayload,
    });
  }

  tgDebug("server:auth-me-start", {
    hasSession: Boolean(record?.session),
    sessionUserId: record?.session.userId ?? null,
    sessionTelegramId: record?.session.telegramId ?? null,
    ...baseLogPayload,
  });

  if (!record || access.kind === "guest") {
    console.warn("[tg-auth] auth/me no-session", baseLogPayload);
    return fail("Сессия не найдена.", 401);
  }

  const session = record.session;

  const inspection = inspectTelegramInitData(initData);

  tgDebug("server:auth-me-inspection", {
    inspectionOk: inspection.ok,
    inspectionReason: inspection.ok ? null : inspection.reason,
    authDate: inspection.ok ? inspection.authDate : inspection.authDate,
    incomingTelegramId: inspection.ok ? String(inspection.user.id) : null,
    sessionUserId: session.userId,
    sessionTelegramId: session.telegramId,
    ...baseLogPayload,
  });

  if (shouldLogVerboseAuthMe) {
    console.info("[tg-auth] auth/me inspection", {
      inspectionOk: inspection.ok,
      inspectionReason: inspection.ok ? null : inspection.reason,
      authDate: inspection.ok ? inspection.authDate : inspection.authDate,
      incomingTelegramId: inspection.ok ? String(inspection.user.id) : null,
      sessionUserId: session.userId,
      sessionTelegramId: session.telegramId,
      ...baseLogPayload,
    });
  }

  try {
    const user = record.user;

    if (inspection.ok) {
      const incomingTelegramId = String(inspection.user.id);

      if (incomingTelegramId !== user.telegramId) {
        console.warn("[tg-auth] auth/me telegram-mismatch", {
          sessionUserId: user.id,
          sessionTelegramId: user.telegramId,
          incomingTelegramId,
          ...baseLogPayload,
        });

        tgDebug("server:auth-me-telegram-mismatch", {
          dbUserId: user.id,
          dbTelegramId: user.telegramId,
          sessionTelegramId: session.telegramId,
          incomingTelegramId,
          ...baseLogPayload,
        });

        return fail("Сессия принадлежит другому Telegram-аккаунту.", 401);
      }
    } else {
      // Запрос пришёл из Telegram-клиента (Android/iOS WebView), но initData
      // не был прислан. На Android cookies шарятся между аккаунтами, поэтому
      // нельзя доверять старой cookie без проверки identity. Заставим клиент
      // переавторизоваться через initData.
      const ua = baseLogPayload.userAgent.toLowerCase();
      const isTelegramWebView =
        ua.includes("telegram-android") ||
        ua.includes("telegram-ios") ||
        ua.includes("telegramios") ||
        ua.includes("tgwebview");

      if (isTelegramWebView) {
        console.warn("[tg-auth] auth/me telegram-init-data-required", {
          sessionUserId: user.id,
          sessionTelegramId: user.telegramId,
          inspectionReason: inspection.reason,
          ...baseLogPayload,
        });

        tgDebug("server:auth-me-init-data-required", {
          dbUserId: user.id,
          dbTelegramId: user.telegramId,
          sessionTelegramId: session.telegramId,
          inspectionReason: inspection.reason,
          ...baseLogPayload,
        });

        return fail("Нужна свежая авторизация Telegram.", 401);
      }
    }

    const roles = user.roles.map((role) => role.role);
    const employerVerificationStatus =
      user.verifications.find((verification) => verification.type === "EMPLOYER_PVZ")?.status ??
      null;
    const onboardingCompleted = resolveOnboardingCompleted(user);
    const profileCompletion = getProfileCompletionScore(user);
    const bannedProfile =
      access.kind === "banned"
        ? {
            id: access.user.id,
            firstName: access.user.firstName,
            lastName: access.user.lastName,
            photoUrl: access.user.photoUrl,
            cityName: access.user.cityName,
            district: access.user.district,
            banReason: access.user.banReason,
            bannedAt: access.user.bannedAt,
          }
        : null;

    console.info("[tg-auth] auth/me success", {
      userId: user.id,
      telegramId: user.telegramId,
      isBanned: user.isBanned,
      onboardingCompleted,
      profileCompletion,
      roles,
      ...baseLogPayload,
    });

    tgDebug("server:auth-me-success", {
      userId: user.id,
      telegramId: user.telegramId,
      isBanned: user.isBanned,
      onboardingCompleted,
      profileCompletion,
      roles,
      ...baseLogPayload,
    });

    return ok({
      roles,
      employerVerificationStatus,
      isBanned: user.isBanned,
      bannedProfile,
      onboardingCompleted,
    });
  } catch (error) {
    console.error("[tg-auth] auth/me failed", {
      message: error instanceof Error ? error.message : "unknown error",
      ...baseLogPayload,
    });

    tgDebug("server:auth-me-failed", {
      message: error instanceof Error ? error.message : "unknown error",
      stack: error instanceof Error ? error.stack : null,
      sessionUserId: session.userId,
      sessionTelegramId: session.telegramId,
      ...baseLogPayload,
    });

    return fail("Не удалось получить профиль.", 500);
  }
}
