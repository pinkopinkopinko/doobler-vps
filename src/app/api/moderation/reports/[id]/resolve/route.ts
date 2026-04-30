import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/prisma";

function hasModeratorRole(
  roles: Array<string | { role: string }>,
) {
  return roles.some((item) => (typeof item === "string" ? item : item.role) === "MODERATOR");
}

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();

  if (!user) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const isModerator = hasModeratorRole(user.roles);
  if (!isModerator) {
    return fail("Недостаточно прав.", 403);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { resolutionNote?: string };

  try {
    const report = await prisma.report.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolutionNote: body.resolutionNote ?? "Закрыто модератором",
        moderatorUserId: user.id,
      },
    });

    return ok({ report });
  } catch {
    return fail("Не удалось закрыть обращение.", 500);
  }
}
