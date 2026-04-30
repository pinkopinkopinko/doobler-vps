import { fail, ok } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { getAdminStats } from "@/server/services/admin-service";

export async function GET() {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход через Telegram." : "Недостаточно прав.",
      guard.status,
    );
  }

  try {
    const stats = await getAdminStats();
    return ok({ stats });
  } catch (error) {
    console.error("[admin] stats failed", error);
    return fail("Не удалось получить статистику.", 500);
  }
}
