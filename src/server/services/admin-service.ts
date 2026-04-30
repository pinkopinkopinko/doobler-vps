import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { AppRole, ReportStatus, ShiftPostStatus } from "@/lib/types";

// -------- search normalization --------

const USERNAME_CHARS = /^[A-Za-z0-9_]+$/;

export function normalizeUserSearchQuery(raw: string | null | undefined) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return null;
  }

  let query = trimmed;

  // Telegram profile URLs
  const telegramUrlMatch = query.match(/^https?:\/\/t\.me\/([A-Za-z0-9_]+)\/?$/);
  if (telegramUrlMatch) {
    query = telegramUrlMatch[1];
  }

  // Strip leading @ for usernames
  if (query.startsWith("@")) {
    query = query.slice(1);
  }

  return query.trim() || null;
}

// -------- search --------

export type UserSearchHit = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  photoUrl: string | null;
  cityName: string | null;
  isBanned: boolean;
  isActive: boolean;
  banReason: string | null;
  bannedAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedAssignmentsCount: number;
  roles: AppRole[];
  lastActiveAt: string;
};

export async function searchUsers(rawQuery: string | null, limit = 20) {
  const query = normalizeUserSearchQuery(rawQuery);

  if (!query) {
    return [] as UserSearchHit[];
  }

  const digitsOnly = query.replace(/\D+/g, "");
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const orConditions: Array<Record<string, unknown>> = [
    { username: { equals: query, mode: "insensitive" } },
    { username: { contains: query, mode: "insensitive" } },
    { firstName: { contains: query, mode: "insensitive" } },
    { lastName: { contains: query, mode: "insensitive" } },
    { id: query },
  ];

  if (digitsOnly.length >= 3) {
    orConditions.push({ telegramId: digitsOnly });
    orConditions.push({ phone: { contains: digitsOnly } });
  }

  if (USERNAME_CHARS.test(query)) {
    orConditions.push({ telegramId: query });
  }

  const users = await prisma.user.findMany({
    where: { OR: orConditions },
    orderBy: [{ lastActiveAt: "desc" }],
    take: safeLimit,
    include: {
      roles: { select: { role: true } },
      city: { select: { name: true } },
    },
  });

  return users.map<UserSearchHit>((user) => ({
    id: user.id,
    telegramId: user.telegramId,
    username: user.username ?? null,
    firstName: user.firstName,
    lastName: user.lastName ?? null,
    phone: user.phone ?? null,
    photoUrl: user.photoUrl ?? null,
    cityName: user.city?.name ?? null,
    isBanned: user.isBanned,
    isActive: user.isActive,
    banReason: user.banReason ?? null,
    bannedAt: user.bannedAt?.toISOString() ?? null,
    ratingAvg: user.ratingAvg,
    ratingCount: user.ratingCount,
    completedAssignmentsCount: user.completedAssignmentsCount,
    roles: user.roles.map((r) => r.role as AppRole),
    lastActiveAt: user.lastActiveAt.toISOString(),
  }));
}

// -------- user details --------

export type UserDetails = UserSearchHit & {
  age: number | null;
  bio: string | null;
  marketplaces: string[];
  pickupPointCode: string | null;
  experienceSummary: string | null;
  isOnboardingCompleted: boolean;
  regionName: string | null;
  district: string | null;
  createdAt: string;
  updatedAt: string;
  reportsAgainst: Array<{
    id: string;
    targetType: string;
    reasonCode: string;
    description: string | null;
    status: ReportStatus;
    riskLevel: string;
    createdAt: string;
    reporterName: string | null;
  }>;
  reportsFiled: Array<{
    id: string;
    targetType: string;
    targetId: string;
    reasonCode: string;
    status: ReportStatus;
    createdAt: string;
  }>;
  recentApplications: Array<{
    id: string;
    shiftTitle: string;
    status: string;
    createdAt: string;
  }>;
  recentAssignments: Array<{
    id: string;
    role: "worker" | "employer";
    status: string;
    shiftTitle: string;
    completedAt: string | null;
  }>;
};

