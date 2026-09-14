import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { completeAssignment } from "@/server/services/application-service";

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
    const assignment = await completeAssignment(id, session.userId);

    return ok({ assignment });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return fail("Недостаточно прав для завершения смены.", 403);
    }

    if (error instanceof Error && error.message === "assignment_not_completable") {
      return fail("Эту смену уже нельзя отметить завершённой.", 409);
    }

    return fail("Не удалось завершить смену.", 500);
  }
}
