import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { listShiftPosts } from "@/server/services/admin-service";
import type { ShiftPostStatus } from "@/lib/types";

const STATUSES = new Set([
  "PUBLISHED",
  "IN_REVIEW",
  "MATCHED",
  "CLOSED",
  "CANCELLED",
  "EXPIRED",
]);

export async function GET(request: NextRequest) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход через Telegram." : "Недостаточно прав.",
      guard.status,
    );
  }

  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status");
  const q = searchParams.get("q") ?? undefined;
  const limitParam = Number(searchParams.get("limit"));

  const status =
    statusParam && STATUSES.has(statusParam) ? (statusParam as ShiftPostStatus) : undefined;

  try {
    const shifts = await listShiftPosts({
      status,
      q: q ?? undefined,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
    });
    return ok({ shifts });
  } catch (error) {
    console.error("[admin] shifts failed", error);
    return fail("Не удалось получить смены.", 500);
  }
}