export async function getUserDetails(userId: string): Promise<UserDetails | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { select: { role: true } },
      city: { select: { name: true } },
      region: { select: { name: true } },
    },
  });

  if (!user) {
    return null;
  }

  const [reportsAgainstRows, reportsFiled, applications, workerAssignments, employerAssignments] =
    await Promise.all([
      prisma.report.findMany({
        where: { targetType: "USER", targetId: userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          reporter: { select: { firstName: true, lastName: true, username: true } },
        },
      }),
      prisma.report.findMany({
        where: { reporterUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.application.findMany({
        where: { applicantUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { shiftPost: { select: { title: true } } },
      }),
      prisma.assignment.findMany({
        where: { workerUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { shiftPost: { select: { title: true } } },
      }),
      prisma.assignment.findMany({
        where: { employerUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { shiftPost: { select: { title: true } } },
      }),
    ]);

  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username ?? null,
    firstName: user.firstName,
    lastName: user.lastName ?? null,
    phone: user.phone ?? null,
    photoUrl: user.photoUrl ?? null,
    cityName: user.city?.name ?? null,
    regionName: user.region?.name ?? null,
    district: user.district ?? null,
    isBanned: user.isBanned,
    isActive: user.isActive,
    banReason: user.banReason ?? null,
    bannedAt: user.bannedAt?.toISOString() ?? null,
    ratingAvg: user.ratingAvg,
    ratingCount: user.ratingCount,
    completedAssignmentsCount: user.completedAssignmentsCount,
    roles: user.roles.map((r) => r.role as AppRole),
    age: user.age ?? null,
    bio: user.bio ?? null,
    marketplaces: user.marketplaces as string[],
    pickupPointCode: user.pickupPointCode ?? null,
    experienceSummary: user.experienceSummary ?? null,
    isOnboardingCompleted: user.isOnboardingCompleted,
    lastActiveAt: user.lastActiveAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    reportsAgainst: reportsAgainstRows.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      reasonCode: report.reasonCode,
      description: report.description ?? null,
      status: report.status as ReportStatus,
      riskLevel: report.riskLevel,
      createdAt: report.createdAt.toISOString(),
      reporterName: report.reporter
        ? [report.reporter.firstName, report.reporter.lastName].filter(Boolean).join(" ") ||
          report.reporter.username ||
          null
        : null,
    })),
    reportsFiled: reportsFiled.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reasonCode: report.reasonCode,
      status: report.status as ReportStatus,
      createdAt: report.createdAt.toISOString(),
    })),
    recentApplications: applications.map((application) => ({
      id: application.id,
      shiftTitle: application.shiftPost.title,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
    })),
    recentAssignments: [
      ...workerAssignments.map((assignment) => ({
        id: assignment.id,
        role: "worker" as const,
        status: assignment.status,
        shiftTitle: assignment.shiftPost.title,
        completedAt: assignment.completedAt?.toISOString() ?? null,
      })),
      ...employerAssignments.map((assignment) => ({
        id: assignment.id,
        role: "employer" as const,
        status: assignment.status,
        shiftTitle: assignment.shiftPost.title,
        completedAt: assignment.completedAt?.toISOString() ?? null,
      })),
    ].sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? "")).reverse(),
  };
}

// -------- ban / unban --------

export const banSchema = z.object({
  reason: z.string().trim().min(1, "Укажите причину").max(500),
});

async function assertNotSelf(targetUserId: string, moderatorId: string | null) {
  if (!moderatorId) {
    return;
  }

  if (targetUserId === moderatorId) {
    throw new Error("SELF_ACTION_FORBIDDEN");
  }
}

