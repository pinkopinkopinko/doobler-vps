import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { markConversationRead } from "@/server/services/chat-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const current = await getCurrentUser();
  if (!current) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;

  try {
    await markConversationRead({
      conversationId: id,
      currentUserId: current.id,
    });
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_A_PARTICIPANT") {
      return fail("Доступ закрыт.", 403);
    }
    console.error("[chats] mark read failed", error);
    return fail("Не удалось отметить прочитанным.", 500);
  }
}
