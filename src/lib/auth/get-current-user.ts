import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getSessionPayload } from "@/lib/auth/session";
import { demoProfile, demoUsers } from "@/lib/demo-data";

// Узкий select под реальные нужды callers: id (везде), roles (require-moderator,
// managers, shift-posts, moderation), telegramId/firstName/lastName/username
// (только require-moderator), isBanned (для будущих гард-проверок). Полный
// профиль с verifications/city/etc. читаем уже через профильные сервисы.
const currentUserSelect = {
  id: true,
  telegramId: true,
  firstName: true,
  lastName: true,
  username: true,
  isBanned: true,
  roles: {
    select: {
      role: true,
    },
  },
} as const;

export const getCurrentUser = cache(async () => {
  const session = await getSessionPayload();

  if (!session) {
    return null;
  }

  try {
    return await prisma.user.findUnique({
      where: { id: session.userId },
      select: currentUserSelect,
    });
  } catch {
    const demoUser = demoUsers.find((item) => item.id === session.userId);
    return (
      demoUser && {
        ...demoProfile,
        id: demoUser.id,
      }
    );
  }
});
