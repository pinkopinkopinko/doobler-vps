import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { cancelShiftPost, cancelShiftSchema } from "@/server/services/admin-service";

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
  const parsed = cancelShiftSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  try {
    const shift = await cancelShiftPost({
      shiftPostId: id,
      moderatorUserId: guard.user.id,
      reason: parsed.data.reason,
    });
    return ok({ shift });
  } catch (error) {
    console.error("[admin] shifts/[id]/cancel failed", error);
    return fail("Не удалось отменить смену.", 500);
  }
}
