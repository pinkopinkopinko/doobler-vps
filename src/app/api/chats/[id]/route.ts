import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getConversationForUser } from "@/server/services/chat-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const current = await getCurrentUser();
  if (!current) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;

  try {
    const conversation = await getConversationForUser({
      conversationId: id,
      currentUserId: current.id,
    });
    return ok({ conversation });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_A_PARTICIPANT") {
        return fail("Доступ закрыт.", 403);
      }
      if (error.message === "CONVERSATION_NOT_FOUND") {
        return fail("Чат не найден.", 404);
      }
    }
    console.error("[chats] get failed", error);
    return fail("Не удалось загрузить чат.", 500);
  }
}
