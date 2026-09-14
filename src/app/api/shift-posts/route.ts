import { ZodError } from "zod";

import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { getSessionPayload } from "@/lib/auth/session";
import { canCreateShiftPosts } from "@/lib/profile-completion";
import { enforceUserRateLimit } from "@/lib/rate-limit/user";
import { getEmployerVerificationStatus } from "@/server/services/employer-verification-service";
import { createShiftPost, listShiftPosts } from "@/server/services/shift-post-service";

function parseMoneyFilter(value: string | null) {
  if (!value?.trim()) {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const shiftPosts = await listShiftPosts({
    cityId: searchParams.get("cityId"),
    district: searchParams.get("district"),
    marketplaceId: searchParams.get("marketplaceId"),
    marketplaceCode: searchParams.get("marketplace"),
    urgentOnly: searchParams.get("urgentOnly") === "true",
    search: searchParams.get("search"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    paymentMin: parseMoneyFilter(searchParams.get("paymentMin")),
    paymentMax: parseMoneyFilter(searchParams.get("paymentMax")),
  });

  return ok({ shiftPosts });
}

export async function POST(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  // Создание смены — тяжёлый write (валидация, геокодинг адреса,
  // нотификации, инвалидация кеша ленты). Жёсткий per-user-лимит, иначе
  // один владелец ПВЗ может за минуту наспамить десятки одинаковых постов.
  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  const limited = await enforceUserRateLimit({
    userId: session.userId,
    scope: "shift-post-create",
    limits: [
      { windowMs: 60_000, max: 5, label: "minute" },
      { windowMs: 60 * 60_000, max: 30, label: "hour" },
    ],
    message: "Слишком много новых смен подряд. Попробуйте через минуту.",
  });
  if (limited) return limited;

  const currentUser = await getCurrentUser();
  const roles =
    currentUser && "roles" in currentUser
      ? currentUser.roles.map((role) => (typeof role === "string" ? role : role.role))
      : [];

  const employerVerificationStatus = await getEmployerVerificationStatus(session.userId);

  if (!canCreateShiftPosts(roles, employerVerificationStatus)) {
    if (roles.includes("OWNER") || roles.includes("MANAGER")) {
      return fail(
        "Сначала пройдите проверку работодателя: загрузите документ, подтверждающий владение или управление ПВЗ, и дождитесь одобрения.",
        403,
      );
    }

    return fail("Создавать смены может только владелец или управляющий ПВЗ.", 403);
  }

  try {
    const body = await request.json();
    const result = await createShiftPost(body, session.userId);

    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(error.issues[0]?.message ?? "Проверьте поля объявления.", 400);
    }

    if (error instanceof Error) {
      if (error.message === "DADATA_NOT_CONFIGURED") {
        return fail("Не настроен API-ключ DaData.", 503);
      }

      if (error.message === "CITY_NOT_FOUND") {
        return fail("Не удалось определить выбранный город.", 404);
      }

      if (error.message === "ADDRESS_NOT_FOUND" || error.message === "ADDRESS_CITY_MISMATCH") {
        return fail(
          "Не удалось подтвердить адрес. Выберите существующий адрес из подсказок.",
          400,
        );
      }

      if (error.message === "DISTRICT_NOT_FOUND") {
        return fail("Не удалось определить район по выбранному адресу.", 400);
      }

      if (error.message === "PICKUP_POINT_REQUIRED") {
        return fail("Для управляющего нужно выбрать доступный ПВЗ.", 400);
      }

      if (error.message === "PICKUP_POINT_FORBIDDEN") {
        return fail("Этот ПВЗ недоступен для создания смен.", 403);
      }

      if (error.message === "MARKETPLACE_NOT_FOUND") {
        return fail("Выберите маркетплейс из списка.", 400);
      }

      if (error.message === "EMPLOYER_VERIFICATION_REQUIRED") {
        return fail(
          "Сначала дождитесь одобрения документа работодателя. Без этой проверки создавать смены нельзя.",
          403,
        );
      }

      if (error.message.startsWith("DADATA_")) {
        return fail("DaData временно недоступна. Попробуйте еще раз.", 502);
      }
    }

    return fail("Не удалось создать объявление. Попробуйте еще раз.", 500);
  }
}
