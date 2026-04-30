import {
  ApplicationStatus,
  AssignmentStatus,
  ShiftPostStatus,
} from "@/generated/prisma/client";

import { demoApplications } from "@/lib/demo-data";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { prisma } from "@/lib/prisma";
import { applicationSchema, reviewSchema } from "@/lib/validations/shift-post";

function allowDevDataFallback() {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_DATA_FALLBACK === "true";
}

function shouldUseDemoFallback(error: unknown) {
  if (!allowDevDataFallback()) {
    return false;
  }

  if (error instanceof Error) {
    const businessErrors = new Set([
      "forbidden",
      "assignment_not_completed",
      "applicant_not_found",
      "applicant_banned",
      "shift_not_found",
      "shift_not_open",
      "cannot_apply_to_own_shift",
      "already_assigned_on_date",
      "review_already_exists",
    ]);
    if (businessErrors.has(error.message)) {
      return false;
    }
  }

  return true;
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
    telegramId: string;
    firstName: string;
    lastName: string | null;
    age: number | null;
    username: string | null;
    photoUrl: string | null;
    experienceSummary: string | null;
    district: string | null;
    marketplaces: Array<"OZON" | "WB" | "YANDEX" | "OTHER">;
    ratingAvg: number;
    ratingCount: number;
    completedAssignmentsCount: number;
    city: { name: string } | null;
    roles: Array<{ role: "OWNER" | "MANAGER" | "EMPLOYEE" | "TEMP_WORKER" | "MODERATOR" }>;
    verifications: Array<{ status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" }>;
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
    status: application.status,
    message: application.message,
    score: application.score ?? 0,
    createdAt: application.createdAt.toISOString(),
    applicant: {
      id: application.applicant.id,
      telegramId: application.applicant.telegramId,
      firstName: application.applicant.firstName,
      lastName: application.applicant.lastName,
      age: application.applicant.age,
      username: application.applicant.username,
      photoUrl: application.applicant.photoUrl,
      pickupPointCode: null,
      experienceSummary: application.applicant.experienceSummary,
      isOnboardingCompleted: true,
      cityName: application.applicant.city?.name ?? "Не указан",
      district: application.applicant.district,
      roles: application.applicant.roles.map((role) => role.role),
      marketplaces: application.applicant.marketplaces,
      ratingAvg: application.applicant.ratingAvg,
      ratingCount: application.applicant.ratingCount,
      completedAssignmentsCount: application.applicant.completedAssignmentsCount,
      verificationStatus: application.applicant.verifications[0]?.status ?? "PENDING",
    },
    employer: {
      id: application.shiftPost.createdBy.id,
      firstName: application.shiftPost.createdBy.firstName,
      lastName: application.shiftPost.createdBy.lastName,
      username: application.shiftPost.createdBy.username,
      photoUrl: application.shiftPost.createdBy.photoUrl,
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
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            age: true,
            username: true,
            photoUrl: true,
            experienceSummary: true,
            district: true,
            marketplaces: true,
            ratingAvg: true,
            ratingCount: true,
            completedAssignmentsCount: true,
            roles: true,
            city: {
              select: {
                name: true,
              },
            },
            verifications: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                status: true,
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
        shiftPost: {
          select: {
            title: true,
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
    return demoApplications.filter((application) => application.shiftPostId === shiftPostId);
  }
}

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
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            age: true,
            username: true,
            photoUrl: true,
            experienceSummary: true,
            district: true,
            marketplaces: true,
            ratingAvg: true,
            ratingCount: true,
            completedAssignmentsCount: true,
            roles: true,
            city: {
              select: {
                name: true,
              },
            },
            verifications: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return applications.map(buildApplicationCard);
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return demoApplications.filter((application) => application.applicant.id === userId);
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
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            age: true,
            username: true,
            photoUrl: true,
            experienceSummary: true,
            district: true,
            marketplaces: true,
            ratingAvg: true,
            ratingCount: true,
            completedAssignmentsCount: true,
            roles: true,
            city: {
              select: {
                name: true,
              },
            },
            verifications: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                status: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return applications.map(buildApplicationCard);
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    const myDemoShiftIds = new Set(["shift_1", "shift_3"]);
    return demoApplications.filter((application) => myDemoShiftIds.has(application.shiftPostId));
  }
}

export async function applyToShift(shiftPostId: string, applicantUserId: string, input: unknown) {
  const data = applicationSchema.parse(input);

  try {
    const [applicant, shiftPost] = await Promise.all([
      prisma.user.findUnique({
        where: { id: applicantUserId },
        select: { id: true, isBanned: true },
      }),
      prisma.shiftPost.findUnique({
        where: { id: shiftPostId },
        select: { id: true, status: true, createdByUserId: true, shiftDate: true },
      }),
    ]);

    if (!applicant) {
      throw new Error("applicant_not_found");
    }
    if (applicant.isBanned) {
      throw new Error("applicant_banned");
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

    const application = await prisma.application.create({
      data: {
        shiftPostId,
        applicantUserId,
        message: data.message,
        status: ApplicationStatus.APPLIED,
      },
    });

    return application;
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return {
      id: `mock_application_${Date.now()}`,
      shiftPostId,
      applicantUserId,
      message: data.message ?? null,
      status: ApplicationStatus.APPLIED,
    };
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

      const existingAssignment = await tx.assignment.findUnique({
        where: { shiftPostId: application.shiftPostId },
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
    });

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
          "Откройте Mini App, чтобы увидеть детали.",
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
    return {
      id: `mock_assignment_${Date.now()}`,
      applicationId,
      employerUserId,
      status: AssignmentStatus.CONFIRMED,
    };
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

    const completedAt = new Date();

    const updatedAssignment = await prisma.$transaction(async (tx) => {
      // Atomic transition: only the first call flips the status and increments counters.
      const transition = await tx.assignment.updateMany({
        where: {
          id: assignmentId,
          status: { not: AssignmentStatus.COMPLETED },
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

    return updatedAssignment;
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }
    return {
      id: assignmentId,
      status: AssignmentStatus.COMPLETED,
    };
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

      const subjectUser =
        subjectUserId === assignment.workerUserId ? assignment.worker : assignment.employer;

      return { review: createdReview, subjectTelegramId: subjectUser.telegramId };
    });

    void sendTelegramMessage({
      chatId: result.subjectTelegramId,
      text: "По вашей завершённой смене оставили отзыв. Откройте Mini App, чтобы посмотреть детали.",
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
    return {
      id: `mock_review_${Date.now()}`,
      assignmentId,
      authorUserId,
      rating: data.rating,
      text: data.text,
    };
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
      employer: assignment.employer,
    };
  } catch (error) {
    console.error("[application-service] getUpcomingAssignmentForWorker failed", {
      workerUserId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}
