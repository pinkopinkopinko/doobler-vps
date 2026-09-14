import { extname } from "node:path";

import { VerificationStatus } from "@/generated/prisma/client";
import { invalidateCachedUserRecord } from "@/lib/cache/user-record-cache";
import { prisma } from "@/lib/prisma";
import { buildStorageKey, deleteMedia, writeMedia } from "@/server/services/media-storage";

const MAX_EMPLOYER_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const EMPLOYER_DOCUMENT_RETENTION_DAYS = 30;
const EMPLOYER_DOCUMENT_RETENTION_MS =
  EMPLOYER_DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const ALLOWED_EMPLOYER_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const employerVerificationActions = new Set(["approve", "reject"] as const);

export type EmployerVerificationAction = "approve" | "reject";

function getDocumentDeletionDueAt(createdAt: Date) {
  return new Date(createdAt.getTime() + EMPLOYER_DOCUMENT_RETENTION_MS);
}

export async function purgeExpiredEmployerVerificationDocuments(now = new Date()) {
  const cutoff = new Date(now.getTime() - EMPLOYER_DOCUMENT_RETENTION_MS);
  const verifications = await prisma.verification.findMany({
    where: {
      type: "EMPLOYER_PVZ",
      fileKey: { not: null },
      createdAt: { lte: cutoff },
    },
    select: {
      id: true,
      fileKey: true,
      createdAt: true,
    },
  });

  const mediaIds = verifications
    .map((verification) => verification.fileKey)
    .filter((mediaId): mediaId is string => Boolean(mediaId));
  const mediaRows = mediaIds.length
    ? await prisma.mediaUpload.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true, storageKey: true },
      })
    : [];
  const mediaById = new Map(mediaRows.map((media) => [media.id, media]));
  let deletedCount = 0;

  for (const verification of verifications) {
    const mediaId = verification.fileKey;
    if (!mediaId) {
      continue;
    }

    const claimed = await prisma.verification.updateMany({
      where: { id: verification.id, fileKey: mediaId },
      data: { fileKey: null },
    });
    if (claimed.count === 0) {
      continue;
    }

    const media = mediaById.get(mediaId);
    if (media) {
      await deleteMedia(media.storageKey);
      await prisma.mediaUpload.deleteMany({ where: { id: media.id } });
    }

    await prisma.auditLog.create({
      data: {
        entityType: "Verification",
        entityId: verification.id,
        action: "employer_pvz_document_deleted_retention",
        metaJson: {
          mediaId,
          uploadedAt: verification.createdAt.toISOString(),
          retentionDays: EMPLOYER_DOCUMENT_RETENTION_DAYS,
        },
      },
    });
    deletedCount += 1;
  }

  return deletedCount;
}

export async function deleteEmployerVerificationDocumentsForUser(
  userId: string,
  action = "employer_pvz_document_deleted_consent_withdrawal",
) {
  const verifications = await prisma.verification.findMany({
    where: {
      userId,
      type: "EMPLOYER_PVZ",
      fileKey: { not: null },
    },
    select: {
      id: true,
      fileKey: true,
      createdAt: true,
    },
  });
  let deletedCount = 0;

  for (const verification of verifications) {
    const mediaId = verification.fileKey;
    if (!mediaId) {
      continue;
    }

    const media = await prisma.mediaUpload.findUnique({
      where: { id: mediaId },
      select: { id: true, storageKey: true },
    });
    const claimed = await prisma.verification.updateMany({
      where: { id: verification.id, fileKey: mediaId },
      data: { fileKey: null, status: VerificationStatus.EXPIRED },
    });
    if (claimed.count === 0) {
      continue;
    }

    if (media) {
      await deleteMedia(media.storageKey);
      await prisma.mediaUpload.deleteMany({ where: { id: media.id } });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        entityType: "Verification",
        entityId: verification.id,
        action,
        metaJson: {
          mediaId,
          uploadedAt: verification.createdAt.toISOString(),
        },
      },
    });
    deletedCount += 1;
  }

  await invalidateCachedUserRecord(userId);
  return deletedCount;
}

