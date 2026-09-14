import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { unbanUser } from "@/server/services/admin-service";

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
  const body = (await request.json().catch(() => ({}))) as { note?: string };

  try {
    const user = await unbanUser({
      targetUserId: id,
      moderatorUserId: guard.user.id,
      note: body.note,
    });
    return ok({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "SELF_ACTION_FORBIDDEN") {
      return fail("Нельзя применить действие к себе.", 400);
    }
    console.error("[admin] users/[id]/unban failed", error);
    return fail("Не удалось разблокировать пользователя.", 500);
  }
}
