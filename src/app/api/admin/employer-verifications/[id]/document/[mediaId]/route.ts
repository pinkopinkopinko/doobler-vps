import { fail } from "@/lib/api";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { readMedia } from "@/server/services/media-storage";
import { getEmployerVerificationDocumentForAdmin } from "@/server/services/employer-verification-service";

type RouteParams = { params: Promise<{ id: string; mediaId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    return fail(
      guard.reason === "no_session" ? "Нужен вход в админ-панель." : "Недостаточно прав.",
      guard.status,
    );
  }

  const { id, mediaId } = await params;
  const document = await getEmployerVerificationDocumentForAdmin({
    verificationId: id,
    mediaId,
    actorUserId: guard.user.id,
  });

  if (!document) {
    return fail("Документ не найден.", 404);
  }

  try {
    const data = await readMedia(document.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(document.byteSize),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[admin] employer document read failed", error);
    return fail("Не удалось прочитать документ.", 500);
  }
}
