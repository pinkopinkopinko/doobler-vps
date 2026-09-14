import { PrismaPg } from "@prisma/adapter-pg";

import {
  AppRole,
  ApplicationStatus,
  ExperienceLevel,
  MarketplaceCode,
  PaymentType,
  PrismaClient,
  ShiftPostStatus,
  ShiftPostType,
  VerificationStatus,
} from "../src/generated/prisma/client";
import { RUSSIAN_CITIES } from "../src/lib/russian-cities";

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/pvz_zamena_bot?schema=public",
  ),
});

async function upsertRegionsAndCities() {
  const regions = new Map<string, { id: string; name: string }>();
  const cities = new Map<string, { id: string; name: string; regionId: string }>();

  for (const item of RUSSIAN_CITIES) {
    const region = await prisma.region.upsert({
      where: { slug: item.regionSlug },
      update: {
        name: item.regionName,
        federalDistrict: item.federalDistrict,
      },
      create: {
        name: item.regionName,
        slug: item.regionSlug,
        federalDistrict: item.federalDistrict,
      },
      select: {
        id: true,
        name: true,
      },
    });

    regions.set(item.regionSlug, region);

    const city = await prisma.city.upsert({
      where: {
        regionId_slug: {
          regionId: region.id,
          slug: item.citySlug,
        },
      },
      update: {
        name: item.cityName,
        timezone: item.timezone,
      },
      create: {
        regionId: region.id,
        name: item.cityName,
        slug: item.citySlug,
        timezone: item.timezone,
      },
      select: {
        id: true,
        name: true,
        regionId: true,
      },
    });

    cities.set(item.citySlug, city);
  }

  return { regions, cities };
}