export async function purgeDisabledIdentityVerificationDocuments() {
  const photos = await prisma.identityVerificationPhoto.findMany({
    select: {
      id: true,
      verificationId: true,
      mediaId: true,
      media: {
        select: { storageKey: true },
      },
    },
  });
  let deletedPhotoCount = 0;

  for (const photo of photos) {
    const claimed = await prisma.identityVerificationPhoto.deleteMany({
      where: { id: photo.id },
    });
    if (claimed.count === 0) {
      continue;
    }

    await deleteMedia(photo.media.storageKey);
    await prisma.mediaUpload.deleteMany({ where: { id: photo.mediaId } });
    await prisma.auditLog.create({
      data: {
        entityType: "IdentityVerification",
        entityId: photo.verificationId,
        action: "identity_document_deleted_feature_disabled",
        metaJson: { mediaId: photo.mediaId },
      },
    });
    deletedPhotoCount += 1;
  }

  const records = await prisma.identityVerification.findMany({
    select: { id: true },
  });
  let deletedRecordCount = 0;

  for (const record of records) {
    const claimed = await prisma.identityVerification.deleteMany({
      where: { id: record.id },
    });
    if (claimed.count === 0) {
      continue;
    }

    await prisma.auditLog.create({
      data: {
        entityType: "IdentityVerification",
        entityId: record.id,
        action: "identity_verification_metadata_deleted_feature_disabled",
      },
    });
    deletedRecordCount += 1;
  }

  return { deletedPhotoCount, deletedRecordCount };
}

export async function purgeVerificationDocuments() {
  const [employerDocumentsDeleted, identityDeleted] = await Promise.all([
    purgeExpiredEmployerVerificationDocuments(),
    purgeDisabledIdentityVerificationDocuments(),
  ]);

  return {
    employerDocumentsDeleted,
    identityDocumentsDeleted: identityDeleted.deletedPhotoCount,
    identityRecordsDeleted: identityDeleted.deletedRecordCount,
  };
}

function validateEmployerDocument(file: File) {
  if (file.size <= 0) {
    return { ok: false as const, message: "Файл пустой." };
  }

  if (file.size > MAX_EMPLOYER_DOCUMENT_BYTES) {
    return { ok: false as const, message: "Документ должен быть не больше 10 МБ." };
  }

  const mimeType = file.type.toLowerCase();
  if (!ALLOWED_EMPLOYER_DOCUMENT_MIME_TYPES.has(mimeType)) {
    return {
      ok: false as const,
      message: "Поддерживаются PDF, JPEG, PNG и WebP.",
    };
  }

  const fallbackExt = file.name ? extname(file.name).toLowerCase() : "";
  return {
    ok: true as const,
    mimeType,
    byteSize: file.size,
    extension: EXT_BY_MIME[mimeType] ?? fallbackExt,
  };
}

export async function getEmployerVerificationStatus(userId: string) {
  const row = await prisma.verification.findFirst({
    where: {
      userId,
      type: "EMPLOYER_PVZ",
    },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });

  return row?.status ?? null;
}

