import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  listMessages,
  sendMessage,
  sendMessageSchema,
} from "@/server/services/chat-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const current = await getCurrentUser();
  if (!current) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;
  const beforeId = request.nextUrl.searchParams.get("beforeId") ?? undefined;
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));

  try {
    const page = await listMessages({
      conversationId: id,
      currentUserId: current.id,
      beforeId,
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

export async function POST(request: Request, { params }: RouteParams) {
  const current = await getCurrentUser();
  if (!current) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = sendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  try {
    const message = await sendMessage({
      conversationId: id,
      currentUserId: current.id,
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
