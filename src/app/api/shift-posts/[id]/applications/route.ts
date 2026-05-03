import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { applyToShift, listApplicationsForShift } from "@/server/services/application-service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;
  const applications = await listApplicationsForShift(id);
  return ok({ applications });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const body = await request.json();
  const { id } = await params;

  try {
    const application = await applyToShift(id, session.userId, body);
    return ok({ application }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "already_assigned_on_date":
          return fail(
            "У вас уже подтверждена смена на этот день. Сначала завершите её.",
            409,
          );
        case "shift_not_open":
          return fail("Эта смена уже закрыта или снята с публикации.", 410);
        case "cannot_apply_to_own_shift":
          return fail("Нельзя откликаться на собственную смену.", 400);
        case "owner_cannot_apply":
          return fail("Владельцы ПВЗ не могут откликаться на смены.", 403);
        case "applicant_banned":
          return fail("Ваш аккаунт заблокирован.", 403);
        case "shift_not_found":
          return fail("Смена не найдена.", 404);
      }
    }

    throw error;
  }
}
