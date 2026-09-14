import { z } from "zod";
import { AssignmentStatus, Prisma } from "@/generated/prisma/client";

import { buildCompactProfilePhotoSource } from "@/lib/profile-photo";
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
      select: {
        id: true,
        isBanned: true,
        roles: { select: { role: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: params.peerUserId },
      select: {
        id: true,
        isBanned: true,
        roles: { select: { role: true } },
      },
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
    // Уже существующий чат всегда отдаём — даже если бы по новым правилам
    // его сейчас нельзя было создать. Это покрывает кейс, когда владелец
    // первым написал работнику: работник может ответить из своих чатов.
    return existing;
  }

  // Бизнес-правило: владельцу пишет владелец или сам работник, но
  // инициировать чат от лица работника нельзя — иначе любой работник может
  // спамить владельцев из карточек смен. Owner всегда может писать первым.
  const peerIsOwner = peerUser.roles.some((row) => row.role === "OWNER");
  const currentIsOwner = currentUser.roles.some((row) => row.role === "OWNER");

  if (peerIsOwner && !currentIsOwner) {
    throw new Error("OWNER_PEER_FORBIDDEN");
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
    photoUrl: string | null;
    isBanned: boolean;
  };
  lastMessage: {
    body: string;
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
          photoUrl: buildCompactProfilePhotoSource({
            userId: peer.id,
            photoUrl: peer.photoUrl,
          }),
          isBanned: peer.isBanned,
        },
        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
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
  attachments: Array<{
    id: string;
    mediaId: string;
  }>;
};

export type ConversationShiftContext = {
  id: string;
  assignmentId: string;
  title: string;
  marketplace: string;
  status: AssignmentStatus;
  cityName: string | null;
  district: string;
  address: string;
  shiftDate: string;
  startAt: string | null;
  endAt: string | null;
  paymentAmountRub: number;
  completedAt: string | null;
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
  // Раньше было два отдельных запроса: assertParticipant (SELECT по composite
  // unique key) + findUnique(conversation) с include participants. Так как
  // второй запрос всё равно тянет всех участников, проверку участия делаем
  // на возвращённых данных и сохраняем один roundtrip.
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

  if (!conversation.participants.some((p) => p.userId === params.currentUserId)) {
    throw new Error("NOT_A_PARTICIPANT");
  }

  const peerParticipant = conversation.participants.find(
    (p) => p.userId !== params.currentUserId,
  );
  const peerUserId = peerParticipant?.user.id ?? null;
  const activeShift = peerUserId
    ? await getConversationShiftContext(params.currentUserId, peerUserId)
    : null;

  return {
    id: conversation.id,
    peer: peerParticipant
        ? {
            id: peerParticipant.user.id,
            firstName: peerParticipant.user.firstName,
            lastName: peerParticipant.user.lastName ?? null,
            photoUrl: buildCompactProfilePhotoSource({
              userId: peerParticipant.user.id,
              photoUrl: peerParticipant.user.photoUrl,
            }),
            isBanned: peerParticipant.user.isBanned,
          }
      : null,
    activeShift,
  };
}

