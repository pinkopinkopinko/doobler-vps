import { cache } from "react";

import { getCurrentUserRecord } from "@/lib/auth/app-access";
import { demoProfile } from "@/lib/demo-data";
import { validateProfilePhotoUrl } from "@/lib/profile-photo";
import type { ProfileView } from "@/lib/types";
import { isProfileComplete } from "@/lib/profile-completion";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validations/shift-post";

const profileShellSelect = {
  id: true,
  telegramId: true,
  firstName: true,
  lastName: true,
  age: true,
  username: true,
  photoUrl: true,
  pickupPointCode: true,
  experienceSummary: true,
  isOnboardingCompleted: true,
  regionId: true,
  cityId: true,
  district: true,
  marketplaces: true,
  ratingAvg: true,
  ratingCount: true,
  completedAssignmentsCount: true,
  bio: true,
  phone: true,
  roles: {
    select: {
      role: true,
    },
  },
  city: {
    select: {
      name: true,
    },
  },
  verifications: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

const profileFullSelect = {
  ...profileShellSelect,
  receivedReviews: {
    include: { author: true },
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
} as const;

function mapProfileBase(
  user: {
    id: string;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    age: number | null;
    username: string | null;
    photoUrl: string | null;
    pickupPointCode: string | null;
    experienceSummary: string | null;
    isOnboardingCompleted: boolean;
    regionId: string | null;
    cityId: string | null;
    district: string | null;
    marketplaces: ProfileView["marketplaces"];
    ratingAvg: number;
    ratingCount: number;
    completedAssignmentsCount: number;
    bio: string | null;
    phone: string | null;
    roles: Array<{ role: ProfileView["roles"][number] }>;
    city: { name: string } | null;
    verifications: Array<{ status: ProfileView["verificationStatus"] }>;
  },
) {
  const roles = user.roles.map((role) => role.role);

  return {
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName,
    age: user.age,
    username: user.username,
    photoUrl: user.photoUrl,
    pickupPointCode: user.pickupPointCode,
    experienceSummary: user.experienceSummary,
    isOnboardingCompleted: user.isOnboardingCompleted,
    regionId: user.regionId,
    cityId: user.cityId,
    cityName: user.city?.name ?? "Не указан",
    district: user.district,
    roles,
    marketplaces: user.marketplaces,
    ratingAvg: user.ratingAvg,
    ratingCount: user.ratingCount,
    completedAssignmentsCount: user.completedAssignmentsCount,
    verificationStatus: user.verifications[0]?.status ?? "PENDING",
    bio: user.bio,
    phone: user.phone,
  };
}

function buildBadges(profile: Pick<ProfileView, "verificationStatus" | "completedAssignmentsCount">) {
  return [
    profile.verificationStatus === "APPROVED"
      ? "Проверенный профиль"
      : "Без верификации",
    `${profile.completedAssignmentsCount} завершённых смен`,
  ];
}

/**
 * Прячет приватные поля (телефон) при просмотре чужого профиля.
 * Свой профиль возвращается как есть. Используется на public-эндпоинтах
 * `/api/profile/[userId]` и в SSR-странице `/profiles/[userId]`, чтобы
 * номер телефона не утекал между пользователями.
 */
export function redactProfileForViewer(
  profile: ProfileView,
  viewerUserId: string | null | undefined,
): ProfileView {
  if (viewerUserId && viewerUserId === profile.id) {
    return profile;
  }

  return {
    ...profile,
    phone: null,
  };
}

export const getProfileShell = cache(async (userId: string): Promise<ProfileView | null> => {
  try {
    // Если запрашивают shell текущего пользователя — переиспользуем кэшированный
    // User record из getAppAccessState (он же используется banned-screen guard'ом
    // в (app)/layout). Это убирает второй SQL-запрос на каждой странице Mini App.
    const cachedRecord = await getCurrentUserRecord();
    if (cachedRecord && cachedRecord.session.userId === userId) {
      const profile = mapProfileBase(cachedRecord.user);
      return {
        ...profile,
        badges: buildBadges(profile),
        recentReviews: [],
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileShellSelect,
    });

    if (!user) {
      return null;
    }

    const profile = mapProfileBase(user);

    return {
      ...profile,
      badges: buildBadges(profile),
      recentReviews: [],
    };
  } catch (error) {
    // КРИТИЧНО: НЕ подставлять demoProfile (это «Игорь Панов»), иначе под любым
    // юзером будет светиться чужой профиль. Лучше вернуть null и дать UI
    // нормально среагировать (notFound / 401 / повторить запрос).
    console.error("[profile-service] getProfileShell failed", {
      userId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
});

export const getProfile = cache(async (userId: string): Promise<ProfileView | null> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileFullSelect,
    });

    if (!user) {
      return null;
    }

    const profile = mapProfileBase(user);

    return {
      ...profile,
      badges: buildBadges(profile),
      recentReviews: user.receivedReviews.map((review) => ({
        id: review.id,
        authorName: `${review.author.firstName} ${review.author.lastName ?? ""}`.trim(),
        rating: review.rating,
        text: review.text,
        createdAt: review.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    // НЕ подставляем demoProfile: это приводило к тому, что любой юзер при
    // временной ошибке БД видел чужие данные. Лучше null, чем чужой профиль.
    console.error("[profile-service] getProfile failed", {
      userId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
});

export async function updateProfile(userId: string, input: unknown) {
  const data = profileSchema.parse(input);

  // Финальная проверка аватарки: magic-bytes должны совпадать с заявленным
  // MIME, иначе клиент пытался подсунуть SVG/HTML/прочее под видом картинки.
  // Бросаем как Zod-подобную ошибку, чтобы наверху она поднималась
  // одинаково с прочей валидацией формы.
  const photoCheck = validateProfilePhotoUrl(data.photoUrl);
  if (!photoCheck.ok) {
    const reasonMessage = {
      format_mismatch: "Содержимое фото не соответствует JPEG / PNG / WebP.",
      decode_failed: "Не удалось прочитать содержимое фото.",
      too_large: "Фото должно быть меньше 2 МБ после декодирования.",
    }[photoCheck.reason];
    throw new Error(reasonMessage);
  }

  const onboardingCompleted = isProfileComplete({
    ...data,
    isOnboardingCompleted: true,
  });

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        roles: {
          select: {
            role: true,
          },
        },
      },
    });

    const existingRoles = existingUser?.roles.map((role) => role.role) ?? [];
    const nextRoles = new Set(data.roles);

    if (existingRoles.includes("MANAGER")) {
      nextRoles.add("MANAGER");
    }

    if (existingRoles.includes("MODERATOR")) {
      nextRoles.add("MODERATOR");
    }

    if (data.roles.includes("EMPLOYEE") && existingRoles.includes("TEMP_WORKER")) {
      nextRoles.add("TEMP_WORKER");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName ?? null,
          age: data.age ?? null,
          // Telegram username должен жить от Telegram auth, а не затираться формой профиля.
          username:
            typeof data.username === "string" && data.username.trim().length > 0
              ? data.username.trim()
              : (existingUser?.username ?? undefined),
          photoUrl: data.photoUrl ?? null,
          pickupPointCode: data.pickupPointCode ?? null,
          experienceSummary: data.experienceSummary ?? null,
          bio: data.bio ?? null,
          cityId: data.cityId,
          regionId: data.regionId,
          district: data.district ?? null,
          marketplaces: data.marketplaces,
          isOnboardingCompleted: onboardingCompleted,
        },
      });

      await tx.userRole.deleteMany({ where: { userId } });

      if (nextRoles.size > 0) {
        await tx.userRole.createMany({
          data: Array.from(nextRoles).map((role) => ({ userId, role })),
        });
      }
    });

    return getProfile(userId);
  } catch {
    return {
      ...demoProfile,
      ...data,
      age: data.age ?? demoProfile.age,
      photoUrl: data.photoUrl ?? demoProfile.photoUrl,
      pickupPointCode: data.pickupPointCode ?? demoProfile.pickupPointCode,
      experienceSummary: data.experienceSummary ?? demoProfile.experienceSummary,
      regionId: data.regionId,
      cityId: data.cityId,
      cityName: demoProfile.cityName,
      badges: demoProfile.badges,
      recentReviews: demoProfile.recentReviews,
      ratingAvg: demoProfile.ratingAvg,
      ratingCount: demoProfile.ratingCount,
      completedAssignmentsCount: demoProfile.completedAssignmentsCount,
      verificationStatus: demoProfile.verificationStatus,
      phone: demoProfile.phone,
      isOnboardingCompleted: onboardingCompleted,
    };
  }
}
