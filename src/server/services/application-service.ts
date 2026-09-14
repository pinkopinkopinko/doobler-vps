import {
  ApplicationStatus,
  AssignmentStatus,
  Prisma,
  ShiftPostStatus,
} from "@/generated/prisma/client";

import { demoApplications } from "@/lib/demo-data";
import { isDevFallbackEnabled, logDevFallbackUsed } from "@/lib/dev-fallback";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { buildCompactProfilePhotoSource } from "@/lib/profile-photo";
import { invalidateCachedUserRecord } from "@/lib/cache/user-record-cache";
import { prisma } from "@/lib/prisma";
import { applicationSchema, reviewSchema } from "@/lib/validations/shift-post";

function getShiftDetailsUrl(shiftPostId: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://doobler.ru").replace(/\/$/, "");
  return `${baseUrl}/telegram/shifts/${shiftPostId}`;
}

function allowDevDataFallback() {
  return isDevFallbackEnabled("data");
}

function shouldUseDemoFallback(error: unknown) {
  if (!allowDevDataFallback()) {
    return false;
  }

  if (error instanceof Error) {
    const businessErrors = new Set([
      "forbidden",
      "owner_cannot_apply",
      "assignment_not_completed",
      "assignment_not_completable",
      "applicant_not_found",
      "applicant_banned",
      "shift_not_found",
      "shift_not_open",
      "cannot_apply_to_own_shift",
      "already_assigned_on_date",
      "already_applied",
      "assignment_not_cancellable",
      "assignment_not_no_showable",
      "shift_not_started",
      "review_already_exists",
    ]);
    if (businessErrors.has(error.message)) {
      return false;
    }
  }

  return true;
}

function buildDemoFallbackResult<T>(source: string, error: unknown, factory: () => T) {
  logDevFallbackUsed({ kind: "data", source, reason: error });
  return factory();
}

function formatTelegramContact(user: {
  username: string | null;
  firstName: string;
  lastName?: string | null;
}) {
  const fullName = `${user.firstName} ${user.lastName ?? ""}`.trim();
  return fullName || "Пользователь";
}

type ApplicationRecord = {
  id: string;
  shiftPostId: string;
  status: ApplicationStatus;
  message: string | null;
  score: number | null;
  createdAt: Date;
  shiftPost: {
    title: string;
    marketplace: {
      code: "OZON" | "WB" | "YANDEX" | "OTHER";
    };
    createdBy: {
      id: string;
      firstName: string;
      lastName: string | null;
      username: string | null;
      photoUrl: string | null;
    };
  };
  applicant: {
    id: string;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    experienceSummary: string | null;
    district: string | null;
    marketplaces: Array<"OZON" | "WB" | "YANDEX" | "OTHER">;
    ratingAvg: number;
    completedAssignmentsCount: number;
    city: { name: string } | null;
  };
  assignment: {
    id: string;
    status: AssignmentStatus;
    completedAt: Date | null;
    employerUserId: string;
    workerUserId: string;
    reviews: Array<{ authorUserId: string }>;
  } | null;
};

function buildApplicationCard(application: ApplicationRecord) {
  return {
    id: application.id,
    shiftPostId: application.shiftPostId,
    shiftTitle: application.shiftPost.title,
    shiftMarketplace: application.shiftPost.marketplace.code,
    status: application.status,
    message: application.message,
    score: application.score ?? 0,
    createdAt: application.createdAt.toISOString(),
    applicant: {
      id: application.applicant.id,
      firstName: application.applicant.firstName,
      lastName: application.applicant.lastName,
      photoUrl: buildCompactProfilePhotoSource({
        userId: application.applicant.id,
        photoUrl: application.applicant.photoUrl,
      }),
      experienceSummary: application.applicant.experienceSummary,
      cityName: application.applicant.city?.name ?? "Не указан",
      district: application.applicant.district,
      marketplaces: application.applicant.marketplaces,
      ratingAvg: application.applicant.ratingAvg,
      completedAssignmentsCount: application.applicant.completedAssignmentsCount,
    },
    employer: {
      id: application.shiftPost.createdBy.id,
      firstName: application.shiftPost.createdBy.firstName,
      lastName: application.shiftPost.createdBy.lastName,
      username: application.shiftPost.createdBy.username,
      photoUrl: buildCompactProfilePhotoSource({
        userId: application.shiftPost.createdBy.id,
        photoUrl: application.shiftPost.createdBy.photoUrl,
      }),
    },
    assignment: application.assignment
      ? {
          id: application.assignment.id,
          status: application.assignment.status,
          completedAt: application.assignment.completedAt?.toISOString() ?? null,
          employerReviewSubmitted: application.assignment.reviews.some(
            (review) => review.authorUserId === application.assignment?.employerUserId,
          ),
          workerReviewSubmitted: application.assignment.reviews.some(
            (review) => review.authorUserId === application.assignment?.workerUserId,
          ),
        }
      : null,
  };
}

