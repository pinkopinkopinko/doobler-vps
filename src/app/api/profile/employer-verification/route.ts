import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { submitEmployerVerification } from "@/server/services/employer-verification-service";
import {
  ConsentRequiredError,
  requireActiveConsent,
} from "@/server/services/legal-consent-service";

export async function POST(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Ожидается multipart/form-data.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return fail("Приложите документ или скриншот для проверки.", 400);
  }

  try {
    await requireActiveConsent(session.userId, "EMPLOYER_DOCUMENT_PROCESSING");
    const verification = await submitEmployerVerification({
      userId: session.userId,
      file,
    });

    return ok({
      verification: {
        id: verification.id,
        status: verification.status,
        createdAt: verification.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ConsentRequiredError) {
      return fail(error.message, 409);
    }
    if (error instanceof Error && error.message) {
      return fail(error.message, 400);
    }

    console.error("[employer-verification] submit failed", error);
    return fail("Не удалось отправить документ на проверку.", 500);
  }
}
