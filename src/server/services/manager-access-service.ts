import { prisma } from "@/lib/prisma";

function normalizeTelegramUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

async function ensureOwnerPickupPoints(ownerUserId: string) {
  const existing = await prisma.pickupPoint.findMany({
    where: {
      ownerUserId,
    },
    select: {
      id: true,
    },
  });

  if (existing.length > 0) {
    return existing;
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: {
      id: true,
      pickupPointCode: true,
      cityId: true,
      regionId: true,
      district: true,
      marketplaces: true,
    },
  });

  if (
    !owner?.pickupPointCode ||
    !owner.cityId ||
    !owner.regionId
  ) {
    return [];
  }

  const marketplaceCode = owner.marketplaces[0] ?? "OTHER";
  const marketplace = await prisma.marketplace.findFirst({
    where: {
      code: marketplaceCode,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!marketplace) {
    return [];
  }

  const created = await prisma.pickupPoint.create({
    data: {
      ownerUserId,
      managerUserId: ownerUserId,
      marketplaceId: marketplace.id,
      regionId: owner.regionId,
      cityId: owner.cityId,
      title: owner.pickupPointCode,
      district: owner.district ?? null,
      address: owner.pickupPointCode,
      landmark: "Создано автоматически из профиля владельца",
    },
    select: {
      id: true,
    },
  });

  return [created];
}

export async function listOwnerManagers(ownerUserId: string) {
  const accesses = await prisma.pickupPointManagerAccess.findMany({
    where: { ownerUserId },
    select: {
      managerUserId: true,
      pickupPointId: true,
      manager: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          isBanned: true,
        },
      },
    },
  });

  const grouped = new Map<
    string,
    {
      id: string;
      username: string | null;
      firstName: string;
      lastName: string | null;
      isBanned: boolean;
      pickupPointIds: Set<string>;
    }
  >();

  for (const access of accesses) {
    const current = grouped.get(access.managerUserId);

    if (current) {
      current.pickupPointIds.add(access.pickupPointId);
      continue;
    }

    grouped.set(access.managerUserId, {
      id: access.manager.id,
      username: access.manager.username ?? null,
      firstName: access.manager.firstName,
      lastName: access.manager.lastName ?? null,
      isBanned: access.manager.isBanned,
      pickupPointIds: new Set([access.pickupPointId]),
    });
  }

  return Array.from(grouped.values())
    .map((manager) => ({
      id: manager.id,
      username: manager.username,
      firstName: manager.firstName,
      lastName: manager.lastName,
      isBanned: manager.isBanned,
      pickupPointsCount: manager.pickupPointIds.size,
    }))
    .sort((left, right) => {
      const leftName = [left.firstName, left.lastName].filter(Boolean).join(" ");
      const rightName = [right.firstName, right.lastName].filter(Boolean).join(" ");
      return leftName.localeCompare(rightName, "ru");
    });
}

export async function assignManagerByUsername(params: {
  ownerUserId: string;
  username: string;
}) {
  const username = normalizeTelegramUsername(params.username);

  if (!username) {
    throw new Error("USERNAME_REQUIRED");
  }

  const ownerPickupPoints = await ensureOwnerPickupPoints(params.ownerUserId);

  if (ownerPickupPoints.length === 0) {
    throw new Error("OWNER_PICKUP_POINTS_REQUIRED");
  }

  const manager = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      isBanned: true,
    },
  });

  if (!manager) {
    throw new Error("USER_NOT_FOUND");
  }

  if (manager.id === params.ownerUserId) {
    throw new Error("SELF_ASSIGNMENT_FORBIDDEN");
  }

  await prisma.$transaction(async (tx) => {
    await tx.userRole.upsert({
      where: {
        userId_role: {
          userId: manager.id,
          role: "MANAGER",
        },
      },
      create: {
        userId: manager.id,
        role: "MANAGER",
      },
      update: {},
    });

    await tx.pickupPointManagerAccess.createMany({
      data: ownerPickupPoints.map((pickupPoint) => ({
        pickupPointId: pickupPoint.id,
        ownerUserId: params.ownerUserId,
        managerUserId: manager.id,
      })),
      skipDuplicates: true,
    });
  });

  return {
    id: manager.id,
    username: manager.username ?? null,
    firstName: manager.firstName,
    lastName: manager.lastName ?? null,
    isBanned: manager.isBanned,
    pickupPointsCount: ownerPickupPoints.length,
  };
}
