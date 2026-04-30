import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getTotalUnreadCount } from "@/server/services/chat-service";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return fail("Нужен вход через Telegram.", 401);
  }

  try {
    const unread = await getTotalUnreadCount(current.id);
    return ok({ unread });
  } catch (error) {
    console.error("[chats] unread count failed", error);
    return fail("Не удалось получить счётчик непрочитанных.", 500);
  }
}
