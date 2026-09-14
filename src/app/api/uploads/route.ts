import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { validateUpload, validateUploadBytes } from "@/lib/chat/uploads";
import { prisma } from "@/lib/prisma";
import { buildStorageKey, writeMedia } from "@/server/services/media-storage";

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: current.telegramId,
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
    return fail("Файл не найден в поле 'file'.", 400);
  }

  const scope = String(formData.get("scope") ?? "chat").toLowerCase();

  const validation = validateUpload({
    size: file.size,
    type: file.type,
    name: file.name,
  });

  if (!validation.ok) {
    return fail(validation.message, 400);
  }

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const contentValidation = validateUploadBytes(validation.mimeType, buffer);
    if (!contentValidation.ok) {
      return fail(contentValidation.message, 400);
    }

    const storageKey = buildStorageKey(scope, validation.extension);
    await writeMedia(storageKey, buffer);

    const media = await prisma.mediaUpload.create({
      data: {
        uploaderUserId: current.id,
        storageKey,
        mimeType: validation.mimeType,
        byteSize: validation.byteSize,
        originalName: file.name?.slice(0, 180) ?? null,
      },
      select: {
        id: true,
        mimeType: true,
        byteSize: true,
        createdAt: true,
      },
    });

    return ok({
      media: {
        id: media.id,
        mimeType: media.mimeType,
        byteSize: media.byteSize,
        url: `/api/uploads/${media.id}`,
        createdAt: media.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[uploads] failed", error);
    return fail("Не удалось загрузить файл.", 500);
  }
}
