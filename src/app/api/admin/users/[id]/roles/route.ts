import { fail, ok } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { roleMutationSchema, setUserRole } from "@/server/services/admin-service";

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
  const parsed = roleMutationSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  try {
    const result = await setUserRole({
      targetUserId: id,
      moderatorUserId: guard.user.id,
      role: parsed.data.role,
      action: parsed.data.action,
    });
    return ok({ user: result });
  } catch (error) {
    if (error instanceof Error && error.message === "SELF_ACTION_FORBIDDEN") {
      return fail("Нельзя менять роли самому себе.", 400);
    }
    console.error("[admin] users/[id]/roles failed", error);
    return fail("Не удалось изменить роли.", 500);
  }
}
