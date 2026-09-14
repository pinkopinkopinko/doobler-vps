import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  const { id } = await params;

  try {
    const result = await prisma.notification.updateMany({
      where: { id, userId: session.userId },
      data: {
        status: "READ",
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      return fail("Notification not found.", 404);
    }

    return ok({ notification: { id, status: "READ" } });
  } catch (error) {
    console.error("[notifications] read failed", error);
    return fail("Failed to mark notification as read.", 500);
  }
}
