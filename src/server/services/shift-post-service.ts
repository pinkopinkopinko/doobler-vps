import { revalidateTag, unstable_cache } from "next/cache";

import { AssignmentStatus, MarketplaceCode, ShiftPostStatus } from "@/generated/prisma/client";

import { demoCities, demoShiftPosts } from "@/lib/demo-data";
import { isDevFallbackEnabled, logDevFallbackUsed } from "@/lib/dev-fallback";
import { verifyAddressSelection } from "@/lib/geocoder/yandex-geocode";
import { prisma } from "@/lib/prisma";
import type { ShiftCard as ShiftCardView } from "@/lib/types";
import { getDistrictCompareKey, getTodayDateValue, normalizeDistrictName } from "@/lib/utils";
import { shiftPostSchema } from "@/lib/validations/shift-post";
import { getEmployerVerificationStatus } from "@/server/services/employer-verification-service";
import { notifyMatchingShiftSubscribers } from "@/server/services/shift-notification-service";

// Cache-теги для `unstable_cache`. Лента `listShiftPosts` и
// `listAvailableShiftDistricts` обернуты в кеш с тегом `SHIFTS_CACHE_TAG`,
// чтобы create/update/delete мутации сбрасывали обе сразу.
const SHIFTS_CACHE_TAG = "shifts";
// TTL ленты: 30 секунд. Юзеры обычно не успевают подметить лаг (фильтры
// и навигация занимают больше), а DB-нагрузка падает многократно — самая
// частая GET-ручка на проде это `/api/shift-posts`.
const SHIFTS_CACHE_TTL_SECONDS = 30;
// Districts (фасеты для фильтра) меняются медленнее самой ленты: новый
// район появляется только при новой смене в нём, поэтому 5 минут — ОК.
const SHIFT_DISTRICTS_CACHE_TTL_SECONDS = 300;
type ListShiftPostFilters = {
  cityId?: string | null;
  district?: string | null;
  marketplaceId?: string | null;
  marketplaceCode?: string | null;
  createdByUserId?: string | null;
  urgentOnly?: boolean;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  paymentMin?: number | null;
  paymentMax?: number | null;
  limit?: number | null;
};

/** `unstable_cache` сериализует payload — Prisma `Date` становятся ISO-строками. */
function prismaDateToIso(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return typeof value === "string" ? value : value.toISOString();
}

type CreateShiftPostInput = {
  pickupPointId?: string | null;
  title: string;
  type: ShiftCardView["type"];
  marketplaceId: string;
  cityId: string;
  regionId: string;
  district: string;
  address: string;
  addressSuggestionUri?: string | null;
  landmark?: string | null;
  description: string;
  shiftDate: string;
  startAt?: string | null;
  endAt?: string | null;
  paymentAmountRub: number;
  paymentType: ShiftCardView["paymentType"];
  experienceLevelRequired: ShiftCardView["experienceLevelRequired"];
  isUrgent: boolean;
};

const MARKETPLACE_CODE_BY_FALLBACK_ID: Record<string, MarketplaceCode> = {
  mp_ozon: MarketplaceCode.OZON,
  mp_wb: MarketplaceCode.WB,
  mp_yandex: MarketplaceCode.YANDEX,
  mp_other: MarketplaceCode.OTHER,
};

function normalizeMarketplaceCode(value: string): MarketplaceCode | null {
  const fallbackCode = MARKETPLACE_CODE_BY_FALLBACK_ID[value.trim().toLowerCase()];
  if (fallbackCode) {
    return fallbackCode;
  }

  const rawCode = value.trim().toUpperCase();
  if (rawCode in MarketplaceCode) {
    return MarketplaceCode[rawCode as keyof typeof MarketplaceCode];
  }

  return null;
}

