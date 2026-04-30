import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { listAuditLog } from "@/server/services/admin-service";

export async function GET(request: NextRequest) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход через Telegram." : "Недостаточно прав.",
      guard.status,
    );
  }

  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId = searchParams.get("entityId") ?? undefined;
  const limitParam = Number(searchParams.get("limit"));

  try {
    const entries = await listAuditLog({
      entityType,
      entityId,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
    });
    return ok({ entries });
  } catch (error) {
    console.error("[admin] audit failed", error);
    return fail("Не удалось получить audit log.", 500);
  }
}
