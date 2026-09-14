import { z } from "zod";

import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import {
  actOnEmployerVerification,
  employerVerificationActions,
  type EmployerVerificationAction,
} from "@/server/services/employer-verification-service";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход в админ-панель." : "Недостаточно прав.",
      guard.status,
    );
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: guard.user.telegramId,
  });
  if (untrusted) return untrusted;

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success || !employerVerificationActions.has(parsed.data.action)) {
    return fail("Некорректное действие.", 400);
  }

  const { id } = await params;

  try {
    const verification = await actOnEmployerVerification({
      verificationId: id,
      moderatorUserId: guard.user.id,
      action: parsed.data.action as EmployerVerificationAction,
    });

    return ok({ verification: { id: verification.id, status: verification.status } });
  } catch (error) {
    console.error("[admin] employer verification action failed", error);
    return fail("Не удалось изменить статус проверки работодателя.", 500);
  }
}