export async function banUser(params: {
  targetUserId: string;
  moderatorUserId: string | null;
  reason: string;
}) {
  await assertNotSelf(params.targetUserId, params.moderatorUserId);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: params.targetUserId },
      data: {
        isBanned: true,
        isActive: false,
        banReason: params.reason,
        bannedAt: new Date(),
      },
      select: {
        id: true,
        isBanned: true,
        isActive: true,
        banReason: true,
        bannedAt: true,
        telegramId: true,
        username: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: params.moderatorUserId,
        entityType: "User",
        entityId: params.targetUserId,
        action: "ban",
        metaJson: { reason: params.reason },
      },
    });

    return user;
  });
}

export async function unbanUser(params: {
  targetUserId: string;
  moderatorUserId: string | null;
  note?: string;
}) {
  await assertNotSelf(params.targetUserId, params.moderatorUserId);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: params.targetUserId },
      data: {
        isBanned: false,
        isActive: true,
        banReason: null,
        bannedAt: null,
      },
      select: {
        id: true,
        isBanned: true,
        isActive: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: params.moderatorUserId,
        entityType: "User",
        entityId: params.targetUserId,
        action: "unban",
        metaJson: params.note ? { note: params.note } : undefined,
      },
    });

    return user;
  });
}

// -------- role management --------

export const roleMutationSchema = z.object({
  role: z.enum(["MODERATOR"]),
  action: z.enum(["add", "remove"]),
});

export async function setUserRole(params: {
  targetUserId: string;
  moderatorUserId: string | null;
  role: "MODERATOR";
  action: "add" | "remove";
}) {
  await assertNotSelf(params.targetUserId, params.moderatorUserId);

  return prisma.$transaction(async (tx) => {
    if (params.action === "add") {
      await tx.userRole.upsert({
        where: {
          userId_role: {
            userId: params.targetUserId,
            role: params.role,
          },
        },
        create: {
          userId: params.targetUserId,
          role: params.role,
        },
        update: {},
      });
    } else {
      await tx.userRole.deleteMany({
        where: {
          userId: params.targetUserId,
          role: params.role,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: params.moderatorUserId,
        entityType: "UserRole",
        entityId: params.targetUserId,
        action: `${params.action}_role`,
        metaJson: { role: params.role },
      },
    });

    const updated = await tx.user.findUnique({
      where: { id: params.targetUserId },
      select: {
        id: true,
        roles: { select: { role: true } },
      },
    });

    return {
      id: updated?.id ?? params.targetUserId,
      roles: updated?.roles.map((r) => r.role as AppRole) ?? [],
    };
  });
}

// -------- reports --------

export const reportActionSchema = z.object({
  action: z.enum(["resolve", "dismiss", "in_review"]),
  note: z.string().trim().max(1000).optional(),
});

export async function listReports(filter: {
  status?: ReportStatus;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  targetType?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);

  const reports = await prisma.report.findMany({
    where: {
      status: filter.status,
      riskLevel: filter.riskLevel,
      targetType: filter.targetType as never,
    },
    orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      reporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          telegramId: true,
        },
      },
      moderator: { select: { id: true, firstName: true, username: true } },
    },
  });

  return reports.map((report) => ({
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reasonCode: report.reasonCode,
    description: report.description ?? null,
    status: report.status,
    riskLevel: report.riskLevel,
    resolutionNote: report.resolutionNote ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    reporter: report.reporter
      ? {
          id: report.reporter.id,
          telegramId: report.reporter.telegramId,
          username: report.reporter.username ?? null,
          displayName:
            [report.reporter.firstName, report.reporter.lastName].filter(Boolean).join(" ") ||
            report.reporter.username ||
            "—",
        }
      : null,
    moderator: report.moderator
      ? {
          id: report.moderator.id,
          displayName: report.moderator.firstName ?? report.moderator.username ?? "—",
        }
      : null,
  }));
}

