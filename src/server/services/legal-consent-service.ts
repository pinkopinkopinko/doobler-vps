import {
  CONSENT_PURPOSES,
  CONSENT_TEXT,
  LEGAL_DOCUMENT_VERSIONS,
  OFFER_ACCEPTANCE_TEXT,
  type ConsentPurpose,
} from "@/lib/legal-consents";
import { prisma } from "@/lib/prisma";
import { invalidateCachedUserRecord } from "@/lib/cache/user-record-cache";
import { deleteEmployerVerificationDocumentsForUser } from "@/server/services/employer-verification-service";

export class ConsentRequiredError extends Error {
  constructor(public readonly purpose: ConsentPurpose) {
    super("Нужно отдельно подтвердить согласие перед выполнением действия.");
    this.name = "ConsentRequiredError";
  }
}

export class OfferAcceptanceRequiredError extends Error {
  constructor() {
    super("Нужно отдельно принять публичную оферту перед регистрацией.");
    this.name = "OfferAcceptanceRequiredError";
  }
}

export async function getConsentState(userId: string) {
  const rows = await prisma.userLegalEvent.findMany({
    where: {
      userId,
      purpose: { in: [...CONSENT_PURPOSES] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      purpose: true,
      action: true,
      createdAt: true,
    },
  });

  const state = Object.fromEntries(CONSENT_PURPOSES.map((purpose) => [purpose, false])) as Record<
    ConsentPurpose,
    boolean
  >;
  const decided = new Set<string>();

  for (const row of rows) {
    if (decided.has(row.purpose)) {
      continue;
    }

    if (CONSENT_PURPOSES.includes(row.purpose as ConsentPurpose)) {
      state[row.purpose as ConsentPurpose] = row.action === "GRANTED";
      decided.add(row.purpose);
    }
  }

  return state;
}

export async function hasActiveConsent(userId: string, purpose: ConsentPurpose) {
  const latest = await prisma.userLegalEvent.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });

  return latest?.action === "GRANTED";
}

export async function requireActiveConsent(userId: string, purpose: ConsentPurpose) {
  if (!(await hasActiveConsent(userId, purpose))) {
    throw new ConsentRequiredError(purpose);
  }
}

export async function requireCurrentOfferAcceptance(userId: string) {
  const accepted = await prisma.userLegalEvent.findFirst({
    where: {
      userId,
      purpose: "OFFER_ACCEPTANCE",
      action: "ACCEPTED",
      documentVersion: LEGAL_DOCUMENT_VERSIONS.offer,
    },
    select: { id: true },
  });

  if (!accepted) {
    throw new OfferAcceptanceRequiredError();
  }
}

export async function recordConsentDecision(params: {
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  source?: string;
}) {
  const action = params.granted ? "GRANTED" : "WITHDRAWN";
  const event = await prisma.userLegalEvent.create({
    data: {
      userId: params.userId,
      purpose: params.purpose,
      action,
      documentVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
      textSnapshot: CONSENT_TEXT[params.purpose],
      source: params.source ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: params.userId,
      entityType: "UserLegalEvent",
      entityId: event.id,
      action: `consent_${action.toLowerCase()}`,
      metaJson: { purpose: params.purpose, documentVersion: event.documentVersion },
    },
  });

  if (!params.granted && params.purpose === "PHONE_PROCESSING") {
    await prisma.user.update({
      where: { id: params.userId },
      data: { phone: null, isPhoneVerified: false },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: params.userId,
        entityType: "User",
        entityId: params.userId,
        action: "phone_deleted_consent_withdrawal",
      },
    });
    await invalidateCachedUserRecord(params.userId);
  }

  if (!params.granted && params.purpose === "EMPLOYER_DOCUMENT_PROCESSING") {
    await deleteEmployerVerificationDocumentsForUser(params.userId);
  }

  return event;
}

export async function recordOfferAcceptance(params: { userId: string; source?: string }) {
  const event = await prisma.userLegalEvent.create({
    data: {
      userId: params.userId,
      purpose: "OFFER_ACCEPTANCE",
      action: "ACCEPTED",
      documentVersion: LEGAL_DOCUMENT_VERSIONS.offer,
      textSnapshot: OFFER_ACCEPTANCE_TEXT,
      source: params.source ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: params.userId,
      entityType: "UserLegalEvent",
      entityId: event.id,
      action: "offer_accepted",
      metaJson: { documentVersion: event.documentVersion },
    },
  });

  return event;
}

export async function purgePhoneNumbersWithoutRecordedConsent() {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ phone: { not: null } }, { isPhoneVerified: true }],
    },
    select: { id: true },
  });
  let deletedCount = 0;

  for (const user of users) {
    if (await hasActiveConsent(user.id, "PHONE_PROCESSING")) {
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { phone: null, isPhoneVerified: false },
    });
    await prisma.auditLog.create({
      data: {
        entityType: "User",
        entityId: user.id,
        action: "phone_deleted_missing_recorded_consent",
      },
    });
    await invalidateCachedUserRecord(user.id);
    deletedCount += 1;
  }

  return deletedCount;
}

export async function purgeEmployerDocumentsWithoutRecordedConsent() {
  const rows = await prisma.verification.findMany({
    where: {
      type: "EMPLOYER_PVZ",
      fileKey: { not: null },
      userId: { not: null },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  let deletedCount = 0;

  for (const row of rows) {
    if (!row.userId || (await hasActiveConsent(row.userId, "EMPLOYER_DOCUMENT_PROCESSING"))) {
      continue;
    }

    deletedCount += await deleteEmployerVerificationDocumentsForUser(
      row.userId,
      "employer_pvz_document_deleted_missing_recorded_consent",
    );
  }

  return deletedCount;
}
