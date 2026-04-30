import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { listReports } from "@/server/services/admin-service";
import type { ReportStatus } from "@/lib/types";

const STATUSES = new Set(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]);
const RISK_LEVELS = new Set(["LOW", "MEDIUM", "HIGH"]);
const TARGET_TYPES = new Set([
  "USER",
  "SHIFT_POST",
  "APPLICATION",
  "ASSIGNMENT",
  "REVIEW",
  "PICKUP_POINT",
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
  const riskParam = searchParams.get("riskLevel");
  const targetParam = searchParams.get("targetType");
  const limitParam = Number(searchParams.get("limit"));

  const status =
    statusParam && STATUSES.has(statusParam) ? (statusParam as ReportStatus) : undefined;
  const riskLevel =
    riskParam && RISK_LEVELS.has(riskParam) ? (riskParam as "LOW" | "MEDIUM" | "HIGH") : undefined;
  const targetType = targetParam && TARGET_TYPES.has(targetParam) ? targetParam : undefined;

  try {
    const reports = await listReports({
      status,
      riskLevel,
      targetType,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
    });
    return ok({ reports });
  } catch (error) {
    console.error("[admin] reports failed", error);
    return fail("Не удалось получить жалобы.", 500);
  }
}
