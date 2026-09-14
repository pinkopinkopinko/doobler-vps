import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { sendPhoneVerificationRequest } from "@/lib/telegram/bot";
import {
  ConsentRequiredError,
  requireActiveConsent,
} from "@/server/services/legal-consent-service";

export async function POST(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

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
    await requireActiveConsent(user.id, "PHONE_PROCESSING");
    await sendPhoneVerificationRequest(user.telegramId, {
      id: Number(user.telegramId),
      first_name: user.firstName,
    });

    return ok({
      status: "sent",
      message: "Бот отправил кнопку для подтверждения номера телефона.",
    });
  } catch (error) {
    if (error instanceof ConsentRequiredError) {
      return fail(error.message, 409);
    }
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
