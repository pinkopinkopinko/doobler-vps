import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { getConversationForUser } from "@/server/services/chat-service";

type RouteParams = { params: Promise<{ id: string }> };

// `getConversationForUser` уже валидирует, что userId — участник чата
// (см. NOT_A_PARTICIPANT ниже), отдельный SELECT по User тут не нужен.
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSessionPayload();
  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;

  try {
    const conversation = await getConversationForUser({
      conversationId: id,
      currentUserId: session.userId,
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
