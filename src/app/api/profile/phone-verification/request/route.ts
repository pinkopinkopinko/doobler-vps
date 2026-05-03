import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { sendPhoneVerificationRequest } from "@/lib/telegram/bot";

export async function POST() {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      id: true,
      telegramId: true,
      firstName: true,
      isPhoneVerified: true,
    },
  });

  if (!user) {
    return fail("Профиль не найден.", 404);
  }

  if (user.isPhoneVerified) {
    return ok({
      status: "already_verified",
      message: "Номер телефона уже подтверждён.",
    });
  }

  try {
    await sendPhoneVerificationRequest(user.telegramId, {
      id: Number(user.telegramId),
      first_name: user.firstName,
    });

    return ok({
      status: "sent",
      message: "Бот отправил кнопку для подтверждения номера телефона.",
    });
  } catch (error) {
    console.error("[phone-verification] request failed", {
      userId: user.id,
      telegramId: user.telegramId,
      message: error instanceof Error ? error.message : "unknown",
    });

    return fail(
      "Не удалось отправить сообщение в Telegram. Откройте бота и попробуйте ещё раз.",
      502,
    );
  }
}
