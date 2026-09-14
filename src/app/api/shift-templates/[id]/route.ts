import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { deleteShiftTemplate } from "@/server/services/shift-template-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  const { id } = await params;

  try {
    await deleteShiftTemplate(id, session.userId);
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return fail("Шаблон не найден.", 404);
    }

    console.error("[shift-templates] delete failed", error);
    return fail("Не удалось удалить шаблон.", 500);
  }
}