async function getConversationShiftContext(
  currentUserId: string,
  peerUserId: string,
): Promise<ConversationShiftContext | null> {
  const assignments = await prisma.assignment.findMany({
    where: {
      OR: [
        { employerUserId: currentUserId, workerUserId: peerUserId },
        { employerUserId: peerUserId, workerUserId: currentUserId },
      ],
      status: {
        in: [
          AssignmentStatus.CONFIRMED,
          AssignmentStatus.IN_PROGRESS,
          AssignmentStatus.COMPLETED,
        ],
      },
    },
    orderBy: { confirmedAt: "desc" },
    take: 12,
    select: {
      id: true,
      status: true,
      confirmedAt: true,
      completedAt: true,
      shiftPost: {
        select: {
          id: true,
          title: true,
          district: true,
          address: true,
          shiftDate: true,
          startAt: true,
          endAt: true,
          paymentAmountRub: true,
          city: { select: { name: true } },
          marketplace: { select: { code: true } },
        },
      },
    },
  });

  if (assignments.length === 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const priority = (assignment: (typeof assignments)[number]) => {
    if (assignment.status === AssignmentStatus.IN_PROGRESS) {
      return 0;
    }
    if (
      assignment.status === AssignmentStatus.CONFIRMED &&
      assignment.shiftPost.shiftDate >= today
    ) {
      return 1;
    }
    if (assignment.status === AssignmentStatus.CONFIRMED) {
      return 2;
    }
    return 3;
  };

  const selected = [...assignments].sort((left, right) => {
    const priorityDiff = priority(left) - priority(right);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return right.confirmedAt.getTime() - left.confirmedAt.getTime();
  })[0];

  if (!selected) {
    return null;
  }

  return {
    id: selected.shiftPost.id,
    assignmentId: selected.id,
    title: selected.shiftPost.title,
    marketplace: selected.shiftPost.marketplace.code,
    status: selected.status,
    cityName: selected.shiftPost.city?.name ?? null,
    district: selected.shiftPost.district,
    address: selected.shiftPost.address,
    shiftDate: selected.shiftPost.shiftDate.toISOString(),
    startAt: selected.shiftPost.startAt?.toISOString() ?? null,
    endAt: selected.shiftPost.endAt?.toISOString() ?? null,
    paymentAmountRub: selected.shiftPost.paymentAmountRub,
    completedAt: selected.completedAt?.toISOString() ?? null,
  };
}

/**
 * Три режима выборки сообщений в одном эндпоинте:
 *
 * - **initial / `beforeId`** — пагинация вверх (загружаем последние N
 *   сообщений или N сообщений старше курсора). `hasMore` отвечает «есть ли
 *   ещё более старые». Используется при открытии чата и подгрузке истории
 *   на скролл вверх.
 *
 * - **`sinceId`** — инкрементальная подгрузка для polling-цикла.
 *   Возвращаем только сообщения **новее** курсора. Это превращает
 *   8-секундный poll из «верни последние 80» в «верни 0-1 новых», что
 *   режет payload и работу `setState` практически до нуля для активного
 *   чата без новых сообщений. `hasMore` тут не используется (он
 *   относится только к листанию старых сообщений).
 */
export async function listMessages(params: {
  conversationId: string;
  currentUserId: string;
  beforeId?: string | null;
  sinceId?: string | null;
  limit?: number;
}): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  await assertParticipant(params.conversationId, params.currentUserId);

  const take = Math.min(Math.max(params.limit ?? 50, 1), 100);

  // sinceId имеет приоритет — это рантайм-подгрузка новых сообщений.
  // beforeId — это «листать вниз по истории». Одновременно оба не имеют
  // смысла; если клиент прислал оба, считаем корректной только sinceId.
  if (params.sinceId) {
    const cursor = await prisma.message.findUnique({
      where: { id: params.sinceId },
      select: { id: true, conversationId: true, createdAt: true },
    });

    if (!cursor || cursor.conversationId !== params.conversationId) {
      // Курсор битый или из чужого чата — ведём себя как «нет новых»,
      // чтобы клиент не словил несовместимое состояние и продолжил
      // poll на следующей итерации с тем же sinceId. Если курсор
      // удалили из БД (Message.delete), пусть клиент запросит initial
      // через перезагрузку чата — тут это редкий путь, без панических
      // 4xx.
      return { messages: [], hasMore: false };
    }

    const newer = await prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
        OR: [
          { createdAt: { gt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
      select: {
        id: true,
        body: true,
        authorUserId: true,
        createdAt: true,
        attachments: {
          select: {
            id: true,
            mediaId: true,
          },
        },
      },
    });

    return {
      hasMore: false,
      messages: newer.map((message) => ({
        id: message.id,
        body: message.body,
        authorUserId: message.authorUserId,
        createdAt: message.createdAt.toISOString(),
        attachments: message.attachments.map((attachment) => ({
          id: attachment.id,
          mediaId: attachment.mediaId,
        })),
      })),
    };
  }

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
      attachments: {
        select: {
          id: true,
          mediaId: true,
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
        attachments: message.attachments.map((attachment) => ({
          id: attachment.id,
          mediaId: attachment.mediaId,
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
  // Раньше отдельно вызывали `assertParticipant` (SELECT по composite
  // unique), а потом тут же тянули `findMany` всех participants — лишний
  // roundtrip, потому что `findMany` уже возвращает participation. Если
  // среди них нет current user, это либо `NOT_A_PARTICIPANT`, либо чата
  // вообще нет — оба случая для отправителя выглядят одинаково
  // («сообщение не доставилось»), поэтому отдаём тот же код, что раньше.
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

  if (!author) {
    throw new Error("NOT_A_PARTICIPANT");
  }

  if (!peer) {
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
        attachments: {
          select: {
            id: true,
            mediaId: true,
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
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      mediaId: attachment.mediaId,
    })),
  };
}

// -------- mark read --------

export async function markConversationRead(params: {
  conversationId: string;
  currentUserId: string;
}) {
  // Раньше делали `assertParticipant` (SELECT по composite unique), а
  // потом отдельный UPDATE по тому же ключу — два roundtrip ради одной
  // мутации. `updateMany` с тем же where-условием делает одно UPDATE и
  // возвращает `count`. Если count === 0, значит пользователь не в чате
  // (или чата не существует) — кидаем тот же доменный код, что раньше.
  const result = await prisma.conversationParticipant.updateMany({
    where: {
      conversationId: params.conversationId,
      userId: params.currentUserId,
    },
    data: { lastReadAt: new Date() },
  });

  if (result.count === 0) {
    throw new Error("NOT_A_PARTICIPANT");
  }
}
