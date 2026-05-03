import { afterEach, describe, expect, it, vi } from "vitest";

const { prisma, tx, sendTelegramMessage } = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    shiftPost: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    assignment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    application: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    review: {
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  tx: {
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    shiftPost: {
      update: vi.fn(),
    },
    assignment: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    application: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    review: {
      create: vi.fn(),
      aggregate: vi.fn(),
    },
  },
  sendTelegramMessage: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("@/lib/prisma", () => ({
  prisma,
}));

vi.mock("@/lib/notifications/telegram", () => ({
  sendTelegramMessage,
}));

vi.mock("@/lib/dev-fallback", () => ({
  isDevFallbackEnabled: vi.fn(() => false),
  logDevFallbackUsed: vi.fn(),
}));

import {
  applyToShift,
  completeAssignment,
  confirmApplication,
  createAssignmentReview,
} from "./application-service";

describe("applyToShift", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates an application when applicant is active and shift is open", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "worker-1",
      isBanned: false,
      roles: [],
    });
    prisma.shiftPost.findUnique.mockResolvedValue({
      id: "shift-1",
      status: "PUBLISHED",
      createdByUserId: "owner-1",
      shiftDate: new Date("2026-05-10T09:00:00.000Z"),
    });
    prisma.assignment.findFirst.mockResolvedValue(null);
    prisma.application.create.mockResolvedValue({
      id: "application-1",
      shiftPostId: "shift-1",
      applicantUserId: "worker-1",
      status: "APPLIED",
      message: "Готов выйти на смену",
    });

    const result = await applyToShift("shift-1", "worker-1", {
      message: "Готов выйти на смену",
    });

    expect(prisma.application.create).toHaveBeenCalledWith({
      data: {
        shiftPostId: "shift-1",
        applicantUserId: "worker-1",
        message: "Готов выйти на смену",
        status: "APPLIED",
      },
    });
    expect(result).toMatchObject({
      id: "application-1",
      shiftPostId: "shift-1",
      applicantUserId: "worker-1",
      status: "APPLIED",
    });
  });

  it("rejects applications to the applicant's own shift", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      isBanned: false,
      roles: [],
    });
    prisma.shiftPost.findUnique.mockResolvedValue({
      id: "shift-1",
      status: "PUBLISHED",
      createdByUserId: "owner-1",
      shiftDate: new Date("2026-05-10T09:00:00.000Z"),
    });

    await expect(
      applyToShift("shift-1", "owner-1", {
        message: "Попробую сам",
      }),
    ).rejects.toThrow("cannot_apply_to_own_shift");

    expect(prisma.assignment.findFirst).not.toHaveBeenCalled();
    expect(prisma.application.create).not.toHaveBeenCalled();
  });

  it("rejects applications when the shift is not published", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "worker-1",
      isBanned: false,
      roles: [],
    });
    prisma.shiftPost.findUnique.mockResolvedValue({
      id: "shift-1",
      status: "MATCHED",
      createdByUserId: "owner-1",
      shiftDate: new Date("2026-05-10T09:00:00.000Z"),
    });

    await expect(
      applyToShift("shift-1", "worker-1", {
        message: null,
      }),
    ).rejects.toThrow("shift_not_open");

    expect(prisma.assignment.findFirst).not.toHaveBeenCalled();
    expect(prisma.application.create).not.toHaveBeenCalled();
  });

  it("rejects applications when the worker already has a confirmed assignment that day", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "worker-1",
      isBanned: false,
      roles: [],
    });
    prisma.shiftPost.findUnique.mockResolvedValue({
      id: "shift-1",
      status: "PUBLISHED",
      createdByUserId: "owner-1",
      shiftDate: new Date("2026-05-10T09:00:00.000Z"),
    });
    prisma.assignment.findFirst.mockResolvedValue({
      id: "assignment-1",
    });

    await expect(
      applyToShift("shift-1", "worker-1", {
        message: "Свободен в этот день",
      }),
    ).rejects.toThrow("already_assigned_on_date");

    expect(prisma.application.create).not.toHaveBeenCalled();
  });

  it("rejects applications from users with the OWNER role", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "owner-worker-1",
      isBanned: false,
      roles: [{ role: "OWNER" }],
    });
    prisma.shiftPost.findUnique.mockResolvedValue({
      id: "shift-1",
      status: "PUBLISHED",
      createdByUserId: "owner-2",
      shiftDate: new Date("2026-05-10T09:00:00.000Z"),
    });

    await expect(
      applyToShift("shift-1", "owner-worker-1", {
        message: "Хочу откликнуться как владелец",
      }),
    ).rejects.toThrow("owner_cannot_apply");

    expect(prisma.assignment.findFirst).not.toHaveBeenCalled();
    expect(prisma.application.create).not.toHaveBeenCalled();
  });
});

