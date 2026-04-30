import { z } from "zod";

import { fail, ok } from "@/lib/api";
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

export async function GET() {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  try {
    const reports = await prisma.report.findMany({
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

  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = reportSchema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Некорректный запрос.", 400);
  }

  const hourCheck = checkInMemoryRateLimit({
    key: `reports-hour:${session.userId}`,
    ...REPORTS_PER_HOUR,
  });
  if (!hourCheck.ok) {
    return buildRateLimitResponse(hourCheck.retryAfterMs);
  }

  const dayCheck = checkInMemoryRateLimit({
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
    const report = await prisma.report.create({
      data: {
        reporterUserId: session.userId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        reasonCode: parsed.data.reasonCode,
        description: parsed.data.description,
      },
    });

    return ok({ report }, { status: 201 });
  } catch (error) {
    console.error("[reports] create failed", error);
    return fail("Не удалось создать обращение.", 500);
  }
}
