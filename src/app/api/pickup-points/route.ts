import { z } from "zod";

import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { isOwnerRole } from "@/lib/profile-completion";
import { prisma } from "@/lib/prisma";

// Валидация создания ПВЗ. Без z-схемы любой logged-in юзер мог сложить
// произвольный JSON в БД (включая мегабайтовые title/address и FK на
// несуществующие region/city/marketplace), что приводило к 500 без
// внятного ответа и к мусорным записям.
const createPickupPointSchema = z.object({
  marketplaceId: z.string().min(1).max(64),
  regionId: z.string().min(1).max(64),
  cityId: z.string().min(1).max(64),
  title: z.string().trim().min(2).max(120),
  district: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((value) => value ?? null),
  address: z.string().trim().min(5).max(255),
  landmark: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable()
    .transform((value) => value ?? null),
});

export async function GET() {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  try {
    const pickupPoints = await prisma.pickupPoint.findMany({
      where: {
        OR: [
          { ownerUserId: session.userId },
          {
            managerAccesses: {
              some: {
                managerUserId: session.userId,
              },
            },
          },
        ],
      },
      include: {
        city: true,
        marketplace: true,
        managerAccesses: {
          where: {
            managerUserId: session.userId,
          },
          select: {
            id: true,
            ownerUserId: true,
          },
        },
      },
      orderBy: [{ city: { name: "asc" } }, { title: "asc" }],
    });

    return ok({ pickupPoints });
  } catch {
    return ok({ pickupPoints: [] });
  }
}

export async function POST(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  // Создавать ПВЗ может только владелец. Без этой проверки любой logged-in
  // юзер (включая работников) мог записать на себя fake-точку.
  const currentUser = await getCurrentUser();
  const roles =
    currentUser && "roles" in currentUser
      ? currentUser.roles.map((role) => (typeof role === "string" ? role : role.role))
      : [];

  if (!isOwnerRole(roles)) {
    return fail("Создавать ПВЗ может только владелец.", 403);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = createPickupPointSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  try {
    const pickupPoint = await prisma.pickupPoint.create({
      data: {
        ownerUserId: session.userId,
        managerUserId: session.userId,
        marketplaceId: parsed.data.marketplaceId,
        regionId: parsed.data.regionId,
        cityId: parsed.data.cityId,
        title: parsed.data.title,
        district: parsed.data.district,
        address: parsed.data.address,
        landmark: parsed.data.landmark,
      },
    });

    return ok({ pickupPoint }, { status: 201 });
  } catch (error) {
    console.error("[pickup-points] create failed", error);
    return fail("Не удалось создать ПВЗ.", 500);
  }
}
