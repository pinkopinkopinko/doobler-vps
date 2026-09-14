import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { checkInMemoryRateLimit } from "@/lib/rate-limit/in-memory";
import { buildRateLimitResponse } from "@/lib/rate-limit/response";
import {
  ensureConversation,
  listConversations,
} from "@/server/services/chat-service";

// Анти-спам на создание новых чатов: 5 новых конверсейшенов в минуту
// и 30 в час — этого хватит для нормального флоу (открыл чат с откликнувшимся
// работником / связался с владельцем), но отрежет автоматическую рассылку
// «привет» по всем подряд userId.
const NEW_CHAT_PER_MINUTE = { windowMs: 60_000, max: 5 } as const;
const NEW_CHAT_PER_HOUR = { windowMs: 60 * 60_000, max: 30 } as const;

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return fail("Нужен вход через Telegram.", 401);
  }

  try {
    const conversations = await listConversations(current.id);
    return ok({ conversations });
  } catch (error) {
    console.error("[chats] list failed", error);
    return fail("Не удалось получить список чатов.", 500);
  }
}

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: current.telegramId,
  });
  if (untrusted) return untrusted;

  const body = (await request.json().catch(() => ({}))) as { peerUserId?: string };
  const peerUserId = body.peerUserId?.trim();

  if (!peerUserId) {
    return fail("peerUserId обязателен.", 400);
  }

  const minuteCheck = await checkInMemoryRateLimit({
    key: `chat-create-min:${current.id}`,
    ...NEW_CHAT_PER_MINUTE,
  });
  if (!minuteCheck.ok) {
    return buildRateLimitResponse(minuteCheck.retryAfterMs);
  }

  const hourCheck = await checkInMemoryRateLimit({
    key: `chat-create-hour:${current.id}`,
    ...NEW_CHAT_PER_HOUR,
  });
  if (!hourCheck.ok) {
    return buildRateLimitResponse(
      hourCheck.retryAfterMs,
      "Слишком много новых чатов за час. Попробуйте позже.",
    );
  }

  try {
    const conversation = await ensureConversation({
      currentUserId: current.id,
      peerUserId,
    });
    return ok({ conversation });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "SELF_CONVERSATION_FORBIDDEN":
          return fail("Нельзя создать чат с самим собой.", 400);
        case "USER_NOT_FOUND":
          return fail("Пользователь не найден.", 404);
        case "USER_BANNED":
          return fail("Пользователь заблокирован.", 403);
        case "OWNER_PEER_FORBIDDEN":
          return fail(
            "Нельзя написать владельцу первым. Дождитесь, пока он откроет чат с вами.",
            403,
          );
      }
    }
    console.error("[chats] create failed", error);
    return fail("Не удалось создать чат.", 500);
  }
}
