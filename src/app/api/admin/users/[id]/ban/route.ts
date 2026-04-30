import { fail, ok } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { banSchema, banUser } from "@/server/services/admin-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход через Telegram." : "Недостаточно прав.",
      guard.status,
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = banSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  try {
    const user = await banUser({
      targetUserId: id,
      moderatorUserId: guard.user.id,
      reason: parsed.data.reason,
    });
    return ok({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "SELF_ACTION_FORBIDDEN") {
      return fail("Нельзя применить действие к себе.", 400);
    }
    console.error("[admin] users/[id]/ban failed", error);
    return fail("Не удалось заблокировать пользователя.", 500);
  }
}
