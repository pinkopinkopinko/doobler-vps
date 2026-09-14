import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { enforceUserRateLimit } from "@/lib/rate-limit/user";
import {
  listMessages,
  sendMessage,
  sendMessageSchema,
} from "@/server/services/chat-service";

type RouteParams = { params: Promise<{ id: string }> };

// GET: горячий poll-эндпоинт (`chat-conversation.tsx` тикает каждые 8 с).
// Раньше делали `getCurrentUser()` — лишний `User.findUnique` с roles-join
// ради одного `current.id`. Доступ к чату всё равно валидируется через
// `assertParticipant` внутри `listMessages`, так что нам хватает userId
// из подписанного session-куки.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSessionPayload();
  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;
  const beforeId = request.nextUrl.searchParams.get("beforeId") ?? undefined;
  const sinceId = request.nextUrl.searchParams.get("sinceId") ?? undefined;
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));

  try {
    const page = await listMessages({
      conversationId: id,
      currentUserId: session.userId,
      beforeId,
      sinceId,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
    });
    return ok(page);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_A_PARTICIPANT") {
      return fail("Доступ закрыт.", 403);
    }
    console.error("[chats] list messages failed", error);
    return fail("Не удалось получить сообщения.", 500);
  }
}

// POST: отправка нового сообщения. Тут проверка `isBanned` важна, но она
// делается внутри `sendMessage` (он сам делает findMany участников и
// читает author.isBanned). Поэтому отдельный getCurrentUser не нужен.
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSessionPayload();
  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  // 60 msg/min ≈ один в секунду — выше любого человеческого темпа печати,
  // но в живом чате во время согласования смены вполне возможно. Часовой
  // лимит 600 страхует от долгого спам-цикла.
  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  const limited = await enforceUserRateLimit({
    userId: session.userId,
    scope: "chat-message-send",
    limits: [
      { windowMs: 60_000, max: 60, label: "minute" },
      { windowMs: 60 * 60_000, max: 600, label: "hour" },
    ],
    message: "Слишком много сообщений подряд. Сделайте паузу.",
  });
  if (limited) return limited;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = sendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  try {
    const message = await sendMessage({
      conversationId: id,
      currentUserId: session.userId,
      input: parsed.data,
    });
    return ok({ message });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "NOT_A_PARTICIPANT":
          return fail("Доступ закрыт.", 403);
        case "USER_BANNED":
          return fail("Пользователь заблокирован.", 403);
        case "MEDIA_NOT_OWNED":
          return fail("Нельзя прикрепить файл другого пользователя.", 400);
        case "MEDIA_ALREADY_ATTACHED":
          return fail("Файл уже использован в другом сообщении.", 400);
        case "CONVERSATION_NOT_FOUND":
          return fail("Чат не найден.", 404);
      }
    }
    console.error("[chats] send message failed", error);
    return fail("Не удалось отправить сообщение.", 500);
  }
}
