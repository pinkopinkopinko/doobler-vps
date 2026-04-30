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
    const notification = await prisma.notification.update({
      where: { id, userId: session.userId },
      data: {
        status: "READ",
        readAt: new Date(),
      },
    });

    return ok({ notification });
  } catch {
    return ok({ notification: { id, status: "READ" } });
  }
}
