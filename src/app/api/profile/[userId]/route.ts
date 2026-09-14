import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { getProfile, redactProfileForViewer } from "@/server/services/profile-service";
import { hasActiveConsent } from "@/server/services/legal-consent-service";

type RouteParams = {
  params: Promise<{ userId: string }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  // Профиль — это PII (телефон и т.п.), отдаём только авторизованным юзерам,
  // и редактируем чувствительные поля при просмотре чужого профиля.
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { userId } = await params;
  if (session.userId !== userId && !(await hasActiveConsent(userId, "PUBLIC_PROFILE_DISTRIBUTION"))) {
    return fail("Пользователь не открыл публичный доступ к своему профилю.", 403);
  }

  const profile = await getProfile(userId);

  if (!profile) {
    return fail("Профиль не найден.", 404);
  }

  return ok({
    profile: redactProfileForViewer(profile, session.userId),
  });
}
