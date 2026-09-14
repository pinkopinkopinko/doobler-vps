import { cache } from "react";

import { AssignmentStatus } from "@/generated/prisma/client";
import { getCurrentUserRecord } from "@/lib/auth/app-access";
import { invalidateCachedUserRecord } from "@/lib/cache/user-record-cache";
import { compactProfilePhotoUrl, validateProfilePhotoUrl } from "@/lib/profile-photo";
import { calculateShiftAttendance } from "@/lib/shift-attendance";
import type { AppRole, ProfileView } from "@/lib/types";
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
  balanceRub: true,
  bio: true,
  phone: true,
  isPhoneVerified: true,
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
    take: 8,
    select: {
      status: true,
      type: true,
    },
  },
} as const;

const profileFullSelect = {
  ...profileShellSelect,
  workerAssignments: {
    where: {
      status: {
        in: [
          AssignmentStatus.COMPLETED,
          AssignmentStatus.NO_SHOW,
          AssignmentStatus.CANCELLED,
        ],
      },
    },
    select: {
      status: true,
      application: {
        select: {
          status: true,
        },
      },
    },
  },
  receivedReviews: {
    include: { author: true },
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
};

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
    balanceRub?: number;
    bio: string | null;
    phone: string | null;
    isPhoneVerified: boolean;
    roles: Array<{ role: ProfileView["roles"][number] }>;
    city: { name: string } | null;
    verifications: Array<{
      status: ProfileView["verificationStatus"];
      type: "WORKER_ID" | "SELFIE" | "EMPLOYER_PVZ" | "MANUAL";
    }>;
  },
  options?: { compactPhoto?: boolean },
) {
  const roles = user.roles.map((role) => role.role);
  const photoUrl = options?.compactPhoto ? compactProfilePhotoUrl(user.photoUrl) : user.photoUrl;
  const employerVerificationStatus =
    user.verifications.find((verification) => verification.type === "EMPLOYER_PVZ")?.status ??
    null;

  return {
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName,
    age: user.age,
    username: user.username,
    photoUrl,
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
    balanceRub: user.balanceRub ?? 0,
    verificationStatus: user.verifications[0]?.status ?? "PENDING",
    employerVerificationStatus,
    bio: user.bio,
    phone: user.phone,
    isPhoneVerified: user.isPhoneVerified,
  };
}

function buildBadges(
  profile: Pick<ProfileView, "verificationStatus" | "completedAssignmentsCount" | "isPhoneVerified">,
) {
  return [
    profile.verificationStatus === "APPROVED"
      ? "Проверенный профиль"
      : "Без верификации",
    `${profile.completedAssignmentsCount} завершённых смен`,
  ];
}

function withPhoneBadge(
  profile: Pick<ProfileView, "isPhoneVerified">,
  badges: string[],
) {
  if (!profile.isPhoneVerified) {
    return badges;
  }

  return [badges[0] ?? "Профиль", "Номер телефона подтверждён", ...badges.slice(1)];
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
      const profile = mapProfileBase(cachedRecord.user, { compactPhoto: true });
      return {
        ...profile,
        shiftAttendance: null,
        badges: withPhoneBadge(profile, buildBadges(profile)),
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

    const profile = mapProfileBase(user, { compactPhoto: true });

    return {
      ...profile,
      shiftAttendance: null,
      badges: withPhoneBadge(profile, buildBadges(profile)),
      recentReviews: [],
    };
  } catch (error) {
    // КРИТИЧНО: НЕ подставлять demoProfile (это «Игорь Панов»), иначе под любым
    // юзером будет светиться чужой профиль. Лучше вернуть null и дать UI
    // нормально среагировать (notFound / 401 / повторить запрос).
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[profile-service] getProfileShell failed for user ${userId}: ${message}`,
      error,
    );
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
      shiftAttendance: calculateShiftAttendance(
        user.workerAssignments.map((assignment) => ({
          status: assignment.status,
          applicationStatus: assignment.application.status,
        })),
      ),
      badges: withPhoneBadge(profile, buildBadges(profile)),
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
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[profile-service] getProfile failed for user ${userId}: ${message}`,
      error,
    );
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
    const nextRoles = new Set<AppRole>(data.roles);

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

    // Профиль/роли изменились — сбрасываем in-memory кеш User-record'а,
    // чтобы (app)/layout и pages сразу увидели новые данные, а не ждали
    // TTL. Иначе после "Сохранить" юзер до 30 сек видит старое имя/город.
    await invalidateCachedUserRecord(userId);

    return getProfile(userId);
  } catch (error) {
    console.error("[profile-service] updateProfile failed", {
      userId,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
