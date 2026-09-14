import { ZodError } from "zod";

import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import {
  getProfileCompletionScore,
  resolveOnboardingCompleted,
} from "@/lib/profile-completion";
import { prisma } from "@/lib/prisma";
import { getProfile, updateProfile } from "@/server/services/profile-service";
import {
  ConsentRequiredError,
  OfferAcceptanceRequiredError,
  requireActiveConsent,
  requireCurrentOfferAcceptance,
} from "@/server/services/legal-consent-service";

export async function GET(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");

  if (view === "location") {
    const profile = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        regionId: true,
        cityId: true,
        roles: {
          select: {
            role: true,
          },
        },
        balanceRub: true,
        verifications: {
          where: { type: "EMPLOYER_PVZ" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
          },
        },
      },
    });

    return ok({
      profile: profile
        ? {
            regionId: profile.regionId,
            cityId: profile.cityId,
            roles: profile.roles.map((role) => role.role),
            balanceRub: profile.balanceRub,
            employerVerificationStatus: profile.verifications[0]?.status ?? null,
          }
        : null,
      onboardingCompleted: Boolean(profile?.cityId),
      profileCompletion: profile?.cityId ? 1 : 0,
    });
  }

  if (view === "phone-status") {
    // Горячий poll-эндпоинт — `phone-verification-panel` тикает раз в
    // несколько секунд, пока юзер делится контактом через бота. Раньше
    // звали `getCurrentUserRecord()` с тяжёлым `accessUserSelect`
    // (roles + verifications + identityVerifications + city). Тут нужен
    // ровно один булеан — узкий SELECT по уникальному PK дешевле в разы.
    const profile = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isPhoneVerified: true },
    });
    return ok({
      profile: profile
        ? {
            isPhoneVerified: profile.isPhoneVerified,
          }
        : null,
    });
  }

  if (view === "editor") {
    const profile = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        firstName: true,
        lastName: true,
        age: true,
        photoUrl: true,
        experienceSummary: true,
        regionId: true,
        cityId: true,
        marketplaces: true,
        roles: {
          select: {
            role: true,
          },
        },
        verifications: {
          where: { type: "EMPLOYER_PVZ" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
          },
        },
      },
    });

    return ok({
      profile: profile
        ? {
            firstName: profile.firstName,
            lastName: profile.lastName,
            age: profile.age,
            photoUrl: profile.photoUrl,
            experienceSummary: profile.experienceSummary,
            regionId: profile.regionId,
            cityId: profile.cityId,
            roles: profile.roles.map((role) => role.role),
            marketplaces: profile.marketplaces,
            employerVerificationStatus: profile.verifications[0]?.status ?? null,
          }
        : null,
      onboardingCompleted: resolveOnboardingCompleted(profile),
      profileCompletion: getProfileCompletionScore(profile),
    });
  }

  const profile = await getProfile(session.userId);
  return ok({
    profile,
    onboardingCompleted: resolveOnboardingCompleted(profile),
    profileCompletion: getProfileCompletionScore(profile),
  });
}

export async function PATCH(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Некорректный формат запроса.", 400);
  }

  try {
    await requireActiveConsent(session.userId, "PERSONAL_DATA_PROCESSING");
    const existingProfile = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { cityId: true },
    });

    if (!existingProfile?.cityId) {
      await requireCurrentOfferAcceptance(session.userId);
      await requireActiveConsent(session.userId, "PUBLIC_PROFILE_DISTRIBUTION");
    }

    const profile = await updateProfile(session.userId, body);
    return ok({
      profile,
      onboardingCompleted: resolveOnboardingCompleted(profile),
      profileCompletion: getProfileCompletionScore(profile),
    });
  } catch (error) {
    if (error instanceof ConsentRequiredError) {
      return fail(error.message, 409);
    }
    if (error instanceof OfferAcceptanceRequiredError) {
      return fail(error.message, 409);
    }
    if (error instanceof ZodError) {
      return fail(error.issues[0]?.message ?? "Проверьте поля профиля.", 400);
    }
    // updateProfile бросает Error с человекочитаемым messageом для magic-byte
    // и прочих доменных проверок (см. profile-service.updateProfile).
    if (error instanceof Error && error.message) {
      return fail(error.message, 400);
    }
    console.error("[profile] update failed", error);
    return fail("Не удалось сохранить профиль.", 500);
  }
}
