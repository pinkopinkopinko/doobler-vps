import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;

  try {
    const favorite = await prisma.favorite.upsert({
      where: {
        userId_shiftPostId: {
          userId: session.userId,
          shiftPostId: id,
        },
      },
      update: {},
      create: {
        userId: session.userId,
        shiftPostId: id,
      },
    });

    return ok({ favorite }, { status: 201 });
  } catch {
    return ok({ favorite: { id: `mock_favorite_${Date.now()}`, shiftPostId: id } }, { status: 201 });
  }
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;

  try {
    await prisma.favorite.delete({
      where: {
        userId_shiftPostId: {
          userId: session.userId,
          shiftPostId: id,
        },
      },
    });

    return ok({ removed: true });
  } catch {
    return ok({ removed: true });
  }
}