async function main() {
  const { regions, cities } = await upsertRegionsAndCities();

  const moscowRegion = regions.get("moskva");
  const spbRegion = regions.get("sankt-peterburg");
  const tatarstanRegion = regions.get("respublika-tatarstan");
  const moscowCity = cities.get("moskva");
  const spbCity = cities.get("sankt-peterburg");
  const kazanCity = cities.get("kazan");

  if (!moscowRegion || !spbRegion || !tatarstanRegion || !moscowCity || !spbCity || !kazanCity) {
    throw new Error("Failed to bootstrap core regions and cities.");
  }

  const marketplaces = await Promise.all([
    prisma.marketplace.upsert({
      where: { code: MarketplaceCode.OZON },
      update: {},
      create: { code: MarketplaceCode.OZON, name: "Ozon" },
    }),
    prisma.marketplace.upsert({
      where: { code: MarketplaceCode.WB },
      update: {},
      create: { code: MarketplaceCode.WB, name: "Wildberries" },
    }),
    prisma.marketplace.upsert({
      where: { code: MarketplaceCode.YANDEX },
      update: {},
      create: { code: MarketplaceCode.YANDEX, name: "Яндекс Маркет" },
    }),
    prisma.marketplace.upsert({
      where: { code: MarketplaceCode.OTHER },
      update: {},
      create: { code: MarketplaceCode.OTHER, name: "Другое" },
    }),
  ]);

  const [ozon, wb, yandex] = marketplaces;

  const owner = await prisma.user.upsert({
    where: { telegramId: "1000001" },
    update: {
      age: 33,
      photoUrl: "https://placehold.co/160x160/2aabee/ffffff?text=%D0%90%D0%9B",
      pickupPointCode: "МОСКВА_101",
      isOnboardingCompleted: true,
      firstName: "Анна",
      lastName: "Левина",
      cityId: moscowCity.id,
      regionId: moscowRegion.id,
      district: "Сокольники",
      marketplaces: [MarketplaceCode.OZON, MarketplaceCode.YANDEX],
      ratingAvg: 4.9,
      ratingCount: 16,
      completedAssignmentsCount: 34,
    },
    create: {
      telegramId: "1000001",
      username: "anna_pvz_owner",
      age: 33,
      photoUrl: "https://placehold.co/160x160/2aabee/ffffff?text=%D0%90%D0%9B",
      pickupPointCode: "МОСКВА_101",
      isOnboardingCompleted: true,
      firstName: "Анна",
      lastName: "Левина",
      cityId: moscowCity.id,
      regionId: moscowRegion.id,
      district: "Сокольники",
      marketplaces: [MarketplaceCode.OZON, MarketplaceCode.YANDEX],
      ratingAvg: 4.9,
      ratingCount: 16,
      completedAssignmentsCount: 34,
      bio: "Управляю двумя ПВЗ в Москве.",
    },
  });

  const worker = await prisma.user.upsert({
    where: { telegramId: "1000002" },
    update: {
      age: 26,
      photoUrl: "https://placehold.co/160x160/4caf8d/ffffff?text=%D0%98%D0%9F",
      experienceSummary:
        "8 месяцев в Ozon и Wildberries, уверенно работаю с возвратами и кассой.",
      isOnboardingCompleted: true,
      cityId: moscowCity.id,
      regionId: moscowRegion.id,
      district: "Сокольники",
      marketplaces: [MarketplaceCode.OZON, MarketplaceCode.WB],
      ratingAvg: 4.7,
      ratingCount: 21,
      completedAssignmentsCount: 27,
    },
    create: {
      telegramId: "1000002",
      username: "igor_shift",
      age: 26,
      photoUrl: "https://placehold.co/160x160/4caf8d/ffffff?text=%D0%98%D0%9F",
      experienceSummary:
        "8 месяцев в Ozon и Wildberries, уверенно работаю с возвратами и кассой.",
      isOnboardingCompleted: true,
      firstName: "Игорь",
      lastName: "Панов",
      cityId: moscowCity.id,
      regionId: moscowRegion.id,
      district: "Сокольники",
      marketplaces: [MarketplaceCode.OZON, MarketplaceCode.WB],
      ratingAvg: 4.7,
      ratingCount: 21,
      completedAssignmentsCount: 27,
      bio: "Беру срочные смены по Москве, хорошо знаю кассу и возвраты.",
    },
  });

  const tempWorker = await prisma.user.upsert({
    where: { telegramId: "1000003" },
    update: {
      age: 29,
      photoUrl: "https://placehold.co/160x160/5b7cfa/ffffff?text=%D0%9C%D0%A1",
      experienceSummary:
        "Работала на ПВЗ Яндекс Маркета и брала подменные смены по Казани.",
      isOnboardingCompleted: true,
      cityId: kazanCity.id,
      regionId: tatarstanRegion.id,
      district: "Ново-Савиновский",
      marketplaces: [MarketplaceCode.YANDEX],
      ratingAvg: 4.5,
      ratingCount: 8,
      completedAssignmentsCount: 11,
    },
    create: {
      telegramId: "1000003",
      username: "mariya_pvz",
      age: 29,
      photoUrl: "https://placehold.co/160x160/5b7cfa/ffffff?text=%D0%9C%D0%A1",
      experienceSummary:
        "Работала на ПВЗ Яндекс Маркета и брала подменные смены по Казани.",
      isOnboardingCompleted: true,
      firstName: "Мария",
      lastName: "Смирнова",
      cityId: kazanCity.id,
      regionId: tatarstanRegion.id,
      district: "Ново-Савиновский",
      marketplaces: [MarketplaceCode.YANDEX],
      ratingAvg: 4.5,
      ratingCount: 8,
      completedAssignmentsCount: 11,
      bio: "Ищу смены и подработку в Казани.",
    },
  });

  await prisma.userRole.createMany({
    data: [
      { userId: owner.id, role: AppRole.OWNER },
      { userId: owner.id, role: AppRole.MANAGER },
      { userId: worker.id, role: AppRole.EMPLOYEE },
      { userId: worker.id, role: AppRole.TEMP_WORKER },
      { userId: tempWorker.id, role: AppRole.TEMP_WORKER },
    ],
    skipDuplicates: true,
  });

  const pickupPoint =
    (await prisma.pickupPoint.findFirst({
      where: {
        ownerUserId: owner.id,
        title: "ПВЗ Ozon Сокольники",
      },
    })) ??
    (await prisma.pickupPoint.create({
      data: {
        ownerUserId: owner.id,
        managerUserId: owner.id,
        marketplaceId: ozon.id,
        regionId: moscowRegion.id,
        cityId: moscowCity.id,
        title: "ПВЗ Ozon Сокольники",
        district: "Сокольники",
        address: "ул. Стромынка, 19к2",
        landmark: "рядом с метро Сокольники",
        verificationStatus: VerificationStatus.APPROVED,
      },
    }));

  const urgentShift =
    (await prisma.shiftPost.findFirst({
      where: {
        createdByUserId: owner.id,
        title: "Срочно нужен сотрудник на вечернюю смену",
      },
    })) ??
    (await prisma.shiftPost.create({
      data: {
        createdByUserId: owner.id,
        pickupPointId: pickupPoint.id,
        regionId: moscowRegion.id,
        cityId: moscowCity.id,
        marketplaceId: ozon.id,
        title: "Срочно нужен сотрудник на вечернюю смену",
        type: ShiftPostType.URGENT_REPLACEMENT,
        status: ShiftPostStatus.PUBLISHED,
        district: "Сокольники",
        address: "ул. Стромынка, 19к2",
        landmark: "рядом с метро Сокольники",
        description:
          "Нужна подмена на один день. Важен опыт выдачи посылок и работы с возвратами.",
        shiftDate: new Date("2026-04-18"),
        startAt: new Date("2026-04-18T10:00:00+03:00"),
        endAt: new Date("2026-04-18T20:00:00+03:00"),
        paymentAmountRub: 4500,
        paymentType: PaymentType.FIXED_SHIFT,
        experienceLevelRequired: ExperienceLevel.LESS_THAN_3_MONTHS,
        isUrgent: true,
      },
    }));

  const dailyShift =
    (await prisma.shiftPost.findFirst({
      where: {
        title: "Смена на день в Wildberries",
      },
    })) ??
    (await prisma.shiftPost.create({
      data: {
        createdByUserId: owner.id,
        regionId: spbRegion.id,
        cityId: spbCity.id,
        marketplaceId: wb.id,
        title: "Смена на день в Wildberries",
        type: ShiftPostType.DAY_SHIFT,
        status: ShiftPostStatus.PUBLISHED,
        district: "Приморский",
        address: "Богатырский проспект, 12",
        landmark: "ТЦ у метро Пионерская",
        description:
          "Ищем опытного сотрудника на дневную смену с уверенным знанием приёмки.",
        shiftDate: new Date("2026-04-19"),
        startAt: new Date("2026-04-19T09:00:00+03:00"),
        endAt: new Date("2026-04-19T21:00:00+03:00"),
        paymentAmountRub: 5000,
        paymentType: PaymentType.FIXED_SHIFT,
        experienceLevelRequired: ExperienceLevel.THREE_TO_TWELVE_MONTHS,
        isUrgent: false,
      },
    }));

  const permanentShift =
    (await prisma.shiftPost.findFirst({
      where: {
        title: "Постоянная вакансия управляющего ПВЗ",
      },
    })) ??
    (await prisma.shiftPost.create({
      data: {
        createdByUserId: owner.id,
        regionId: tatarstanRegion.id,
        cityId: kazanCity.id,
        marketplaceId: yandex.id,
        title: "Постоянная вакансия управляющего ПВЗ",
        type: ShiftPostType.PERMANENT_JOB,
        status: ShiftPostStatus.PUBLISHED,
        district: "Ново-Савиновский",
        address: "ул. Чистопольская, 75",
        landmark: "ЖК Магеллан",
        description:
          "Ищем управляющего с опытом работы в ПВЗ и контроля кассовой дисциплины.",
        shiftDate: new Date("2026-04-21"),
        paymentAmountRub: 65000,
        paymentType: PaymentType.MONTHLY,
        experienceLevelRequired: ExperienceLevel.ONE_PLUS_YEAR,
        isUrgent: false,
      },
    }));

  await prisma.application.upsert({
    where: {
      shiftPostId_applicantUserId: {
        shiftPostId: urgentShift.id,
        applicantUserId: worker.id,
      },
    },
    update: {
      message: "Готов выйти завтра, опыт в Ozon 8 месяцев.",
      status: ApplicationStatus.SHORTLISTED,
      score: 91,
    },
    create: {
      shiftPostId: urgentShift.id,
      applicantUserId: worker.id,
      message: "Готов выйти завтра, опыт в Ozon 8 месяцев.",
      status: ApplicationStatus.SHORTLISTED,
      score: 91,
    },
  });

  await prisma.application.upsert({
    where: {
      shiftPostId_applicantUserId: {
        shiftPostId: permanentShift.id,
        applicantUserId: tempWorker.id,
      },
    },
    update: {
      message: "Ранее управляла точкой Яндекс Маркета в Казани.",
      status: ApplicationStatus.APPLIED,
      score: 78,
    },
    create: {
      shiftPostId: permanentShift.id,
      applicantUserId: tempWorker.id,
      message: "Ранее управляла точкой Яндекс Маркета в Казани.",
      status: ApplicationStatus.APPLIED,
      score: 78,
    },
  });

  console.log("Seed completed", {
    regionsCount: regions.size,
    citiesCount: cities.size,
    ownerId: owner.id,
    workerId: worker.id,
    urgentShiftId: urgentShift.id,
    dailyShiftId: dailyShift.id,
    permanentShiftId: permanentShift.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
