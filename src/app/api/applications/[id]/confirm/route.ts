import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { enforceUserRateLimit } from "@/lib/rate-limit/user";
import { confirmApplication } from "@/server/services/application-service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  // Подтверждение отклика триггерит транзакцию + Telegram-нотификацию
  // обеим сторонам. Скрипт-спам тут не имеет смысла, но всё равно
  // прикроем — 10/min хватает для нормальной работы владельца с лентой
  // откликов.
  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  const limited = await enforceUserRateLimit({
    userId: session.userId,
    scope: "application-confirm",
    limits: [{ windowMs: 60_000, max: 10, label: "minute" }],
  });
  if (limited) return limited;

  const { id } = await params;

  try {
    const assignment = await confirmApplication(id, session.userId);

    return ok({ assignment });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return fail("Недостаточно прав для подтверждения отклика.", 403);
    }

    return fail("Не удалось подтвердить отклик.", 500);
  }
}
