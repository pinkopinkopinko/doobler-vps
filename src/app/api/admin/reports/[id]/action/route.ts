import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { actOnReport, reportActionSchema } from "@/server/services/admin-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход через Telegram." : "Недостаточно прав.",
      guard.status,
    );
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: guard.user.telegramId,
  });
  if (untrusted) return untrusted;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = reportActionSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  try {
    const report = await actOnReport({
      reportId: id,
      moderatorUserId: guard.user.id,
      action: parsed.data.action,
      note: parsed.data.note,
    });
    return ok({ report });
  } catch (error) {
    console.error("[admin] reports/[id]/action failed", error);
    return fail("Не удалось обновить жалобу.", 500);
  }
}
