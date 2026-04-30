import { ShiftPostStatus } from "@/generated/prisma/client";

import { demoCities, demoShiftPosts } from "@/lib/demo-data";
import { verifyAddressSelection } from "@/lib/geocoder/yandex-geocode";
import { prisma } from "@/lib/prisma";
import type { ShiftCard as ShiftCardView } from "@/lib/types";
import { getDistrictCompareKey, getTodayDateValue, normalizeDistrictName } from "@/lib/utils";
import { shiftPostSchema } from "@/lib/validations/shift-post";

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

function mapShiftPost(post: {
  id: string;
  createdByUserId: string;
  title: string;
  type: ShiftCardView["type"];
  status: ShiftCardView["status"];
  district: string;
  address: string;
  landmark: string | null;
  shiftDate: Date;
  startAt: Date | null;
  endAt: Date | null;
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
}): ShiftCardView {
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
    landmark: post.landmark,
    shiftDate: post.shiftDate.toISOString(),
    startAt: post.startAt?.toISOString() ?? null,
    endAt: post.endAt?.toISOString() ?? null,
    paymentAmountRub: post.paymentAmountRub,
    paymentType: post.paymentType,
    experienceLevelRequired: post.experienceLevelRequired,
    isUrgent: post.isUrgent,
    description: post.description,
    createdByName: `${post.createdBy.firstName} ${post.createdBy.lastName ?? ""}`.trim(),
    applicationsCount: post._count.applications,
    favorite: false,
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
      landmark: true,
    },
  });
}

// Жёсткий потолок на размер выдачи ленты: даже без явного limit мы не хотим
// тащить из БД тысячи строк (есть пост-фильтр по району на JS, который отдаст
// меньше). UI всё равно рендерит карточки в одну колонку — 200 более чем
// достаточно, а при росте города можно будет включить курсорную пагинацию.
const DEFAULT_LIST_SHIFT_POSTS_LIMIT = 200;

export async function listShiftPosts(filters: ListShiftPostFilters = {}) {
  const today = getTodayDateValue();
  const effectiveDateFrom = getEffectiveDateFrom(filters, today);
  const effectiveLimit = filters.limit ?? DEFAULT_LIST_SHIFT_POSTS_LIMIT;

  try {
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

    return posts
      .map(mapShiftPost)
      .filter((post) => matchesDistrictFilter(post.district, filters.district));
  } catch {
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

export async function listAvailableShiftDistricts(filters: {
  cityId?: string | null;
  marketplaceCode?: string | null;
}) {
  const today = getTodayDateValue();

  if (!filters.cityId) {
    return [];
  }

  try {
    const rows = await prisma.shiftPost.findMany({
      where: {
        cityId: filters.cityId,
        status: ShiftPostStatus.PUBLISHED,
        shiftDate: {
          gte: new Date(`${today}T00:00:00.000Z`),
        },
        district: {
          not: "",
        },
        ...(filters.marketplaceCode
          ? { marketplace: { code: filters.marketplaceCode as ShiftCardView["marketplace"] } }
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
  } catch {
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

    if (!post) {
      return null;
    }

    return mapShiftPost(post);
  } catch {
    return demoShiftPosts.find((post) => post.id === id) ?? null;
  }
}

export async function createShiftPost(input: unknown, createdByUserId: string) {
  const data = shiftPostSchema.parse(input) as CreateShiftPostInput;
  const { addressSuggestionUri, ...shiftData } = data;
  const creatorRoles = await getCreatorRoles(createdByUserId);
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
  } = {
    formattedAddress: effectiveShiftData.address,
    district: effectiveShiftData.district || "",
    city: null as string | null,
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

  const post = await prisma.shiftPost.create({
    data: {
      ...effectiveShiftData,
      createdByUserId,
      pickupPointId: finalPickupPointId,
      marketplaceId: effectiveShiftData.marketplaceId,
      cityId: effectiveShiftData.cityId,
      regionId: effectiveShiftData.regionId,
      district: verifiedAddress.district || "",
      address: verifiedAddress.formattedAddress,
      shiftDate: new Date(effectiveShiftData.shiftDate),
      startAt: effectiveShiftData.startAt ? new Date(effectiveShiftData.startAt) : null,
      endAt: effectiveShiftData.endAt ? new Date(effectiveShiftData.endAt) : null,
      // MVP: без ручной модерации, все смены сразу видны в ленте.
      status: "PUBLISHED",
    },
    select: {
      id: true,
      createdByUserId: true,
      title: true,
      type: true,
      status: true,
      district: true,
      address: true,
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
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { applications: true } },
    },
  });

  return mapShiftPost(post);
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