describe("confirmApplication", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates an assignment, updates statuses, and notifies both sides", async () => {
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    tx.application.findUniqueOrThrow.mockResolvedValue({
      id: "application-1",
      shiftPostId: "shift-1",
      applicantUserId: "worker-1",
      shiftPost: {
        createdByUserId: "owner-1",
        title: "Смена на завтра",
      },
      applicant: {
        telegramId: "10002",
        username: "worker_user",
        firstName: "Иван",
        lastName: "Петров",
      },
    });
    tx.user.findUniqueOrThrow.mockResolvedValue({
      id: "owner-1",
      telegramId: "10001",
      username: "owner_user",
      firstName: "Анна",
      lastName: "Левина",
    });
    tx.assignment.findUnique.mockResolvedValue(null);
    tx.assignment.create.mockResolvedValue({
      id: "assignment-1",
      shiftPostId: "shift-1",
      applicationId: "application-1",
      workerUserId: "worker-1",
      employerUserId: "owner-1",
      status: "CONFIRMED",
    });
    tx.application.update.mockResolvedValue({});
    tx.application.updateMany.mockResolvedValue({ count: 1 });
    tx.shiftPost.update.mockResolvedValue({});

    const result = await confirmApplication("application-1", "owner-1");

    expect(tx.assignment.create).toHaveBeenCalledWith({
      data: {
        shiftPostId: "shift-1",
        applicationId: "application-1",
        workerUserId: "worker-1",
        employerUserId: "owner-1",
        status: "CONFIRMED",
      },
    });
    expect(tx.application.update).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: { status: "CONFIRMED" },
    });
    expect(tx.application.updateMany).toHaveBeenCalled();
    expect(tx.shiftPost.update).toHaveBeenCalledWith({
      where: { id: "shift-1" },
      data: { status: "MATCHED" },
    });
    expect(sendTelegramMessage).toHaveBeenCalledTimes(2);
    expect(sendTelegramMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ chatId: "10002" }),
    );
    expect(sendTelegramMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ chatId: "10001" }),
    );
    expect(result).toMatchObject({
      id: "assignment-1",
      shiftPostId: "shift-1",
      applicationId: "application-1",
      status: "CONFIRMED",
    });
  });

  it("returns the existing assignment without side effects when already confirmed", async () => {
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    tx.application.findUniqueOrThrow.mockResolvedValue({
      id: "application-1",
      shiftPostId: "shift-1",
      applicantUserId: "worker-1",
      shiftPost: {
        createdByUserId: "owner-1",
        title: "Смена на завтра",
      },
      applicant: {
        telegramId: "10002",
        username: "worker_user",
        firstName: "Иван",
        lastName: "Петров",
      },
    });
    tx.user.findUniqueOrThrow.mockResolvedValue({
      id: "owner-1",
      telegramId: "10001",
      username: "owner_user",
      firstName: "Анна",
      lastName: "Левина",
    });
    tx.assignment.findUnique.mockResolvedValue({
      id: "assignment-existing",
      shiftPostId: "shift-1",
      applicationId: "application-1",
      workerUserId: "worker-1",
      employerUserId: "owner-1",
      status: "CONFIRMED",
    });

    const result = await confirmApplication("application-1", "owner-1");

    expect(tx.assignment.create).not.toHaveBeenCalled();
    expect(tx.application.update).not.toHaveBeenCalled();
    expect(tx.application.updateMany).not.toHaveBeenCalled();
    expect(tx.shiftPost.update).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: "assignment-existing",
      shiftPostId: "shift-1",
      applicationId: "application-1",
      status: "CONFIRMED",
    });
  });

  it("rejects confirmation from a user who does not own the shift", async () => {
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    tx.application.findUniqueOrThrow.mockResolvedValue({
      id: "application-1",
      shiftPostId: "shift-1",
      applicantUserId: "worker-1",
      shiftPost: {
        createdByUserId: "owner-1",
        title: "Смена на завтра",
      },
      applicant: {
        telegramId: "10002",
        username: "worker_user",
        firstName: "Иван",
        lastName: "Петров",
      },
    });
    tx.user.findUniqueOrThrow.mockResolvedValue({
      id: "intruder",
      telegramId: "10003",
      username: "intruder_user",
      firstName: "Никита",
      lastName: "Смирнов",
    });

    await expect(confirmApplication("application-1", "intruder")).rejects.toThrow("forbidden");

    expect(tx.assignment.findUnique).not.toHaveBeenCalled();
    expect(tx.assignment.create).not.toHaveBeenCalled();
    expect(tx.application.update).not.toHaveBeenCalled();
    expect(tx.shiftPost.update).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });
});

