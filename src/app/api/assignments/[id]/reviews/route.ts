import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { createAssignmentReview } from "@/server/services/application-service";

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
  const body = await request.json();

  try {
    const review = await createAssignmentReview(id, session.userId, body);

    return ok({ review });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return fail("Недостаточно прав для отзыва.", 403);
    }

    if (error instanceof Error && error.message === "assignment_not_completed") {
      return fail("Оставить отзыв можно только после завершения смены.", 400);
    }

    if (error instanceof Error && error.message === "review_already_exists") {
      return fail("Отзыв по этой смене уже оставлен.", 409);
    }

    return fail("Не удалось сохранить отзыв.", 500);
  }
}
