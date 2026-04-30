import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        OR: [{ workerUserId: session.userId }, { employerUserId: session.userId }],
      },
      include: {
        shiftPost: true,
      },
      orderBy: { confirmedAt: "desc" },
    });

    return ok({ assignments });
  } catch {
    return ok({ assignments: [] });
  }
}
