import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { getTotalUnreadCount } from "@/server/services/chat-service";

// Горячий polling-эндпоинт — `useUnreadChats` тикает каждые 30 с в открытом
// Mini App. Раньше делали `getCurrentUser()` (User.findUnique + roles-join)
// ради одного `id`. `getTotalUnreadCount` сам считает по
// `ConversationParticipant.userId`, так что верифицированной userId из
// подписанного session-куки достаточно.
export async function GET() {
  const session = await getSessionPayload();
  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  try {
    const unread = await getTotalUnreadCount(session.userId);
    return ok({ unread });
  } catch (error) {
    console.error("[chats] unread count failed", error);
    return fail("Не удалось получить счётчик непрочитанных.", 500);
  }
}
