import { z } from "zod";

import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { checkInMemoryRateLimit } from "@/lib/rate-limit/in-memory";
import { buildRateLimitResponse } from "@/lib/rate-limit/response";

// Анти-спам жалоб: жалобы — приоритетная очередь модератора, легко завалить
// мусором. 10 жалоб в час и 30 в день per-user — щедро для добросовестного
// репортера и узко для зловреда-боттера.
const REPORTS_PER_HOUR = { windowMs: 60 * 60_000, max: 10 } as const;
const REPORTS_PER_DAY = { windowMs: 24 * 60 * 60_000, max: 30 } as const;

// Валидация жалобы:
// - targetType: только из enum схемы (Prisma всё равно отвергнет другое,
//   но мы хотим понятный 400 вместо 500).
// - targetId: cuid-подобный id, до 64 символов — отрезаем мусор и попытки
//   запихать туда сотни KB.
// - reasonCode: короткий код (snake_case), белый список длины.
// - description: ограничен 2000 символами, чтобы не дать спамить мегабайтами
//   текста и раздувать DB / админскую очередь.
const reportSchema = z.object({
  targetType: z.enum([
    "USER",
    "SHIFT_POST",
    "APPLICATION",
    "ASSIGNMENT",
    "REVIEW",
    "PICKUP_POINT",
  ]),
  targetId: z.string().trim().min(1).max(64),
  reasonCode: z.string().trim().min(1).max(64),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((value) => value ?? null),
});

const SHIFT_REPORT_RISK: Record<string, "LOW" | "MEDIUM" | "HIGH"> = {
  fake_shift: "HIGH",
  suspicious_employer: "HIGH",
  payment_issue: "HIGH",
  wrong_shift_info: "MEDIUM",
  rude_communication: "MEDIUM",
};

async function validateReportTarget(input: {
  reporterUserId: string;
  targetType: z.infer<typeof reportSchema>["targetType"];
  targetId: string;
  reasonCode: string;
}) {
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";

  if (input.targetType === "USER") {
    const user = await prisma.user.findUnique({
      where: { id: input.targetId },
      select: { id: true },
    });
    if (!user) {
      return { ok: false as const, message: "Пользователь не найден.", status: 404 };
    }
    if (user.id === input.reporterUserId) {
      return { ok: false as const, message: "Нельзя отправить жалобу на себя.", status: 403 };
    }
  } else if (input.targetType === "APPLICATION") {
    const application = await prisma.application.findUnique({
      where: { id: input.targetId },
      select: {
        applicantUserId: true,
        shiftPost: { select: { createdByUserId: true } },
      },
    });
    if (!application) {
      return { ok: false as const, message: "Отклик не найден.", status: 404 };
    }
    const isParticipant =
      application.applicantUserId === input.reporterUserId ||
      application.shiftPost.createdByUserId === input.reporterUserId;
    if (!isParticipant) {
      return { ok: false as const, message: "Нет доступа к этому отклику.", status: 403 };
    }
    riskLevel = "MEDIUM";
  } else if (input.targetType === "ASSIGNMENT") {
    const assignment = await prisma.assignment.findUnique({
      where: { id: input.targetId },
      select: { workerUserId: true, employerUserId: true },
    });
    if (!assignment) {
      return { ok: false as const, message: "Назначение не найдено.", status: 404 };
    }
    const isParticipant =
      assignment.workerUserId === input.reporterUserId ||
      assignment.employerUserId === input.reporterUserId;
    if (!isParticipant) {
      return { ok: false as const, message: "Нет доступа к этому назначению.", status: 403 };
    }
    riskLevel = "MEDIUM";
  } else if (input.targetType === "REVIEW") {
    const review = await prisma.review.findUnique({
      where: { id: input.targetId },
      select: { authorUserId: true, subjectUserId: true },
    });
    if (!review) {
      return { ok: false as const, message: "Отзыв не найден.", status: 404 };
    }
    const isParticipant =
      review.authorUserId === input.reporterUserId ||
      review.subjectUserId === input.reporterUserId;
    if (!isParticipant) {
      return { ok: false as const, message: "Нет доступа к этому отзыву.", status: 403 };
    }
    riskLevel = "MEDIUM";
  } else if (input.targetType === "PICKUP_POINT") {
    const pickupPoint = await prisma.pickupPoint.findUnique({
      where: { id: input.targetId },
      select: { id: true },
    });
    if (!pickupPoint) {
      return { ok: false as const, message: "ПВЗ не найден.", status: 404 };
    }
  }

  if (input.targetType === "SHIFT_POST") {
  const shift = await prisma.shiftPost.findUnique({
    where: { id: input.targetId },
    select: { id: true, createdByUserId: true },
  });

  if (!shift) {
    return { ok: false as const, message: "Смена не найдена.", status: 404 };
  }

  if (shift.createdByUserId === input.reporterUserId) {
    return {
      ok: false as const,
      message: "Нельзя отправить жалобу на свою смену.",
      status: 403,
    };
  }
    riskLevel = SHIFT_REPORT_RISK[input.reasonCode] ?? "LOW";
  }

  const existingOpenReport = await prisma.report.findFirst({
    where: {
      reporterUserId: input.reporterUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      status: { in: ["OPEN", "IN_REVIEW"] },
    },
    select: { id: true },
  });

  if (existingOpenReport) {
    return {
      ok: false as const,
      message: "Вы уже отправили жалобу на эту смену. Модератор её проверит.",
      status: 409,
    };
  }

  return {
    ok: true as const,
    riskLevel,
  };
}

export async function GET() {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  try {
    const reports = await prisma.report.findMany({
      where: { reporterUserId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return ok({ reports });
  } catch {
    return ok({ reports: [] });
  }
}

export async function POST(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = reportSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  const hourCheck = await checkInMemoryRateLimit({
    key: `reports-hour:${session.userId}`,
    ...REPORTS_PER_HOUR,
  });
  if (!hourCheck.ok) {
    return buildRateLimitResponse(hourCheck.retryAfterMs);
  }

  const dayCheck = await checkInMemoryRateLimit({
    key: `reports-day:${session.userId}`,
    ...REPORTS_PER_DAY,
  });
  if (!dayCheck.ok) {
    return buildRateLimitResponse(
      dayCheck.retryAfterMs,
      "Дневной лимит жалоб исчерпан.",
    );
  }

  try {
    const targetValidation = await validateReportTarget({
      reporterUserId: session.userId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reasonCode: parsed.data.reasonCode,
    });

    if (!targetValidation.ok) {
      return fail(targetValidation.message, targetValidation.status);
    }

    const report = await prisma.report.create({
      data: {
        reporterUserId: session.userId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        reasonCode: parsed.data.reasonCode,
        description: parsed.data.description,
        riskLevel: targetValidation.riskLevel,
      },
    });

    return ok({ report }, { status: 201 });
  } catch (error) {
    console.error("[reports] create failed", error);
    return fail("Не удалось создать обращение.", 500);
  }
}
