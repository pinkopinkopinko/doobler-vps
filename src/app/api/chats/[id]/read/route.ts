import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { markConversationRead } from "@/server/services/chat-service";

type RouteParams = { params: Promise<{ id: string }> };

// `markConversationRead` сам проверяет участие через UPDATE-with-where
// и кидает NOT_A_PARTICIPANT если пользователь не в чате — отдельный
// User.findUnique тут не нужен.
export async function POST(request: Request, { params }: RouteParams) {
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
    await markConversationRead({
      conversationId: id,
      currentUserId: session.userId,
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