async function resolveMarketplaceId(rawMarketplaceId: string) {
  const marketplaceId = rawMarketplaceId.trim();
  if (!marketplaceId) {
    throw new Error("MARKETPLACE_NOT_FOUND");
  }

  const marketplaceById = await prisma.marketplace.findUnique({
    where: { id: marketplaceId },
    select: { id: true },
  });
  if (marketplaceById) {
    return marketplaceById.id;
  }

  const marketplaceCode = normalizeMarketplaceCode(marketplaceId);
  if (!marketplaceCode) {
    throw new Error("MARKETPLACE_NOT_FOUND");
  }

  const marketplaceByCode = await prisma.marketplace.findUnique({
    where: { code: marketplaceCode },
    select: { id: true },
  });
  if (!marketplaceByCode) {
    throw new Error("MARKETPLACE_NOT_FOUND");
  }

  return marketplaceByCode.id;
}

function mapShiftPost(
  post: {
  id: string;
  createdByUserId: string;
  title: string;
  type: ShiftCardView["type"];
  status: ShiftCardView["status"];
  district: string;
  address: string;
  lat: { toNumber?: () => number } | number | string | null;
  lng: { toNumber?: () => number } | number | string | null;
  pickupPoint?: {
    lat: { toNumber?: () => number } | number | string | null;
    lng: { toNumber?: () => number } | number | string | null;
  } | null;
  landmark: string | null;
  shiftDate: Date | string;
  startAt: Date | string | null;
  endAt: Date | string | null;
  paymentAmountRub: number;
  paymentType: ShiftCardView["paymentType"];
  experienceLevelRequired: ShiftCardView["experienceLevelRequired"];
  isUrgent: boolean;
  description: string;
  city: { name: string };
  region: { name: string };
  marketplace: { code: ShiftCardView["marketplace"] };
  createdBy: { firstName: string; lastName: string | null };
  _count: { applications: number };
  },
): ShiftCardView {
  const rawLat = post.lat ?? post.pickupPoint?.lat;
  const rawLng = post.lng ?? post.pickupPoint?.lng;
  const lat = typeof rawLat === "object" ? rawLat?.toNumber?.() : Number(rawLat ?? NaN);
  const lng = typeof rawLng === "object" ? rawLng?.toNumber?.() : Number(rawLng ?? NaN);

  return {
    id: post.id,
    createdByUserId: post.createdByUserId,
    title: post.title,
    type: post.type,
    status: post.status,
    marketplace: post.marketplace.code,
    cityName: post.city.name,
    regionName: post.region.name,
    district: post.district,
    address: post.address,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    landmark: post.landmark,
    shiftDate: prismaDateToIso(post.shiftDate) ?? "",
    startAt: prismaDateToIso(post.startAt),
    endAt: prismaDateToIso(post.endAt),
    paymentAmountRub: post.paymentAmountRub,
    paymentType: post.paymentType,
    experienceLevelRequired: post.experienceLevelRequired,
    isUrgent: post.isUrgent,
    description: post.description,
    createdByName: `${post.createdBy.firstName} ${post.createdBy.lastName ?? ""}`.trim(),
    applicationsCount: post._count.applications,
  };
}

function getEffectiveDateFrom(filters: ListShiftPostFilters, today: string) {
  if (filters.createdByUserId) {
    return filters.dateFrom ?? null;
  }

  if (!filters.dateFrom || filters.dateFrom < today) {
    return today;
  }

  return filters.dateFrom;
}

function matchesDistrictFilter(value: string | null | undefined, expected: string | null | undefined) {
  if (!expected) {
    return true;
  }

  return getDistrictCompareKey(value) === getDistrictCompareKey(expected);
}

function buildDistrictFacets(values: string[]) {
  const grouped = new Map<string, { label: string; count: number }>();

  for (const value of values) {
    const label = normalizeDistrictName(value);

    if (!label) {
      continue;
    }

    const key = getDistrictCompareKey(label);
    const current = grouped.get(key);

    if (current) {
      current.count += 1;
      if (label.length < current.label.length) {
        current.label = label;
      }
      continue;
    }

    grouped.set(key, { label, count: 1 });
  }

  return Array.from(grouped.values()).sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label, "ru"),
  );
}

