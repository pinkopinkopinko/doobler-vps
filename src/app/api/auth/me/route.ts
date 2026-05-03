import { fail, ok } from "@/lib/api";
import { getAppAccessState, getCurrentUserRecord } from "@/lib/auth/app-access";
import { inspectTelegramInitData } from "@/lib/auth/telegram";
import { tgDebug } from "@/lib/log";
import {
  getProfileCompletionScore,
  resolveOnboardingCompleted,
} from "@/lib/profile-completion";

export async function GET(request: Request) {
  const initData = request.headers.get("x-telegram-init-data") ?? "";
  const record = await getCurrentUserRecord();
  const access = await getAppAccessState();
  const baseLogPayload = {
    userAgent: request.headers.get("user-agent") ?? "unknown",
    referer: request.headers.get("referer") ?? "unknown",
    origin: request.headers.get("origin") ?? null,
    forwardedHost: request.headers.get("x-forwarded-host") ?? null,
    forwardedProto: request.headers.get("x-forwarded-proto") ?? null,
    initDataLength: initData.length,
  };

  tgDebug("server:auth-me-start", {
    hasSession: Boolean(record?.session),
    sessionUserId: record?.session.userId ?? null,
    sessionTelegramId: record?.session.telegramId ?? null,
    ...baseLogPayload,
  });

  if (!record || access.kind === "guest") {
    console.warn("[tg-auth] auth/me no-session", baseLogPayload);
    return fail("РЎРµСЃСЃРёСЏ РЅРµ РЅР°Р№РґРµРЅР°.", 401);
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

        return fail("РЎРµСЃСЃРёСЏ РїСЂРёРЅР°РґР»РµР¶РёС‚ РґСЂСѓРіРѕРјСѓ Telegram-Р°РєРєР°СѓРЅС‚Сѓ.", 401);
      }
    } else {
      // Р—Р°РїСЂРѕСЃ РїСЂРёС€С‘Р» РёР· Telegram-РєР»РёРµРЅС‚Р° (Android/iOS WebView), РЅРѕ initData
      // РЅРµ Р±С‹Р» РїСЂРёСЃР»Р°РЅ. РќР° Android cookies С€Р°СЂСЏС‚СЃСЏ РјРµР¶РґСѓ Р°РєРєР°СѓРЅС‚Р°РјРё, РїРѕСЌС‚РѕРјСѓ
      // РЅРµР»СЊР·СЏ РґРѕРІРµСЂСЏС‚СЊ СЃС‚Р°СЂРѕР№ cookie Р±РµР· РїСЂРѕРІРµСЂРєРё identity. Р—Р°СЃС‚Р°РІРёРј РєР»РёРµРЅС‚
      // РїРµСЂРµР°РІС‚РѕСЂРёР·РѕРІР°С‚СЊСЃСЏ С‡РµСЂРµР· initData.
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

        return fail("РќСѓР¶РЅР° СЃРІРµР¶Р°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ Telegram.", 401);
      }
    }

    const roles = user.roles.map((role) => role.role);
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

    return fail("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РїСЂРѕС„РёР»СЊ.", 500);
  }
}
