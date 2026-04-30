import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { updateShiftPostStatus } from "@/server/services/shift-post-service";

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
    const shiftPost = await updateShiftPostStatus(id, "CANCELLED", session.userId);
    return ok({ shiftPost });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      // 404 вместо 403: не подсвечиваем существование чужой смены.
      return fail("Объявление не найдено.", 404);
    }
    console.error("[shift-posts] cancel failed", error);
    return fail("Не удалось отменить объявление.", 500);
  }
}
