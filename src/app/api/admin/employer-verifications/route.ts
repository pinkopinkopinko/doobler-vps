import { NextRequest } from "next/server";

import { VerificationStatus } from "@/generated/prisma/client";
import { fail, ok } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { listEmployerVerifications } from "@/server/services/employer-verification-service";

const STATUSES = new Set(Object.values(VerificationStatus));

export async function GET(request: NextRequest) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход в админ-панель." : "Недостаточно прав.",
      guard.status,
    );
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  const status =
    statusParam && STATUSES.has(statusParam as VerificationStatus)
      ? (statusParam as VerificationStatus)
      : undefined;

  try {
    const verifications = await listEmployerVerifications({ status });
    return ok({ verifications });
  } catch (error) {
    console.error("[admin] employer verifications failed", error);
    return fail("Не удалось получить заявки работодателей.", 500);
  }
}
