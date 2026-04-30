import { fail } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/prisma";
import { readMedia } from "@/server/services/media-storage";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const current = await getCurrentUser();
  if (!current) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const { id } = await params;

  const media = await prisma.mediaUpload.findUnique({
    where: { id },
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      byteSize: true,
      uploaderUserId: true,
      attachments: {
        select: {
          message: {
            select: {
              conversation: {
                select: {
                  participants: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!media) {
    return fail("Файл не найден.", 404);
  }

  const isUploader = media.uploaderUserId === current.id;
  const isParticipant = media.attachments.some((attachment) =>
    attachment.message.conversation.participants.some(
      (participant) => participant.userId === current.id,
    ),
  );

  if (!isUploader && !isParticipant) {
    return fail("Доступ закрыт.", 403);
  }

  try {
    const data = await readMedia(media.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(media.byteSize),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("[uploads] read failed", error);
    return fail("Не удалось прочитать файл.", 500);
  }
}
