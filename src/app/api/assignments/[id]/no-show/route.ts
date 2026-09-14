import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { markAssignmentNoShow } from "@/server/services/application-service";

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
    const assignment = await markAssignmentNoShow(id, session.userId);
    return ok({ assignment });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return fail("Отметить неявку может только работодатель этой смены.", 403);
    }

    if (error instanceof Error && error.message === "shift_not_started") {
      return fail("Отметить неявку можно только после начала смены.", 409);
    }

    if (error instanceof Error && error.message === "assignment_not_no_showable") {
      return fail("Для этой смены уже нельзя отметить неявку.", 409);
    }

    return fail("Не удалось отметить неявку.", 500);
  }
}
