import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { buildParticipantKey } from "@/lib/chat/participant-key";
import { notifyPeerAboutNewMessage } from "@/server/services/chat-notifier";

export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(4000).optional().default(""),
    attachmentMediaIds: z.array(z.string().min(1)).max(5).optional().default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.body && value.attachmentMediaIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Сообщение не может быть пустым.",
        path: ["body"],
      });
    }
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

function buildUserDisplayName(user: {
  firstName: string;
  lastName: string | null;
  username: string | null;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Пользователь"
  );
}

// -------- create / find conversation --------

export async function ensureConversation(params: {
  currentUserId: string;
  peerUserId: string;
}) {
  if (params.currentUserId === params.peerUserId) {
    throw new Error("SELF_CONVERSATION_FORBIDDEN");
  }

  const participantKey = buildParticipantKey(params.currentUserId, params.peerUserId);

  const [currentUser, peerUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.currentUserId },
      select: { id: true, isBanned: true },
    }),
    prisma.user.findUnique({
      where: { id: params.peerUserId },
      select: { id: true, isBanned: true },
    }),
  ]);

  if (!currentUser || !peerUser) {
    throw new Error("USER_NOT_FOUND");
  }

  if (currentUser.isBanned || peerUser.isBanned) {
    throw new Error("USER_BANNED");
  }

  const existing = await prisma.conversation.findUnique({
    where: { participantKey },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const conversation = await prisma.conversation.create({
    data: {
      participantKey,
      participants: {
        create: [
          { userId: params.currentUserId },
          { userId: params.peerUserId },
        ],
      },
    },
    select: { id: true },
  });

  return conversation;
}

// -------- list my conversations --------

export type ConversationRow = {
  id: string;
  lastMessageAt: string;
  peer: {
    id: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
    isBanned: boolean;
  };
  lastMessage: {
    id: string;
    body: string;
    authorUserId: string;
    createdAt: string;
    hasAttachments: boolean;
  } | null;
  unreadCount: number;
};

export async function listConversations(currentUserId: string): Promise<ConversationRow[]> {
  const myParticipations = await prisma.conversationParticipant.findMany({
    where: { userId: currentUserId, isArchived: false },
    select: {
      conversationId: true,
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          lastMessageAt: true,
          participants: {
            where: { userId: { not: currentUserId } },
            select: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                  photoUrl: true,
                  isBanned: true,
                },
              },
            },
            take: 1,
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              body: true,
              authorUserId: true,
              createdAt: true,
              _count: { select: { attachments: true } },
            },
          },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 100,
  });

  if (myParticipations.length === 0) {
    return [];
  }

  const conversationIds = myParticipations.map((p) => p.conversationId);
  const unreadCounts = await prisma.$queryRaw<
    Array<{ conversationId: string; unreadCount: bigint | number }>
  >(Prisma.sql`
    SELECT
      m."conversationId" AS "conversationId",
      COUNT(*) AS "unreadCount"
    FROM "Message" m
    INNER JOIN "ConversationParticipant" cp
      ON cp."conversationId" = m."conversationId"
    WHERE cp."userId" = ${currentUserId}
      AND cp."isArchived" = false
      AND m."authorUserId" <> ${currentUserId}
      AND m."createdAt" > cp."lastReadAt"
      AND m."conversationId" IN (${Prisma.join(conversationIds)})
    GROUP BY m."conversationId"
  `);

  const unreadMap = new Map<string, number>();
  for (const entry of unreadCounts) {
    unreadMap.set(entry.conversationId, Number(entry.unreadCount));
  }

  const rows: ConversationRow[] = [];
  for (const p of myParticipations) {
    const convo = p.conversation;
    const peer = convo.participants[0]?.user;
    if (!peer) {
      continue;
    }
    const lastMessage = convo.messages[0] ?? null;

    rows.push({
      id: convo.id,
      lastMessageAt: convo.lastMessageAt.toISOString(),
      peer: {
        id: peer.id,
        firstName: peer.firstName,
        lastName: peer.lastName ?? null,
        username: peer.username ?? null,
        photoUrl: peer.photoUrl ?? null,
        isBanned: peer.isBanned,
      },
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            body: lastMessage.body,
            authorUserId: lastMessage.authorUserId,
            createdAt: lastMessage.createdAt.toISOString(),
            hasAttachments: lastMessage._count.attachments > 0,
          }
        : null,
      unreadCount: unreadMap.get(convo.id) ?? 0,
    });
  }

  return rows;
}

