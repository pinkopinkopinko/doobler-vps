import { fail, ok } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { getUserDetails } from "@/server/services/admin-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход через Telegram." : "Недостаточно прав.",
      guard.status,
    );
  }

  const { id } = await params;

  try {
    const user = await getUserDetails(id);
    if (!user) {
      return fail("Пользователь не найден.", 404);
    }
    return ok({ user });
  } catch (error) {
    console.error("[admin] users/[id] failed", error);
    return fail("Не удалось загрузить пользователя.", 500);
  }
}
