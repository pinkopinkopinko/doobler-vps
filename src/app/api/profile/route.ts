import { ZodError } from "zod";

import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import {
  getProfileCompletionScore,
  resolveOnboardingCompleted,
} from "@/lib/profile-completion";
import { prisma } from "@/lib/prisma";
import { getProfile, updateProfile } from "@/server/services/profile-service";

export async function GET(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { searchParams } = new URL(request.url);

  if (searchParams.get("view") === "location") {
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
      },
    });

    return ok({
      profile: profile
        ? {
            regionId: profile.regionId,
            cityId: profile.cityId,
            roles: profile.roles.map((role) => role.role),
          }
        : null,
      onboardingCompleted: Boolean(profile?.cityId),
      profileCompletion: profile?.cityId ? 1 : 0,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Некорректный формат запроса.", 400);
  }

  try {
    const profile = await updateProfile(session.userId, body);
    return ok({
      profile,
      onboardingCompleted: resolveOnboardingCompleted(profile),
      profileCompletion: getProfileCompletionScore(profile),
    });
  } catch (error) {
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