const applicationApplicantSelect = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  experienceSummary: true,
  district: true,
  marketplaces: true,
  ratingAvg: true,
  completedAssignmentsCount: true,
  city: {
    select: {
      name: true,
    },
  },
} as const;

export async function listApplicationsForShift(shiftPostId: string) {
  try {
    const applications = await prisma.application.findMany({
      where: { shiftPostId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        shiftPostId: true,
        status: true,
        message: true,
        score: true,
        createdAt: true,
        applicant: {
          select: applicationApplicantSelect,
        },
        assignment: {
          select: {
            id: true,
            status: true,
            completedAt: true,
            employerUserId: true,
            workerUserId: true,
            reviews: {
              select: {
                authorUserId: true,
              },
            },
          },
        },
        shiftPost: {
          select: {
            title: true,
            marketplace: {
              select: {
                code: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });

    return applications.map(buildApplicationCard);
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return buildDemoFallbackResult("listApplicationsForShift", error, () =>
      demoApplications.filter((application) => application.shiftPostId === shiftPostId),
    );
  }
}

// Лимит «Моих откликов» по умолчанию. У активного работника за сезон
// легко набегает 100+ откликов, и без `take` мы тащили всю историю с
// joins на ShiftPost/createdBy/Assignment/Reviews/Applicant.City. 50
// последних — это «недавняя активность», для архива (если когда-нибудь
// понадобится) можно будет добавить пагинацию по cursor через индекс
// `(applicantUserId, createdAt)`.
const MY_APPLICATIONS_LIMIT = 50;

export async function listMyApplications(userId: string) {
  try {
    const applications = await prisma.application.findMany({
      where: { applicantUserId: userId },
      select: {
        id: true,
        shiftPostId: true,
        status: true,
        message: true,
        score: true,
        createdAt: true,
        shiftPost: {
          select: {
            title: true,
            marketplace: {
              select: {
                code: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
              },
            },
          },
        },
        assignment: {
          select: {
            id: true,
            status: true,
            completedAt: true,
            employerUserId: true,
            workerUserId: true,
            reviews: {
              select: {
                authorUserId: true,
              },
            },
          },
        },
        applicant: {
          select: applicationApplicantSelect,
        },
      },
      orderBy: { createdAt: "desc" },
      take: MY_APPLICATIONS_LIMIT,
    });

    return applications.map(buildApplicationCard);
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return buildDemoFallbackResult("listMyApplications", error, () =>
      demoApplications.filter((application) => application.applicant.id === userId),
    );
  }
}

export async function listApplicationsForEmployer(employerUserId: string) {
  try {
    const applications = await prisma.application.findMany({
      where: {
        shiftPost: {
          createdByUserId: employerUserId,
        },
      },
      select: {
        id: true,
        shiftPostId: true,
        status: true,
        message: true,
        score: true,
        createdAt: true,
        shiftPost: {
          select: {
            title: true,
            marketplace: {
              select: {
                code: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
              },
            },
          },
        },
        assignment: {
          select: {
            id: true,
            status: true,
            completedAt: true,
            employerUserId: true,
            workerUserId: true,
            reviews: {
              select: {
                authorUserId: true,
              },
            },
          },
        },
        applicant: {
          select: applicationApplicantSelect,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      // Тот же резон, что и в listMyApplications: у владельца с
      // десятком активных смен накапливаются сотни откликов в истории.
      // Покажем 50 свежих, остальное — через карточку каждой смены.
      take: MY_APPLICATIONS_LIMIT,
    });

    return applications.map(buildApplicationCard);
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    const myDemoShiftIds = new Set(["shift_1", "shift_3"]);
    return buildDemoFallbackResult("listApplicationsForEmployer", error, () =>
      demoApplications.filter((application) => myDemoShiftIds.has(application.shiftPostId)),
    );
  }
}

/**
 * Возвращает прошлый статус отклика работника для SSR карточки смены.
 * Повторный отклик всё равно запрещён уникальной парой shift/user, но
 * статус нужен UI, чтобы отдельно объяснить добровольный отказ.
 */
export async function getUserApplicationStatusForShift(
  shiftPostId: string,
  applicantUserId: string,
): Promise<ApplicationStatus | null> {
  try {
    const application = await prisma.application.findUnique({
      where: {
        shiftPostId_applicantUserId: {
          shiftPostId,
          applicantUserId,
        },
      },
      select: { status: true },
    });
    return application?.status ?? null;
  } catch (error) {
    // Не валим страницу из-за этой проверки — в худшем случае пользователь
    // увидит активную кнопку и схватит дружелюбную 409 от сервера.
    console.error("[application-service] getUserApplicationStatusForShift failed", error);
    return null;
  }
}

export async function applyToShift(shiftPostId: string, applicantUserId: string, input: unknown) {
  const data = applicationSchema.parse(input);

  try {
    const [applicant, shiftPost] = await Promise.all([
      prisma.user.findUnique({
        where: { id: applicantUserId },
        select: {
          id: true,
          isBanned: true,
          roles: {
            select: {
              role: true,
            },
          },
        },
      }),
      prisma.shiftPost.findUnique({
        where: { id: shiftPostId },
        select: {
          id: true,
          status: true,
          createdByUserId: true,
          shiftDate: true,
          createdBy: {
            select: {
              telegramId: true,
            },
          },
        },
      }),
    ]);

    if (!applicant) {
      throw new Error("applicant_not_found");
    }
    if (applicant.isBanned) {
      throw new Error("applicant_banned");
    }
    if (applicant.roles.some((role) => role.role === "OWNER")) {
      throw new Error("owner_cannot_apply");
    }
    if (!shiftPost) {
      throw new Error("shift_not_found");
    }
    if (shiftPost.createdByUserId === applicantUserId) {
      throw new Error("cannot_apply_to_own_shift");
    }
    if (shiftPost.status !== ShiftPostStatus.PUBLISHED) {
      throw new Error("shift_not_open");
    }

    // Если у работника уже есть подтверждённая смена на этот же день —
    // не даём откликаться на ещё одну, чтобы он физически мог прийти.
    const dayStart = new Date(shiftPost.shiftDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const conflictingAssignment = await prisma.assignment.findFirst({
      where: {
        workerUserId: applicantUserId,
        status: { in: [AssignmentStatus.CONFIRMED, AssignmentStatus.IN_PROGRESS] },
        shiftPost: {
          shiftDate: { gte: dayStart, lt: dayEnd },
        },
      },
      select: { id: true },
    });

    if (conflictingAssignment) {
      throw new Error("already_assigned_on_date");
    }

    try {
      const application = await prisma.application.create({
        data: {
          shiftPostId,
          applicantUserId,
          message: data.message,
          status: ApplicationStatus.APPLIED,
        },
      });

      void sendTelegramMessage({
        chatId: shiftPost.createdBy.telegramId,
        text: "На вашу смену поступил отклик. Откройте приложение, чтобы посмотреть кандидата",
        button: {
          text: "Открыть приложение",
          webAppUrl: getShiftDetailsUrl(shiftPost.id),
        },
      }).catch((error) => {
        console.warn("[tg-notify] application-created employer-msg failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
      });

      return application;
    } catch (createError) {
      // @@unique([shiftPostId, applicantUserId]) — пользователь уже
      // откликался. Превращаем сырое P2002 в дружелюбный business error.
      if (
        createError instanceof Prisma.PrismaClientKnownRequestError &&
        createError.code === "P2002"
      ) {
        throw new Error("already_applied");
      }
      throw createError;
    }
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return buildDemoFallbackResult("applyToShift", error, () => ({
      id: `mock_application_${Date.now()}`,
      shiftPostId,
      applicantUserId,
      message: data.message ?? null,
      status: ApplicationStatus.APPLIED,
    }));
  }
}

export async function confirmApplication(applicationId: string, employerUserId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.application.findUniqueOrThrow({
        where: { id: applicationId },
        include: {
          shiftPost: true,
          applicant: true,
        },
      });

      const employer = await tx.user.findUniqueOrThrow({
        where: { id: employerUserId },
      });

      if (application.shiftPost.createdByUserId !== employerUserId) {
        throw new Error("forbidden");
      }

      const existingAssignment = await tx.assignment.findFirst({
        where: {
          shiftPostId: application.shiftPostId,
          status: { in: [AssignmentStatus.CONFIRMED, AssignmentStatus.IN_PROGRESS] },
        },
      });

      if (existingAssignment) {
        return { assignment: existingAssignment, alreadyConfirmed: true, application, employer };
      }

      const createdAssignment = await tx.assignment.create({
        data: {
          shiftPostId: application.shiftPostId,
          applicationId: application.id,
          workerUserId: application.applicantUserId,
          employerUserId,
          status: AssignmentStatus.CONFIRMED,
        },
      });

      await tx.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.CONFIRMED },
      });

      await tx.application.updateMany({
        where: {
          shiftPostId: application.shiftPostId,
          id: { not: applicationId },
          status: {
            in: [ApplicationStatus.APPLIED, ApplicationStatus.SHORTLISTED],
          },
        },
        data: {
          status: ApplicationStatus.REJECTED,
        },
      });

      await tx.shiftPost.update({
        where: { id: application.shiftPostId },
        data: { status: ShiftPostStatus.MATCHED },
      });

      return { assignment: createdAssignment, alreadyConfirmed: false, application, employer };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Notifications outside the transaction — they must not hold DB locks.
    if (!result.alreadyConfirmed) {
      const { application, employer } = result;
      console.info("[tg-notify] confirm-application contacts", {
        shiftPostId: application.shiftPostId,
        employerUserId,
        employerUsername: employer.username ?? null,
        workerUserId: application.applicantUserId,
        workerUsername: application.applicant.username ?? null,
      });

      void sendTelegramMessage({
        chatId: application.applicant.telegramId,
        text:
          `Вас подтвердили на смену «${application.shiftPost.title}».\n` +
          `Владелец: ${formatTelegramContact({
            username: employer.username,
            firstName: employer.firstName,
            lastName: employer.lastName,
          })}\n` +
          "Откройте приложение, чтобы увидеть детали.",
      }).catch((error) => {
        console.warn("[tg-notify] confirm-application worker-msg failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
      });

      void sendTelegramMessage({
        chatId: employer.telegramId,
        text:
          `Вы подтвердили исполнителя на смену «${application.shiftPost.title}».\n` +
          `Работник: ${formatTelegramContact({
            username: application.applicant.username,
            firstName: application.applicant.firstName,
            lastName: application.applicant.lastName,
          })}`,
      }).catch((error) => {
        console.warn("[tg-notify] confirm-application employer-msg failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
      });
    }

    return result.assignment;
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return buildDemoFallbackResult("confirmApplication", error, () => ({
      id: `mock_assignment_${Date.now()}`,
      applicationId,
      employerUserId,
      status: AssignmentStatus.CONFIRMED,
    }));
  }
}

export async function cancelConfirmedAssignment(assignmentId: string, workerUserId: string) {
  try {
    const assignment = await prisma.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        shiftPost: {
          select: {
            id: true,
            title: true,
          },
        },
        worker: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        employer: {
          select: {
            telegramId: true,
          },
        },
      },
    });

    if (assignment.workerUserId !== workerUserId) {
      throw new Error("forbidden");
    }

    if (assignment.status !== AssignmentStatus.CONFIRMED) {
      throw new Error("assignment_not_cancellable");
    }

    const cancelledAt = new Date();
    const cancelledAssignment = await prisma.$transaction(async (tx) => {
      const transition = await tx.assignment.updateMany({
        where: {
          id: assignmentId,
          workerUserId,
          status: AssignmentStatus.CONFIRMED,
        },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt,
        },
      });

      if (transition.count === 0) {
        throw new Error("assignment_not_cancellable");
      }

      await tx.application.update({
        where: { id: assignment.applicationId },
        data: { status: ApplicationStatus.CANCELLED_BY_WORKER },
      });

      await tx.shiftPost.update({
        where: { id: assignment.shiftPostId },
        data: {
          status: ShiftPostStatus.PUBLISHED,
          closedAt: null,
        },
      });

      return tx.assignment.findUniqueOrThrow({
        where: { id: assignmentId },
      });
    });

    void sendTelegramMessage({
      chatId: assignment.employer.telegramId,
      text:
        `Исполнитель отказался от подтверждённой смены «${assignment.shiftPost.title}».\n` +
        `Сотрудник: ${formatTelegramContact(assignment.worker)}\n` +
        "Объявление снова открыто для откликов.",
    }).catch((error) => {
      console.warn("[tg-notify] cancel-assignment employer-msg failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    });

    return cancelledAssignment;
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return buildDemoFallbackResult("cancelConfirmedAssignment", error, () => ({
      id: assignmentId,
      workerUserId,
      status: AssignmentStatus.CANCELLED,
      cancelledAt: new Date(),
    }));
  }
}

export async function markAssignmentNoShow(assignmentId: string, employerUserId: string) {
  try {
    const assignment = await prisma.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        shiftPost: {
          select: {
            id: true,
            title: true,
            shiftDate: true,
            startAt: true,
          },
        },
        worker: {
          select: {
            telegramId: true,
          },
        },
      },
    });

    if (assignment.employerUserId !== employerUserId) {
      throw new Error("forbidden");
    }

    if (
      assignment.status !== AssignmentStatus.CONFIRMED &&
      assignment.status !== AssignmentStatus.IN_PROGRESS
    ) {
      throw new Error("assignment_not_no_showable");
    }

    const scheduledStart = assignment.shiftPost.startAt ?? assignment.shiftPost.shiftDate;
    if (scheduledStart.getTime() > Date.now()) {
      throw new Error("shift_not_started");
    }

    const markedAt = new Date();
    const noShowAssignment = await prisma.$transaction(async (tx) => {
      const transition = await tx.assignment.updateMany({
        where: {
          id: assignmentId,
          employerUserId,
          status: { in: [AssignmentStatus.CONFIRMED, AssignmentStatus.IN_PROGRESS] },
        },
        data: {
          status: AssignmentStatus.NO_SHOW,
          cancelledAt: markedAt,
        },
      });

      if (transition.count === 0) {
        throw new Error("assignment_not_no_showable");
      }

      await tx.application.update({
        where: { id: assignment.applicationId },
        data: { status: ApplicationStatus.NO_SHOW },
      });

      await tx.shiftPost.update({
        where: { id: assignment.shiftPostId },
        data: {
          status: ShiftPostStatus.CLOSED,
          closedAt: markedAt,
        },
      });

      return tx.assignment.findUniqueOrThrow({
        where: { id: assignmentId },
      });
    });

    void sendTelegramMessage({
      chatId: assignment.worker.telegramId,
      text:
        `По смене «${assignment.shiftPost.title}» работодатель отметил неявку.\n` +
        "Если это ошибка, обратитесь в поддержку через @dooblerhelp_bot.",
    }).catch((error) => {
      console.warn("[tg-notify] no-show worker-msg failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    });

    return noShowAssignment;
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return buildDemoFallbackResult("markAssignmentNoShow", error, () => ({
      id: assignmentId,
      employerUserId,
      status: AssignmentStatus.NO_SHOW,
      cancelledAt: new Date(),
    }));
  }
}

export async function completeAssignment(assignmentId: string, actorUserId: string) {
  try {
    const assignment = await prisma.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        shiftPost: true,
      },
    });

    if (assignment.employerUserId !== actorUserId && assignment.workerUserId !== actorUserId) {
      throw new Error("forbidden");
    }

    if (assignment.status === AssignmentStatus.COMPLETED) {
      return assignment;
    }

    if (
      assignment.status !== AssignmentStatus.CONFIRMED &&
      assignment.status !== AssignmentStatus.IN_PROGRESS
    ) {
      throw new Error("assignment_not_completable");
    }

    const completedAt = new Date();

    const updatedAssignment = await prisma.$transaction(async (tx) => {
      // Atomic transition: only the first call flips the status and increments counters.
      const transition = await tx.assignment.updateMany({
        where: {
          id: assignmentId,
          status: { in: [AssignmentStatus.CONFIRMED, AssignmentStatus.IN_PROGRESS] },
        },
        data: {
          status: AssignmentStatus.COMPLETED,
          completedAt,
        },
      });

      const nextAssignment = await tx.assignment.findUniqueOrThrow({
        where: { id: assignmentId },
      });

      if (transition.count === 0) {
        // Someone else completed it concurrently — skip side effects, return current state.
        return nextAssignment;
      }

      await tx.shiftPost.update({
        where: { id: assignment.shiftPostId },
        data: {
          status: ShiftPostStatus.CLOSED,
          closedAt: completedAt,
        },
      });

      await tx.user.update({
        where: { id: assignment.workerUserId },
        data: {
          completedAssignmentsCount: { increment: 1 },
        },
      });

      await tx.user.update({
        where: { id: assignment.employerUserId },
        data: {
          completedAssignmentsCount: { increment: 1 },
        },
      });

      return nextAssignment;
    });

    // completedAssignmentsCount влияет на бейджи в profile-shell.
    await invalidateCachedUserRecord(updatedAssignment.workerUserId);
    await invalidateCachedUserRecord(updatedAssignment.employerUserId);

    return updatedAssignment;
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return buildDemoFallbackResult("completeAssignment", error, () => ({
      id: assignmentId,
      status: AssignmentStatus.COMPLETED,
    }));
  }
}

export async function createAssignmentReview(
  assignmentId: string,
  authorUserId: string,
  input: unknown,
) {
  const data = reviewSchema.parse(input);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.findUniqueOrThrow({
        where: { id: assignmentId },
        include: {
          employer: true,
          worker: true,
          reviews: true,
        },
      });

      if (assignment.employerUserId !== authorUserId && assignment.workerUserId !== authorUserId) {
        throw new Error("forbidden");
      }

      if (assignment.status !== AssignmentStatus.COMPLETED) {
        throw new Error("assignment_not_completed");
      }

      if (assignment.reviews.some((review) => review.authorUserId === authorUserId)) {
        throw new Error("review_already_exists");
      }

      const subjectUserId =
        assignment.employerUserId === authorUserId
          ? assignment.workerUserId
          : assignment.employerUserId;

      const createdReview = await tx.review.create({
        data: {
          assignmentId,
          authorUserId,
          subjectUserId,
          rating: data.rating,
          text: data.text,
          tags: [],
        },
      });

      const aggregate = await tx.review.aggregate({
        where: { subjectUserId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.user.update({
        where: { id: subjectUserId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count.rating,
        },
      });

      // ratingAvg/ratingCount тоже в кешируемом select — сбрасываем,
      // чтобы новый рейтинг отразился в Mini App сразу.
      await invalidateCachedUserRecord(subjectUserId);

      const subjectUser =
        subjectUserId === assignment.workerUserId ? assignment.worker : assignment.employer;

      return { review: createdReview, subjectTelegramId: subjectUser.telegramId };
    });

    void sendTelegramMessage({
      chatId: result.subjectTelegramId,
      text: "По вашей завершённой смене оставили отзыв. Откройте приложение, чтобы посмотреть детали.",
    }).catch((error) => {
      console.warn("[tg-notify] review-message failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    });

    return result.review;
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return buildDemoFallbackResult("createAssignmentReview", error, () => ({
      id: `mock_review_${Date.now()}`,
      assignmentId,
      authorUserId,
      rating: data.rating,
      text: data.text,
    }));
  }
}

export type UpcomingAssignmentSummary = {
  id: string;
  status: AssignmentStatus;
  shiftPost: {
    id: string;
    title: string;
    address: string;
    district: string;
    shiftDate: Date;
    startAt: Date | null;
    endAt: Date | null;
    cityName: string | null;
  };
  employer: {
    id: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
  };
};

// Возвращает ближайшую подтверждённую (или активную) смену для работника —
// нужна для блока «спасибо за отклик, X ждёт вас по адресу Y» на главной.
export async function getUpcomingAssignmentForWorker(
  workerUserId: string,
): Promise<UpcomingAssignmentSummary | null> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assignment = await prisma.assignment.findFirst({
      where: {
        workerUserId,
        status: { in: [AssignmentStatus.CONFIRMED, AssignmentStatus.IN_PROGRESS] },
        shiftPost: { shiftDate: { gte: today } },
      },
      orderBy: { shiftPost: { shiftDate: "asc" } },
      select: {
        id: true,
        status: true,
        shiftPost: {
          select: {
            id: true,
            title: true,
            address: true,
            district: true,
            shiftDate: true,
            startAt: true,
            endAt: true,
            city: { select: { name: true } },
          },
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });

    if (!assignment) {
      return null;
    }

    return {
      id: assignment.id,
      status: assignment.status,
      shiftPost: {
        id: assignment.shiftPost.id,
        title: assignment.shiftPost.title,
        address: assignment.shiftPost.address,
        district: assignment.shiftPost.district,
        shiftDate: assignment.shiftPost.shiftDate,
        startAt: assignment.shiftPost.startAt,
        endAt: assignment.shiftPost.endAt,
        cityName: assignment.shiftPost.city?.name ?? null,
      },
      employer: {
        ...assignment.employer,
        photoUrl: buildCompactProfilePhotoSource({
          userId: assignment.employer.id,
          photoUrl: assignment.employer.photoUrl,
        }),
      },
    };
  } catch (error) {
    console.error("[application-service] getUpcomingAssignmentForWorker failed", {
      workerUserId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}
