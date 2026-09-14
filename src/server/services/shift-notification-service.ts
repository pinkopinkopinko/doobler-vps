import { MarketplaceCode } from "@/generated/prisma/client";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";

const MAX_SHIFT_NOTIFICATIONS_PER_POST = 100;

type ShiftNotificationFilterInput = {
  isEnabled?: boolean;
  cityId?: string | null;
  district?: string | null;
  marketplaceCodes?: MarketplaceCode[];
  urgentOnly?: boolean;
  paymentMinRub?: number | null;
  paymentMaxRub?: number | null;
};

type CreatedShiftForNotification = {
  id: string;
  createdByUserId: string;
  title: string;
  cityId: string;
  district: string;
  address: string;
  shiftDate: Date;
  startAt: Date | null;
  endAt: Date | null;
  paymentAmountRub: number;
  isUrgent: boolean;
  city: { name: string };
  marketplace: { code: MarketplaceCode };
};

function normalizeDistrict(value: string | null | undefined) {
  const district = value?.trim();
  return district ? district : null;
}

function normalizeAmount(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function getShiftUrl(shiftPostId: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://doobler.ru").replace(/\/$/, "");
  return `${baseUrl}/telegram/shifts/${shiftPostId}`;
}

function formatShiftDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    timeZone: "Europe/Moscow",
  }).format(value);
}

function formatShiftTime(startAt: Date | null, endAt: Date | null) {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });

  if (startAt && endAt) {
    return `${formatter.format(startAt)}-${formatter.format(endAt)}`;
  }

  if (startAt) {
    return `с ${formatter.format(startAt)}`;
  }

  return "время уточняется";
}

function buildShiftNotificationText(shift: CreatedShiftForNotification) {
  const urgentPrefix = shift.isUrgent ? "Срочная смена" : "Новая смена";

  return [
    `${urgentPrefix} по вашим фильтрам`,
    "",
    shift.title,
    `${shift.marketplace.code} · ${shift.city.name}`,
    `${formatShiftDate(shift.shiftDate)}, ${formatShiftTime(shift.startAt, shift.endAt)}`,
    shift.district ? `${shift.district}, ${shift.address}` : shift.address,
    `Оплата: ${formatMoney(shift.paymentAmountRub)}`,
  ].join("\n");
}

export async function getShiftNotificationFilter(userId: string) {
  return prisma.shiftNotificationFilter.findUnique({
    where: { userId },
    include: {
      city: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function upsertShiftNotificationFilter(
  userId: string,
  input: ShiftNotificationFilterInput,
) {
  const marketplaceCodes = input.marketplaceCodes ?? [];
  const data = {
    isEnabled: input.isEnabled ?? true,
    cityId: input.cityId?.trim() || null,
    district: normalizeDistrict(input.district),
    marketplaceCodes,
    urgentOnly: input.urgentOnly ?? false,
    paymentMinRub: normalizeAmount(input.paymentMinRub),
    paymentMaxRub: normalizeAmount(input.paymentMaxRub),
  };

  return prisma.shiftNotificationFilter.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
    include: {
      city: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function setShiftNotificationFilterEnabled(userId: string, isEnabled: boolean) {
  return prisma.shiftNotificationFilter.updateMany({
    where: { userId },
    data: { isEnabled },
  });
}

export async function notifyMatchingShiftSubscribers(shift: CreatedShiftForNotification) {
  const filters = await prisma.shiftNotificationFilter.findMany({
    where: {
      isEnabled: true,
      userId: {
        not: shift.createdByUserId,
      },
      user: {
        isActive: true,
        isBanned: false,
      },
      OR: [{ cityId: null }, { cityId: shift.cityId }],
      AND: [
        {
          OR: [
            { marketplaceCodes: { isEmpty: true } },
            { marketplaceCodes: { has: shift.marketplace.code } },
          ],
        },
        {
          OR: [{ district: null }, { district: { equals: shift.district, mode: "insensitive" } }],
        },
        {
          OR: [{ urgentOnly: false }, { urgentOnly: shift.isUrgent }],
        },
        {
          OR: [{ paymentMinRub: null }, { paymentMinRub: { lte: shift.paymentAmountRub } }],
        },
        {
          OR: [{ paymentMaxRub: null }, { paymentMaxRub: { gte: shift.paymentAmountRub } }],
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          telegramId: true,
        },
      },
    },
    take: MAX_SHIFT_NOTIFICATIONS_PER_POST,
  });

  if (!filters.length) {
    return { matched: 0, sent: 0, failed: 0 };
  }

  const text = buildShiftNotificationText(shift);
  const shiftUrl = getShiftUrl(shift.id);
  let sent = 0;
  let failed = 0;

  for (const filter of filters) {
    const result = await sendTelegramMessage({
      chatId: filter.user.telegramId,
      text,
      button: {
        text: "Открыть смену",
        webAppUrl: shiftUrl,
      },
    });
    const status = result.ok ? "SENT" : "FAILED";

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
    }

    await prisma.notification.create({
      data: {
        userId: filter.userId,
        type: "SHIFT_FILTER_MATCH",
        channel: "TELEGRAM",
        status,
        sentAt: result.ok ? new Date() : null,
        payloadJson: {
          shiftPostId: shift.id,
          filterId: filter.id,
          title: shift.title,
          url: shiftUrl,
        },
      },
    });
  }

  return { matched: filters.length, sent, failed };
}
