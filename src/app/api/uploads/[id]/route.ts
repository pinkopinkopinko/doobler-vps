import { Readable } from "node:stream";

import { fail } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/prisma";
import { createMediaReadStream, statMedia } from "@/server/services/media-storage";

type RouteParams = { params: Promise<{ id: string }> };

function buildPrivateMediaHeaders(
  media: {
    id: string;
    mimeType: string;
    byteSize: number;
    createdAt: Date;
  },
  fileByteSize?: number,
) {
  const timestamp = media.createdAt.getTime();
  const etag = `"media-${media.id}-${media.byteSize}-${timestamp}"`;

  return {
    "Content-Type": media.mimeType,
    "Content-Length": String(fileByteSize ?? media.byteSize),
    "Cache-Control": "private, max-age=86400",
    "Last-Modified": media.createdAt.toUTCString(),
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
}

function hasMatchingEtag(ifNoneMatch: string | null, etag: string) {
  if (!ifNoneMatch) {
    return false;
  }

  return ifNoneMatch
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === etag || value === "*");
}

function isNotModified(request: Request, headers: Record<string, string>, createdAt: Date) {
  if (hasMatchingEtag(request.headers.get("if-none-match"), headers.ETag)) {
    return true;
  }

  const ifModifiedSince = request.headers.get("if-modified-since");
  if (!ifModifiedSince) {
    return false;
  }

  const since = Date.parse(ifModifiedSince);
  return Number.isFinite(since) && since >= createdAt.getTime();
}

export async function GET(request: Request, { params }: RouteParams) {
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
      createdAt: true,
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
    const info = await statMedia(media.storageKey);
    const headers = buildPrivateMediaHeaders(media, info.byteSize);

    if (isNotModified(request, headers, media.createdAt)) {
      return new Response(null, { status: 304, headers });
    }

    const stream = createMediaReadStream(media.storageKey);
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers,
    });
  } catch (error) {
    console.error("[uploads] read failed", error);
    return fail("Не удалось прочитать файл.", 500);
  }
}
