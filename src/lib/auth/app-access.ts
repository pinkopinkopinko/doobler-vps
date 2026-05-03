import { cache } from "react";

import { compactProfilePhotoUrl } from "@/lib/profile-photo";
import { getSessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Расширенный select под текущего пользователя — покрывает одновременно
// потребности banned-screen guard'а в (app)/layout и потребности
// profile-shell на home/shifts/posts/profile. Один и тот же запрос
// переиспользуется через cache(), чтобы layout и страница не делали
// два отдельных раунд-трипа в БД на каждой навигации.
const accessUserSelect = {
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
  isPhoneVerified: true,
  isBanned: true,
  banReason: true,
  bannedAt: true,
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
    select: {
      status: true,
    },
  },
} as const;

export type CurrentUserRecord = NonNullable<
  Awaited<ReturnType<typeof loadCurrentUserRecord>>
>;

async function loadCurrentUserRecord() {
  const session = await getSessionPayload();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: accessUserSelect,
  });

  if (!user) {
    return null;
  }

  return { session, user };
}

// Кэшированный fetch текущего пользователя на время одного запроса.
// Используем его и в getAppAccessState (banned-screen в layout), и в
// getProfileShell (home/shifts/profile pages) — оба пути теперь делят
// один SQL-запрос вместо двух.
export const getCurrentUserRecord = cache(loadCurrentUserRecord);

export type AppAccessState =
  | { kind: "guest"; session: null; user: null }
  | {
      kind: "active" | "banned";
      session: { userId: string; telegramId: string };
      user: {
        id: string;
        firstName: string;
        lastName: string | null;
        photoUrl: string | null;
        cityName: string | null;
        district: string | null;
        isBanned: boolean;
        banReason: string | null;
        bannedAt: string | null;
      };
    };

export const getAppAccessState = cache(async (): Promise<AppAccessState> => {
  const record = await getCurrentUserRecord();

  if (!record) {
    return { kind: "guest", session: null, user: null };
  }

  const { session, user } = record;

  return {
    kind: user.isBanned ? "banned" : "active",
    session,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: compactProfilePhotoUrl(user.photoUrl),
      cityName: user.city?.name ?? null,
      district: user.district ?? null,
      isBanned: user.isBanned,
      banReason: user.banReason ?? null,
      bannedAt: user.bannedAt?.toISOString() ?? null,
    },
  };
});
