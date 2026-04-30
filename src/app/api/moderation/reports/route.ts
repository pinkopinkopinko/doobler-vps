import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/prisma";

function hasModeratorRole(
  roles: Array<string | { role: string }>,
) {
  return roles.some((item) => (typeof item === "string" ? item : item.role) === "MODERATOR");
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const isModerator = hasModeratorRole(user.roles);
  if (!isModerator) {
    return fail("Недостаточно прав.", 403);
  }

  try {
    const reports = await prisma.report.findMany({
      orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    return ok({ reports });
  } catch {
    return fail("Не удалось получить обращения.", 500);
  }
}
