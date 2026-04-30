import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { searchUsers } from "@/server/services/admin-service";

export async function GET(request: NextRequest) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход через Telegram." : "Недостаточно прав.",
      guard.status,
    );
  }

  const q = request.nextUrl.searchParams.get("q");
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 20;

  try {
    const users = await searchUsers(q, limit);
    return ok({ users });
  } catch (error) {
    console.error("[admin] users/search failed", error);
    return fail("Не удалось выполнить поиск.", 500);
  }
}
