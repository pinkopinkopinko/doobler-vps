import { ZodError } from "zod";

import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { canCreateShiftPosts } from "@/lib/profile-completion";
import { enforceUserRateLimit } from "@/lib/rate-limit/user";
import { getProfileShell } from "@/server/services/profile-service";
import {
  listShiftTemplates,
  saveShiftTemplate,
} from "@/server/services/shift-template-service";

async function canManageTemplates(userId: string) {
  const profile = await getProfileShell(userId);

  return canCreateShiftPosts(
    profile?.roles ?? [],
    profile?.employerVerificationStatus ?? null,
  );
}

export async function GET() {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  if (!(await canManageTemplates(session.userId))) {
    return fail("Шаблоны доступны только подтвержденным работодателям.", 403);
  }

  try {
    const templates = await listShiftTemplates(session.userId);
    return ok({ templates });
  } catch (error) {
    console.error("[shift-templates] list failed", error);
    return fail("Не удалось загрузить шаблоны.", 500);
  }
}

export async function POST(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  if (!(await canManageTemplates(session.userId))) {
    return fail("Шаблоны доступны только подтвержденным работодателям.", 403);
  }

  const limited = await enforceUserRateLimit({
    userId: session.userId,
    scope: "shift-template-save",
    limits: [
      { windowMs: 60_000, max: 10, label: "minute" },
      { windowMs: 60 * 60_000, max: 60, label: "hour" },
    ],
    message: "Слишком много сохранений шаблонов подряд. Попробуйте через минуту.",
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const template = await saveShiftTemplate(body, session.userId);

    return ok({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(error.issues[0]?.message ?? "Проверьте поля шаблона.", 400);
    }

    if (error instanceof Error && error.message === "PICKUP_POINT_FORBIDDEN") {
      return fail("Этот ПВЗ больше недоступен для сохранения шаблона.", 403);
    }

    console.error("[shift-templates] save failed", error);
    return fail("Не удалось сохранить шаблон.", 500);
  }
}