export async function submitEmployerVerification(params: {
  userId: string;
  file: File;
}) {
  const validation = validateEmployerDocument(params.file);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const buffer = new Uint8Array(await params.file.arrayBuffer());
  const storageKey = buildStorageKey("employer-pvz", validation.extension);
  await writeMedia(storageKey, buffer);

  const media = await prisma.mediaUpload.create({
    data: {
      uploaderUserId: params.userId,
      storageKey,
      mimeType: validation.mimeType,
      byteSize: validation.byteSize,
      originalName: params.file.name?.slice(0, 180) ?? null,
    },
    select: { id: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    await tx.verification.updateMany({
      where: {
        userId: params.userId,
        type: "EMPLOYER_PVZ",
        status: { in: [VerificationStatus.PENDING, VerificationStatus.REJECTED] },
      },
      data: {
        status: VerificationStatus.EXPIRED,
      },
    });

    const verification = await tx.verification.create({
      data: {
        userId: params.userId,
        type: "EMPLOYER_PVZ",
        status: VerificationStatus.PENDING,
        fileKey: media.id,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: params.userId,
        entityType: "Verification",
        entityId: verification.id,
        action: "employer_pvz_document_uploaded",
        metaJson: {
          mediaId: media.id,
          deleteAfter: getDocumentDeletionDueAt(verification.createdAt).toISOString(),
          retentionDays: EMPLOYER_DOCUMENT_RETENTION_DAYS,
        },
      },
    });

    return verification;
  });

  // verifications[] часть кешируемого wide-select юзера; без сброса
  // employerVerificationStatus в profile-shell остаётся stale до TTL.
  await invalidateCachedUserRecord(params.userId);

  return created;
}

export async function listEmployerVerifications(filter?: {
  status?: VerificationStatus;
  limit?: number;
}) {
  await purgeExpiredEmployerVerificationDocuments();
  const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);

  const rows = await prisma.verification.findMany({
    where: {
      type: "EMPLOYER_PVZ",
      status: filter?.status,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          marketplaces: true,
          region: { select: { name: true } },
        },
      },
    },
  });

  const mediaIds = rows.map((row) => row.fileKey).filter((id): id is string => Boolean(id));
  const mediaRows = mediaIds.length
    ? await prisma.mediaUpload.findMany({
        where: { id: { in: mediaIds } },
        select: {
          id: true,
          mimeType: true,
          byteSize: true,
          originalName: true,
        },
      })
    : [];
  const mediaById = new Map(mediaRows.map((media) => [media.id, media]));

  return rows.map((row) => {
    const media = row.fileKey ? mediaById.get(row.fileKey) : null;

    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      user: row.user
        ? {
            id: row.user.id,
            telegramId: row.user.telegramId,
            username: row.user.username ?? null,
            firstName: row.user.firstName,
            lastName: row.user.lastName ?? null,
            marketplaces: row.user.marketplaces,
            regionName: row.user.region?.name ?? null,
          }
        : null,
      document: media
        ? {
            mediaId: media.id,
            mimeType: media.mimeType,
            byteSize: media.byteSize,
            originalName: media.originalName,
            url: `/api/admin/employer-verifications/${row.id}/document/${media.id}`,
          }
        : null,
    };
  });
}

export async function actOnEmployerVerification(params: {
  verificationId: string;
  moderatorUserId: string | null;
  action: EmployerVerificationAction;
}) {
  const nextStatus =
    params.action === "approve" ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;

  const row = await prisma.verification.update({
    where: { id: params.verificationId },
    data: {
      status: nextStatus,
      reviewedByUserId: params.moderatorUserId,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      userId: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: params.moderatorUserId,
      entityType: "Verification",
      entityId: row.id,
      action: `employer_pvz_${params.action}`,
    },
  });

  // Модератор изменил статус EMPLOYER_PVZ — сбрасываем кеш юзера,
  // чтобы employerVerificationStatus в profile-shell обновился сразу.
  // userId nullable в схеме (исторически — для аномальных строк), но в
  // нормальном кейсе всегда есть.
  if (row.userId) {
    await invalidateCachedUserRecord(row.userId);
  }

  return row;
}

export async function getEmployerVerificationDocumentForAdmin(params: {
  verificationId: string;
  mediaId: string;
  actorUserId: string | null;
}) {
  await purgeExpiredEmployerVerificationDocuments();
  const verification = await prisma.verification.findFirst({
    where: {
      id: params.verificationId,
      type: "EMPLOYER_PVZ",
      fileKey: params.mediaId,
    },
    select: {
      fileKey: true,
    },
  });

  if (!verification?.fileKey) {
    return null;
  }

  const media = await prisma.mediaUpload.findUnique({
    where: { id: verification.fileKey },
    select: {
      storageKey: true,
      mimeType: true,
      byteSize: true,
    },
  });

  if (media) {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        entityType: "Verification",
        entityId: params.verificationId,
        action: "employer_pvz_document_viewed",
        metaJson: { mediaId: params.mediaId },
      },
    });
  }

  return media;
}