async function getCreatorRoles(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roles: {
        select: {
          role: true,
        },
      },
    },
  });

  return user?.roles.map((role) => role.role) ?? [];
}

async function getAccessiblePickupPoint(pickupPointId: string, userId: string) {
  return prisma.pickupPoint.findFirst({
    where: {
      id: pickupPointId,
      OR: [
        { ownerUserId: userId },
        {
          managerAccesses: {
            some: {
              managerUserId: userId,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      marketplaceId: true,
      regionId: true,
      cityId: true,
      district: true,
      address: true,
      lat: true,
      lng: true,
      landmark: true,
    },
  });
}

// Жёсткий потолок на размер выдачи ленты: даже без явного limit мы не хотим
// тащить из БД тысячи строк (есть пост-фильтр по району на JS, который отдаст
// меньше). UI всё равно рендерит карточки в одну колонку — 200 более чем
// достаточно, а при росте города можно будет включить курсорную пагинацию.
const DEFAULT_LIST_SHIFT_POSTS_LIMIT = 200;

function shouldUseDemoFallback() {
  return isDevFallbackEnabled("data");
}

type CacheableShiftFilters = ListShiftPostFilters & {
  // `today` пробрасываем как явный параметр, чтобы дата-фильтр становился
  // частью cache-ключа: иначе при переходе через полночь Москва (когда
  // `getTodayDateValue()` меняется) кеш всё ещё отдавал бы «вчера».
  todayDateValue: string;
};

// Сырая выборка из БД без пользовательских примесей — её можно безопасно
// кешировать между всеми пользователями.
async function fetchShiftPostsRaw(filters: CacheableShiftFilters) {
  const effectiveDateFrom = getEffectiveDateFrom(filters, filters.todayDateValue);
  const effectiveLimit = filters.limit ?? DEFAULT_LIST_SHIFT_POSTS_LIMIT;

  const posts = await prisma.shiftPost.findMany({
    where: {
      ...(filters.cityId ? { cityId: filters.cityId } : {}),
      ...(filters.district
        ? { district: { equals: filters.district, mode: "insensitive" } }
        : {}),
      ...(filters.marketplaceId ? { marketplaceId: filters.marketplaceId } : {}),
      ...(filters.marketplaceCode
        ? { marketplace: { code: filters.marketplaceCode as ShiftCardView["marketplace"] } }
        : {}),
      ...(filters.createdByUserId ? { createdByUserId: filters.createdByUserId } : {}),
      ...(filters.urgentOnly ? { isUrgent: true } : {}),
      ...(!filters.createdByUserId ? { status: ShiftPostStatus.PUBLISHED } : {}),
      ...((effectiveDateFrom || filters.dateTo)
        ? {
            shiftDate: {
              ...(effectiveDateFrom ? { gte: new Date(`${effectiveDateFrom}T00:00:00.000Z`) } : {}),
              ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...((filters.paymentMin || filters.paymentMax)
        ? {
            paymentAmountRub: {
              ...(filters.paymentMin ? { gte: filters.paymentMin } : {}),
              ...(filters.paymentMax ? { lte: filters.paymentMax } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { district: { contains: filters.search, mode: "insensitive" } },
              { address: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ isUrgent: "desc" }, { publishedAt: "desc" }],
    take: effectiveLimit,
    select: {
      id: true,
      createdByUserId: true,
      title: true,
      type: true,
      status: true,
      district: true,
      address: true,
      lat: true,
      lng: true,
      landmark: true,
      shiftDate: true,
      startAt: true,
      endAt: true,
      paymentAmountRub: true,
      paymentType: true,
      experienceLevelRequired: true,
      isUrgent: true,
      description: true,
      city: {
        select: {
          name: true,
        },
      },
      region: {
        select: {
          name: true,
        },
      },
      marketplace: {
        select: {
          code: true,
        },
      },
      pickupPoint: {
        select: {
          lat: true,
          lng: true,
        },
      },
      createdBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
  });

  return posts.filter((post) => matchesDistrictFilter(post.district, filters.district));
}

// Кешированная версия — общий пул для всех залогиненных пользователей,
// инвалидируется по тегу `SHIFTS_CACHE_TAG` после create/update/delete.
// Ключ строится автоматически Next.js'ом из сериализованных аргументов;
// `["shift-posts-list-v1"]` — версионный namespace на случай несовместимых
// изменений формы данных (тогда меняем `v1` → `v2`, старые ключи отомрут
// сами).
const fetchShiftPostsRawCached = unstable_cache(
  fetchShiftPostsRaw,
  ["shift-posts-list-v1"],
  { revalidate: SHIFTS_CACHE_TTL_SECONDS, tags: [SHIFTS_CACHE_TAG] },
);

export async function listShiftPosts(filters: ListShiftPostFilters = {}) {
  const today = getTodayDateValue();

  try {
    // Когда юзер смотрит «свои» посты (createdByUserId === ownerUserId),
    // кеш скорее вредит — после собственной операции CRUD кеш бы отдавал
    // stale-данные до TTL (revalidateTag сработает только в новом запросе).
    // Делаем сквозной обход кеша для этого узкого кейса.
    const skipCache = Boolean(filters.createdByUserId);
    const filtered = skipCache
      ? await fetchShiftPostsRaw({ ...filters, todayDateValue: today })
      : await fetchShiftPostsRawCached({ ...filters, todayDateValue: today });

    return filtered.map((post) => mapShiftPost(post));
  } catch (error) {
    if (!shouldUseDemoFallback()) {
      throw error;
    }

    const effectiveDateFrom = getEffectiveDateFrom(filters, today);
    const effectiveLimit = filters.limit ?? DEFAULT_LIST_SHIFT_POSTS_LIMIT;

    logDevFallbackUsed({ kind: "data", source: "listShiftPosts", reason: error });
    const targetCityName = filters.cityId
      ? demoCities.find((city) => city.id === filters.cityId)?.name
      : null;

    const fallbackPosts = demoShiftPosts.filter((post) => {
      if (filters.createdByUserId && filters.createdByUserId !== "user_owner_1") {
        return false;
      }

      if (targetCityName && post.cityName !== targetCityName) {
        return false;
      }

      if (!matchesDistrictFilter(post.district, filters.district)) {
        return false;
      }

      if (filters.marketplaceCode && post.marketplace !== filters.marketplaceCode) {
        return false;
      }

      if (filters.urgentOnly && !post.isUrgent) {
        return false;
      }

      if (!filters.createdByUserId && post.shiftDate < (effectiveDateFrom ?? today)) {
        return false;
      }

      if (filters.dateTo && post.shiftDate > filters.dateTo) {
        return false;
      }

      if (filters.paymentMin && post.paymentAmountRub < filters.paymentMin) {
        return false;
      }

      if (filters.paymentMax && post.paymentAmountRub > filters.paymentMax) {
        return false;
      }

      if (filters.search) {
        const query = filters.search.toLowerCase();
        return [post.title, post.address, post.district].some((value) =>
          value.toLowerCase().includes(query),
        );
      }

      return true;
    });

    return fallbackPosts.slice(0, effectiveLimit);
  }
}

// Кешируемая часть: список distinct-районов по городу + опционально
// маркетплейсу за сегодняшний день. Передаём `todayDateValue` явно,
// чтобы кеш-ключ нормально обновлялся при смене календарного дня.
async function fetchShiftDistrictsRaw(params: {
  cityId: string;
  marketplaceCode: string | null;
  todayDateValue: string;
}) {
  const rows = await prisma.shiftPost.findMany({
    where: {
      cityId: params.cityId,
      status: ShiftPostStatus.PUBLISHED,
      shiftDate: {
        gte: new Date(`${params.todayDateValue}T00:00:00.000Z`),
      },
      district: {
        not: "",
      },
      ...(params.marketplaceCode
        ? { marketplace: { code: params.marketplaceCode as ShiftCardView["marketplace"] } }
        : {}),
    },
    select: {
      district: true,
    },
    distinct: ["district"],
    orderBy: {
      district: "asc",
    },
  });

  return buildDistrictFacets(rows.map((row) => row.district));
}

const fetchShiftDistrictsRawCached = unstable_cache(
  fetchShiftDistrictsRaw,
  ["shift-districts-v1"],
  { revalidate: SHIFT_DISTRICTS_CACHE_TTL_SECONDS, tags: [SHIFTS_CACHE_TAG] },
);

export async function listAvailableShiftDistricts(filters: {
  cityId?: string | null;
  marketplaceCode?: string | null;
}) {
  const today = getTodayDateValue();

  if (!filters.cityId) {
    return [];
  }

  try {
    return await fetchShiftDistrictsRawCached({
      cityId: filters.cityId,
      marketplaceCode: filters.marketplaceCode ?? null,
      todayDateValue: today,
    });
  } catch (error) {
    if (!shouldUseDemoFallback()) {
      throw error;
    }

    logDevFallbackUsed({ kind: "data", source: "listAvailableShiftDistricts", reason: error });
    const targetCityName = demoCities.find((city) => city.id === filters.cityId)?.name;

    return buildDistrictFacets(
      demoShiftPosts
        .filter((post) => (targetCityName ? post.cityName === targetCityName : true))
        .filter((post) =>
          filters.marketplaceCode ? post.marketplace === filters.marketplaceCode : true,
        )
        .map((post) => post.district),
    );
  }
}

export async function listMyShiftPosts(createdByUserId: string) {
  return listShiftPosts({
    createdByUserId,
  });
}

export async function getShiftPostById(id: string) {
  try {
    const post = await prisma.shiftPost.findUnique({
      where: { id },
      select: {
        id: true,
        createdByUserId: true,
        title: true,
        type: true,
        status: true,
        district: true,
        address: true,
        lat: true,
        lng: true,
        landmark: true,
        shiftDate: true,
        startAt: true,
        endAt: true,
        paymentAmountRub: true,
        paymentType: true,
        experienceLevelRequired: true,
        isUrgent: true,
        description: true,
        city: { select: { name: true } },
        region: { select: { name: true } },
        marketplace: { select: { code: true } },
        pickupPoint: { select: { lat: true, lng: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { applications: true } },
      },
    });

    if (!post) {
      return null;
    }

    return mapShiftPost(post);
  } catch (error) {
    if (!shouldUseDemoFallback()) {
      throw error;
    }

    logDevFallbackUsed({ kind: "data", source: "getShiftPostById", reason: error, meta: { id } });
    return demoShiftPosts.find((post) => post.id === id) ?? null;
  }
}

export async function createShiftPost(input: unknown, createdByUserId: string) {
  const data = shiftPostSchema.parse(input) as CreateShiftPostInput;
  const { addressSuggestionUri, ...shiftData } = data;
  const creatorRoles = await getCreatorRoles(createdByUserId);
  const employerVerificationStatus = await getEmployerVerificationStatus(createdByUserId);
  if (employerVerificationStatus !== "APPROVED") {
    throw new Error("EMPLOYER_VERIFICATION_REQUIRED");
  }

  const isManagerOnly = creatorRoles.includes("MANAGER") && !creatorRoles.includes("OWNER");
  // Пустая строка из формы не считается выбранным ПВЗ — иначе Prisma пытается
  // сослаться на пустой id и FK падает.
  const rawPickupPointId = shiftData.pickupPointId?.trim() || null;
  const selectedPickupPointId = rawPickupPointId;

  if (isManagerOnly && !selectedPickupPointId) {
    throw new Error("PICKUP_POINT_REQUIRED");
  }

  const accessiblePickupPoint = selectedPickupPointId
    ? await getAccessiblePickupPoint(selectedPickupPointId, createdByUserId)
    : null;

  if (selectedPickupPointId && !accessiblePickupPoint) {
    throw new Error("PICKUP_POINT_FORBIDDEN");
  }

  const effectiveShiftData = accessiblePickupPoint
    ? {
        ...shiftData,
        pickupPointId: accessiblePickupPoint.id,
        marketplaceId: accessiblePickupPoint.marketplaceId,
        cityId: accessiblePickupPoint.cityId,
        regionId: accessiblePickupPoint.regionId,
        district: accessiblePickupPoint.district ?? shiftData.district,
        address: accessiblePickupPoint.address,
        landmark: accessiblePickupPoint.landmark ?? shiftData.landmark ?? null,
      }
    : shiftData;

  let verifiedAddress: {
    formattedAddress: string;
    district: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  } = {
    formattedAddress: effectiveShiftData.address,
    district: effectiveShiftData.district || "",
    city: null as string | null,
    lat: accessiblePickupPoint?.lat ? Number(accessiblePickupPoint.lat) : null,
    lng: accessiblePickupPoint?.lng ? Number(accessiblePickupPoint.lng) : null,
  };

  if (!accessiblePickupPoint) {
    try {
      verifiedAddress = await verifyAddressSelection({
        cityId: effectiveShiftData.cityId,
        query: effectiveShiftData.address,
        expectedUri: addressSuggestionUri ?? "",
      });
    } catch (error) {
      console.warn("[shift-posts] geocoder verification skipped", {
        cityId: effectiveShiftData.cityId,
        address: effectiveShiftData.address,
        district: effectiveShiftData.district,
        addressSuggestionUri,
        error: error instanceof Error ? error.message : String(error),
      });

      if (!effectiveShiftData.district.trim()) {
        throw error;
      }
    }
  }

  // Финальный pickupPointId: либо тот, к которому есть доступ, либо ничего.
  // Никогда не подставляем сырое значение из формы — это ломало FK constraint.
  const finalPickupPointId = accessiblePickupPoint?.id ?? null;
  const finalMarketplaceId = accessiblePickupPoint
    ? accessiblePickupPoint.marketplaceId
    : await resolveMarketplaceId(effectiveShiftData.marketplaceId);

  const post = await prisma.shiftPost.create({
    data: {
      ...effectiveShiftData,
      createdByUserId,
      pickupPointId: finalPickupPointId,
      marketplaceId: finalMarketplaceId,
      cityId: effectiveShiftData.cityId,
      regionId: effectiveShiftData.regionId,
      district: verifiedAddress.district || "",
      address: verifiedAddress.formattedAddress,
      lat: verifiedAddress.lat,
      lng: verifiedAddress.lng,
      shiftDate: new Date(effectiveShiftData.shiftDate),
      startAt: effectiveShiftData.startAt ? new Date(effectiveShiftData.startAt) : null,
      endAt: effectiveShiftData.endAt ? new Date(effectiveShiftData.endAt) : null,
      // MVP: без ручной модерации, все смены сразу видны в ленте.
      status: "PUBLISHED",
    },
    select: {
      id: true,
      createdByUserId: true,
      cityId: true,
      title: true,
      type: true,
      status: true,
      district: true,
      address: true,
      lat: true,
      lng: true,
      landmark: true,
      shiftDate: true,
      startAt: true,
      endAt: true,
      paymentAmountRub: true,
      paymentType: true,
      experienceLevelRequired: true,
      isUrgent: true,
      description: true,
      city: { select: { name: true } },
      region: { select: { name: true } },
      marketplace: { select: { code: true } },
      pickupPoint: { select: { lat: true, lng: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { applications: true } },
    },
  });

  // Лента и фасеты районов закешированы в `unstable_cache` с тегом
  // SHIFTS_CACHE_TAG — после создания смены сбрасываем оба, чтобы новый
  // пост сразу появлялся в /api/shift-posts без ожидания TTL.
  revalidateTag(SHIFTS_CACHE_TAG, "max");

  void notifyMatchingShiftSubscribers({
    id: post.id,
    createdByUserId: post.createdByUserId,
    title: post.title,
    cityId: post.cityId,
    district: post.district,
    address: post.address,
    shiftDate: post.shiftDate,
    startAt: post.startAt,
    endAt: post.endAt,
    paymentAmountRub: post.paymentAmountRub,
    isUrgent: post.isUrgent,
    city: post.city,
    marketplace: post.marketplace,
  }).catch((error) => {
    console.error("[shift-posts] filter notifications failed", error);
  });

  return {
    shiftPost: mapShiftPost(post),
  };
}

/**
 * Меняет статус смены ТОЛЬКО если actorUserId — её автор. Реализовано через
 * updateMany с составным where, чтобы не было race-окна и чтобы IDOR (любой
 * залогиненный юзер мог отменить чужую смену) был закрыт на уровне SQL.
 *
 * Бросает Error("FORBIDDEN") если автор не совпадает (или смена не найдена).
 * Админский путь использует отдельный admin-service.cancelShiftPost.
 */
export async function updateShiftPostStatus(
  id: string,
  status: ShiftPostStatus,
  actorUserId: string,
) {
  const closedAt = status === "CLOSED" || status === "CANCELLED" ? new Date() : null;

  const result = await prisma.shiftPost.updateMany({
    where: {
      id,
      createdByUserId: actorUserId,
    },
    data: {
      status,
      closedAt,
    },
  });

  if (result.count === 0) {
    throw new Error("FORBIDDEN");
  }

  return { id, status, closedAt };
}

/**
 * Жёстко удаляет смену вместе с откликами (Application каскадно удаляются
 * по схеме). Применяется только если actor —
 * автор смены, иначе кидаем `FORBIDDEN` без подсветки факта существования.
 *
 * Если на смене уже есть активный Assignment (CONFIRMED или IN_PROGRESS),
 * удалить нельзя — это означает что работник уже договорился, и стирать
 * запись «за его спиной» нечестно. Владелец сначала должен отменить смену
 * через `updateShiftPostStatus(.., 'CANCELLED', ..)`, что развалит
 * назначение, а уже потом удалять. Бросаем `HAS_ACTIVE_ASSIGNMENT`.
 *
 * Завершённые/отменённые/no-show ассайнменты нормально каскадно удаляются.
 */
export async function deleteShiftPost(id: string, actorUserId: string) {
  const post = await prisma.shiftPost.findUnique({
    where: { id },
    select: {
      createdByUserId: true,
      assignments: {
        where: {
          status: { in: [AssignmentStatus.CONFIRMED, AssignmentStatus.IN_PROGRESS] },
        },
        select: { status: true },
        take: 1,
      },
    },
  });

  if (!post || post.createdByUserId !== actorUserId) {
    throw new Error("FORBIDDEN");
  }

  if (
    post.assignments.length > 0
  ) {
    throw new Error("HAS_ACTIVE_ASSIGNMENT");
  }

  // deleteMany с составным where на случай race с переуступкой авторства —
  // если кто-то параллельно поменяет createdByUserId, мы не удалим чужую
  // смену.
  const result = await prisma.shiftPost.deleteMany({
    where: { id, createdByUserId: actorUserId },
  });

  if (result.count === 0) {
    throw new Error("FORBIDDEN");
  }

  return { id };
}
