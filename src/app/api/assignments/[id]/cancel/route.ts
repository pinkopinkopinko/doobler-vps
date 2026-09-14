import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { cancelConfirmedAssignment } from "@/server/services/application-service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

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
    const assignment = await cancelConfirmedAssignment(id, session.userId);
    return ok({ assignment });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return fail("Отказаться от этой смены может только подтверждённый сотрудник.", 403);
    }

    if (error instanceof Error && error.message === "assignment_not_cancellable") {
      return fail("Отказ доступен только для подтверждённой смены.", 409);
    }

    return fail("Не удалось отказаться от смены.", 500);
  }
}
