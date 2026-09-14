import { z, ZodError } from "zod";

import { MarketplaceCode } from "@/generated/prisma/client";
import { fail, ok } from "@/lib/api";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import {
  getShiftNotificationFilter,
  setShiftNotificationFilterEnabled,
  upsertShiftNotificationFilter,
} from "@/server/services/shift-notification-service";

const filterSchema = z.object({
  isEnabled: z.boolean().optional(),
  cityId: z.string().trim().min(1).nullable().optional(),
  district: z.string().trim().max(80).nullable().optional(),
  marketplaceCodes: z.array(z.enum(MarketplaceCode)).max(4).optional(),
  urgentOnly: z.boolean().optional(),
  paymentMinRub: z.number().int().positive().max(1_000_000).nullable().optional(),
  paymentMaxRub: z.number().int().positive().max(1_000_000).nullable().optional(),
});

export async function GET() {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const filter = await getShiftNotificationFilter(session.userId);
  return ok({ filter });
}

export async function PUT(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  try {
    const body = await request.json();
    const data = filterSchema.parse(body);

    if (data.paymentMinRub && data.paymentMaxRub && data.paymentMinRub > data.paymentMaxRub) {
      return fail("Минимальная оплата не может быть больше максимальной.", 400);
    }

    const filter = await upsertShiftNotificationFilter(session.userId, data);
    return ok({ filter });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(error.issues[0]?.message ?? "Проверьте фильтр уведомлений.", 400);
    }

    console.error("[shift-notification-filter] update failed", error);
    return fail("Не удалось сохранить фильтр уведомлений.", 500);
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  try {
    const body = (await request.json()) as { isEnabled?: unknown };
    if (typeof body.isEnabled !== "boolean") {
      return fail("Передайте isEnabled.", 400);
    }

    await setShiftNotificationFilterEnabled(session.userId, body.isEnabled);
    const filter = await getShiftNotificationFilter(session.userId);
    return ok({ filter });
  } catch (error) {
    console.error("[shift-notification-filter] patch failed", error);
    return fail("Не удалось изменить уведомления.", 500);
  }
}
