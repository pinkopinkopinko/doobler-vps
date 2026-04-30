import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { completeAssignment } from "@/server/services/application-service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;

  try {
    const assignment = await completeAssignment(id, session.userId);

    return ok({ assignment });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return fail("Недостаточно прав для завершения смены.", 403);
    }

    return fail("Не удалось завершить смену.", 500);
  }
}