describe("completeAssignment", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("closes the shift and increments counters on the first completion", async () => {
    prisma.assignment.findUniqueOrThrow.mockResolvedValue({
      id: "assignment-1",
      shiftPostId: "shift-1",
      employerUserId: "owner-1",
      workerUserId: "worker-1",
      status: "CONFIRMED",
    });
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.assignment.updateMany.mockResolvedValue({ count: 1 });
    tx.assignment.findUniqueOrThrow.mockResolvedValue({
      id: "assignment-1",
      status: "COMPLETED",
      completedAt: new Date("2026-05-10T18:00:00.000Z"),
    });
    tx.shiftPost.update.mockResolvedValue({});
    tx.user.update.mockResolvedValue({});

    const result = await completeAssignment("assignment-1", "owner-1");

    expect(tx.assignment.updateMany).toHaveBeenCalledWith({
      where: {
        id: "assignment-1",
        status: { not: "COMPLETED" },
      },
      data: expect.objectContaining({
        status: "COMPLETED",
        completedAt: expect.any(Date),
      }),
    });
    expect(tx.shiftPost.update).toHaveBeenCalledWith({
      where: { id: "shift-1" },
      data: expect.objectContaining({
        status: "CLOSED",
        closedAt: expect.any(Date),
      }),
    });
    expect(tx.user.update).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      id: "assignment-1",
      status: "COMPLETED",
    });
  });

  it("rejects completion from a user outside the assignment", async () => {
    prisma.assignment.findUniqueOrThrow.mockResolvedValue({
      id: "assignment-1",
      shiftPostId: "shift-1",
      employerUserId: "owner-1",
      workerUserId: "worker-1",
      status: "CONFIRMED",
    });

    await expect(completeAssignment("assignment-1", "intruder")).rejects.toThrow("forbidden");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns the completed assignment as-is without extra side effects", async () => {
    prisma.assignment.findUniqueOrThrow.mockResolvedValue({
      id: "assignment-1",
      shiftPostId: "shift-1",
      employerUserId: "owner-1",
      workerUserId: "worker-1",
      status: "COMPLETED",
      completedAt: new Date("2026-05-10T18:00:00.000Z"),
    });

    const result = await completeAssignment("assignment-1", "owner-1");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: "assignment-1",
      status: "COMPLETED",
    });
  });
});

describe("createAssignmentReview", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a review, recalculates rating, and notifies the subject", async () => {
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.assignment.findUniqueOrThrow.mockResolvedValue({
      id: "assignment-1",
      employerUserId: "owner-1",
      workerUserId: "worker-1",
      status: "COMPLETED",
      employer: {
        telegramId: "10001",
      },
      worker: {
        telegramId: "10002",
      },
      reviews: [],
    });
    tx.review.create.mockResolvedValue({
      id: "review-1",
      assignmentId: "assignment-1",
      authorUserId: "owner-1",
      subjectUserId: "worker-1",
      rating: 5,
      text: "Отлично",
      tags: [],
    });
    tx.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    });
    tx.user.update.mockResolvedValue({});

    const result = await createAssignmentReview("assignment-1", "owner-1", {
      rating: 5,
      text: "Отлично",
    });

    expect(tx.review.create).toHaveBeenCalledWith({
      data: {
        assignmentId: "assignment-1",
        authorUserId: "owner-1",
        subjectUserId: "worker-1",
        rating: 5,
        text: "Отлично",
        tags: [],
      },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "worker-1" },
      data: {
        ratingAvg: 4.5,
        ratingCount: 2,
      },
    });
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "10002" }),
    );
    expect(result).toMatchObject({
      id: "review-1",
      assignmentId: "assignment-1",
      authorUserId: "owner-1",
      subjectUserId: "worker-1",
      rating: 5,
    });
  });

  it("rejects a duplicate review from the same author", async () => {
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.assignment.findUniqueOrThrow.mockResolvedValue({
      id: "assignment-1",
      employerUserId: "owner-1",
      workerUserId: "worker-1",
      status: "COMPLETED",
      employer: {
        telegramId: "10001",
      },
      worker: {
        telegramId: "10002",
      },
      reviews: [{ authorUserId: "owner-1" }],
    });

    await expect(
      createAssignmentReview("assignment-1", "owner-1", {
        rating: 5,
        text: "Очень хорошо",
      }),
    ).rejects.toThrow("review_already_exists");

    expect(tx.review.create).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("rejects reviews before the assignment is completed", async () => {
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.assignment.findUniqueOrThrow.mockResolvedValue({
      id: "assignment-1",
      employerUserId: "owner-1",
      workerUserId: "worker-1",
      status: "CONFIRMED",
      employer: {
        telegramId: "10001",
      },
      worker: {
        telegramId: "10002",
      },
      reviews: [],
    });

    await expect(
      createAssignmentReview("assignment-1", "owner-1", {
        rating: 5,
        text: "Спасибо за смену",
      }),
    ).rejects.toThrow("assignment_not_completed");

    expect(tx.review.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });
});