export async function actOnReport(params: {
  reportId: string;
  moderatorUserId: string | null;
  action: "resolve" | "dismiss" | "in_review";
  note?: string;
}) {
  const statusMap = {
    resolve: "RESOLVED" as const,
    dismiss: "DISMISSED" as const,
    in_review: "IN_REVIEW" as const,
  };

  const nextStatus = statusMap[params.action];

  return prisma.$transaction(async (tx) => {
    const report = await tx.report.update({
      where: { id: params.reportId },
      data: {
        status: nextStatus,
        moderatorUserId: params.moderatorUserId,
        resolutionNote:
          params.action === "in_review" ? undefined : params.note ?? `Статус: ${nextStatus}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: params.moderatorUserId,
        entityType: "Report",
        entityId: report.id,
        action: `report_${params.action}`,
        metaJson: params.note ? { note: params.note } : undefined,
      },
    });

    return report;
  });
}

// -------- shifts --------

export const cancelShiftSchema = z.object({
  reason: z.string().trim().min(1, "Укажите причину").max(500),
});

export async function listShiftPosts(filter: {
  status?: ShiftPostStatus;
  q?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const q = filter.q?.trim();

  const shifts = await prisma.shiftPost.findMany({
    where: {
      status: filter.status,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
              { id: q },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, username: true, isBanned: true },
      },
      city: { select: { name: true } },
      marketplace: { select: { code: true } },
      _count: { select: { applications: true } },
    },
  });

  return shifts.map((shift) => ({
    id: shift.id,
    title: shift.title,
    type: shift.type,
    status: shift.status,
    cityName: shift.city.name,
    district: shift.district,
    address: shift.address,
    marketplace: shift.marketplace.code,
    paymentAmountRub: shift.paymentAmountRub,
    workersNeeded: shift.workersNeeded,
    isUrgent: shift.isUrgent,
    shiftDate: shift.shiftDate.toISOString(),
    publishedAt: shift.publishedAt.toISOString(),
    applicationsCount: shift._count.applications,
    createdBy: {
      id: shift.createdBy.id,
      displayName:
        [shift.createdBy.firstName, shift.createdBy.lastName].filter(Boolean).join(" ") ||
        shift.createdBy.username ||
        "—",
      username: shift.createdBy.username ?? null,
      isBanned: shift.createdBy.isBanned,
    },
  }));
}

export async function cancelShiftPost(params: {
  shiftPostId: string;
  moderatorUserId: string | null;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const shift = await tx.shiftPost.update({
      where: { id: params.shiftPostId },
      data: {
        status: "CANCELLED",
        closedAt: new Date(),
      },
      select: { id: true, status: true, closedAt: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: params.moderatorUserId,
        entityType: "ShiftPost",
        entityId: shift.id,
        action: "moderator_cancel",
        metaJson: { reason: params.reason },
      },
    });

    return shift;
  });
}

// -------- stats / audit --------

export async function getAdminStats() {
  const [
    totalUsers,
    bannedUsers,
    activeShifts,
    urgentShifts,
    openReports,
    highRiskOpenReports,
    moderatorCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.shiftPost.count({ where: { status: "PUBLISHED" } }),
    prisma.shiftPost.count({ where: { status: "PUBLISHED", isUrgent: true } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.report.count({ where: { status: "OPEN", riskLevel: "HIGH" } }),
    prisma.userRole.count({ where: { role: "MODERATOR" } }),
  ]);

  return {
    totalUsers,
    bannedUsers,
    activeShifts,
    urgentShifts,
    openReports,
    highRiskOpenReports,
    moderatorCount,
  };
}

export async function listAuditLog(filter: {
  limit?: number;
  entityType?: string;
  entityId?: string;
}) {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);

  const entries = await prisma.auditLog.findMany({
    where: {
      entityType: filter.entityType,
      entityId: filter.entityId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      },
    },
  });

  return entries.map((entry) => ({
    id: entry.id,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    metaJson: (entry.metaJson as Record<string, unknown> | null) ?? null,
    createdAt: entry.createdAt.toISOString(),
    actor: entry.actor
      ? {
          id: entry.actor.id,
          displayName:
            [entry.actor.firstName, entry.actor.lastName].filter(Boolean).join(" ") ||
            entry.actor.username ||
            "—",
        }
      : null,
  }));
}