export async function getTotalUnreadCount(currentUserId: string) {
  const rows = await prisma.$queryRaw<Array<{ unreadCount: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*) AS "unreadCount"
    FROM "Message" m
    INNER JOIN "ConversationParticipant" cp
      ON cp."conversationId" = m."conversationId"
    WHERE cp."userId" = ${currentUserId}
      AND cp."isArchived" = false
      AND m."authorUserId" <> ${currentUserId}
      AND m."createdAt" > cp."lastReadAt"
  `);

  return Number(rows[0]?.unreadCount ?? 0);
}

// -------- view a conversation --------

export type ChatMessage = {
  id: string;
  body: string;
  authorUserId: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  attachments: Array<{
    id: string;
    mediaId: string;
    mimeType: string;
    width: number | null;
    height: number | null;
  }>;
};

export async function assertParticipant(conversationId: string, userId: string) {
  const participation = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  if (!participation) {
    throw new Error("NOT_A_PARTICIPANT");
  }
}

export async function getConversationForUser(params: {
  conversationId: string;
  currentUserId: string;
}) {
  await assertParticipant(params.conversationId, params.currentUserId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
    select: {
      id: true,
      createdAt: true,
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              photoUrl: true,
              isBanned: true,
            },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  const peerParticipant = conversation.participants.find(
    (p) => p.userId !== params.currentUserId,
  );

  return {
    id: conversation.id,
    peer: peerParticipant
      ? {
          id: peerParticipant.user.id,
          firstName: peerParticipant.user.firstName,
          lastName: peerParticipant.user.lastName ?? null,
          username: peerParticipant.user.username ?? null,
          photoUrl: peerParticipant.user.photoUrl ?? null,
          isBanned: peerParticipant.user.isBanned,
        }
      : null,
  };
}

export async function listMessages(params: {
  conversationId: string;
  currentUserId: string;
  beforeId?: string | null;
  limit?: number;
}): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  await assertParticipant(params.conversationId, params.currentUserId);

  const take = Math.min(Math.max(params.limit ?? 50, 1), 100);

  const cursor = params.beforeId
    ? await prisma.message.findUnique({
        where: { id: params.beforeId },
        select: { id: true, conversationId: true, createdAt: true },
      })
    : null;

  const messages = await prisma.message.findMany({
    where: {
      conversationId: params.conversationId,
      ...(cursor && cursor.conversationId === params.conversationId
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: {
      id: true,
      body: true,
      authorUserId: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
      attachments: {
        select: {
          id: true,
          mediaId: true,
          media: {
            select: {
              mimeType: true,
              width: true,
              height: true,
            },
          },
        },
      },
    },
  });

  const hasMore = messages.length > take;
  const sliced = hasMore ? messages.slice(0, take) : messages;

  return {
    hasMore,
    messages: sliced
      .map((message) => ({
        id: message.id,
        body: message.body,
        authorUserId: message.authorUserId,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt?.toISOString() ?? null,
        deletedAt: message.deletedAt?.toISOString() ?? null,
        attachments: message.attachments.map((attachment) => ({
          id: attachment.id,
          mediaId: attachment.mediaId,
          mimeType: attachment.media.mimeType,
          width: attachment.media.width ?? null,
          height: attachment.media.height ?? null,
        })),
      }))
      .reverse(),
  };
}

// -------- send message --------

export async function sendMessage(params: {
  conversationId: string;
  currentUserId: string;
  input: SendMessageInput;
}): Promise<ChatMessage> {
  await assertParticipant(params.conversationId, params.currentUserId);

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: params.conversationId },
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          telegramId: true,
          firstName: true,
          lastName: true,
          username: true,
          isBanned: true,
          notifyOnNewMessage: true,
        },
      },
    },
  });

  const peer = participants.find((p) => p.userId !== params.currentUserId)?.user;
  const author = participants.find((p) => p.userId === params.currentUserId)?.user;

  if (!peer || !author) {
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  if (author.isBanned) {
    throw new Error("USER_BANNED");
  }

  if (params.input.attachmentMediaIds.length > 0) {
    const ownedCount = await prisma.mediaUpload.count({
      where: {
        id: { in: params.input.attachmentMediaIds },
        uploaderUserId: params.currentUserId,
      },
    });
    if (ownedCount !== params.input.attachmentMediaIds.length) {
      throw new Error("MEDIA_NOT_OWNED");
    }
  }

  const now = new Date();

  const message = await prisma.$transaction(async (tx) => {
    if (params.input.attachmentMediaIds.length > 0) {
      // Re-check inside the transaction to close the race; @@unique on mediaId
      // also enforces this at the DB level.
      const alreadyAttached = await tx.messageAttachment.count({
        where: { mediaId: { in: params.input.attachmentMediaIds } },
      });
      if (alreadyAttached > 0) {
        throw new Error("MEDIA_ALREADY_ATTACHED");
      }
    }

    const created = await tx.message.create({
      data: {
        conversationId: params.conversationId,
        authorUserId: params.currentUserId,
        body: params.input.body?.trim() ?? "",
        attachments:
          params.input.attachmentMediaIds.length > 0
            ? {
                create: params.input.attachmentMediaIds.map((mediaId) => ({
                  mediaId,
                })),
              }
            : undefined,
      },
      select: {
        id: true,
        body: true,
        authorUserId: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        attachments: {
          select: {
            id: true,
            mediaId: true,
            media: {
              select: { mimeType: true, width: true, height: true },
            },
          },
        },
      },
    });

    await tx.conversation.update({
      where: { id: params.conversationId },
      data: { lastMessageAt: now },
    });

    await tx.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.currentUserId,
        },
      },
      data: { lastReadAt: now, isArchived: false },
    });

    await tx.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: peer.id,
        },
      },
      data: { isArchived: false },
    });

    await tx.notification.create({
      data: {
        userId: peer.id,
        type: "chat.new_message",
        channel: "IN_APP",
        status: "PENDING",
        payloadJson: {
          conversationId: params.conversationId,
          messageId: created.id,
          authorUserId: params.currentUserId,
          authorDisplayName: buildUserDisplayName(author),
        },
      },
    });

    return created;
  });

  if (peer.notifyOnNewMessage && !peer.isBanned) {
    void notifyPeerAboutNewMessage({
      conversationId: params.conversationId,
      peerTelegramId: peer.telegramId,
      authorDisplayName: buildUserDisplayName(author),
      preview: message.body,
      hasAttachments: message.attachments.length > 0,
    });
  }

  return {
    id: message.id,
    body: message.body,
    authorUserId: message.authorUserId,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      mediaId: attachment.mediaId,
      mimeType: attachment.media.mimeType,
      width: attachment.media.width ?? null,
      height: attachment.media.height ?? null,
    })),
  };
}

// -------- mark read --------

export async function markConversationRead(params: {
  conversationId: string;
  currentUserId: string;
}) {
  await assertParticipant(params.conversationId, params.currentUserId);

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.currentUserId,
      },
    },
    data: { lastReadAt: new Date() },
  });
}
