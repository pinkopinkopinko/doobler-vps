import { z } from "zod";

import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { getShiftPostById, updateShiftPostStatus } from "@/server/services/shift-post-service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Только статусы, которые имеет смысл выставлять автору смены через PATCH.
// Полный жизненный цикл (MATCHED, CLOSED, EXPIRED) меняется не вручную, а
// сервисами (confirmApplication / completeAssignment / scheduler).
const patchSchema = z.object({
  status: z.enum(["IN_REVIEW", "PUBLISHED", "CANCELLED"]).optional(),
});

export async function GET(_: Request, { params }: RouteParams) {
  const { id } = await params;
  const shiftPost = await getShiftPostById(id);

  if (!shiftPost) {
    return fail("Объявление не найдено.", 404);
  }

  return ok({ shiftPost });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  try {
    const shiftPost = await updateShiftPostStatus(
      id,
      parsed.data.status ?? "IN_REVIEW",
      session.userId,
    );
    return ok({ shiftPost });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail("Объявление не найдено.", 404);
    }
    console.error("[shift-posts] patch failed", error);
    return fail("Не удалось обновить объявление.", 500);
  }
}
