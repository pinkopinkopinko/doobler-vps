import type { ApplicationCard, ProfileView, ShiftCard, UserSummary } from "@/lib/types";
import { RUSSIAN_MILLION_CITIES } from "@/lib/russian-million-cities";
import { getDateInputValue } from "@/lib/utils";

function buildFutureDate(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return getDateInputValue(date);
}

function buildFutureDateTime(daysFromToday: number, hours: number, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

const tomorrow = buildFutureDate(1);
const dayAfterTomorrow = buildFutureDate(2);
const inThreeDays = buildFutureDate(3);

export const demoRegions = RUSSIAN_MILLION_CITIES.map((item) => ({
  id: item.regionId,
  name: item.regionName,
})).filter(
  (region, index, list) => list.findIndex((item) => item.id === region.id) === index,
);

export const demoCities = RUSSIAN_MILLION_CITIES.map((item) => ({
  id: item.cityId,
  regionId: item.regionId,
  name: item.cityName,
}));

export const demoMarketplaces = [
  { id: "mp_ozon", code: "OZON", name: "Ozon" },
  { id: "mp_wb", code: "WB", name: "Wildberries" },
  { id: "mp_yandex", code: "YANDEX", name: "Яндекс Маркет" },
  { id: "mp_other", code: "OTHER", name: "Другое" },
] as const;

export const demoUsers: UserSummary[] = [
  {
    id: "user_owner_1",
    telegramId: "1000001",
    firstName: "Анна",
    lastName: "Левина",
    username: "anna_pvz_owner",
    age: 33,
    photoUrl: "https://placehold.co/160x160/2aabee/ffffff?text=%D0%90%D0%9B",
    pickupPointCode: "МОСКВА_101",
    isOnboardingCompleted: true,
    cityName: "Москва",
    district: "Сокольники",
    roles: ["OWNER"],
    marketplaces: ["OZON", "YANDEX"],
    ratingAvg: 4.9,
    ratingCount: 16,
    completedAssignmentsCount: 34,
    verificationStatus: "APPROVED",
    isPhoneVerified: false,
  },
  {
    id: "user_worker_1",
    telegramId: "1000002",
    firstName: "Игорь",
    lastName: "Панов",
    username: "igor_shift",
    age: 26,
    photoUrl: "https://placehold.co/160x160/4caf8d/ffffff?text=%D0%98%D0%9F",
    experienceSummary: "1.0",
    isOnboardingCompleted: true,
    cityName: "Москва",
    district: "Сокольники",
    roles: ["EMPLOYEE", "TEMP_WORKER"],
    marketplaces: ["OZON", "WB"],
    ratingAvg: 4.7,
    ratingCount: 21,
    completedAssignmentsCount: 27,
    verificationStatus: "APPROVED",
    isPhoneVerified: false,
  },
  {
    id: "user_worker_2",
    telegramId: "1000003",
    firstName: "Мария",
    lastName: "Смирнова",
    username: "mariya_pvz",
    age: 29,
    photoUrl: "https://placehold.co/160x160/5b7cfa/ffffff?text=%D0%9C%D0%A1",
    experienceSummary: "2.5",
    isOnboardingCompleted: true,
    cityName: "Казань",
    district: "Ново-Савиновский",
    roles: ["TEMP_WORKER"],
    marketplaces: ["YANDEX"],
    ratingAvg: 4.5,
    ratingCount: 8,
    completedAssignmentsCount: 11,
    verificationStatus: "PENDING",
    isPhoneVerified: false,
  },
];

export const demoShiftPosts: ShiftCard[] = [
  {
    id: "shift_1",
    createdByUserId: "user_owner_1",
    title: "Срочно нужен сотрудник на вечернюю смену",
    type: "URGENT_REPLACEMENT",
    status: "PUBLISHED",
    marketplace: "OZON",
    cityName: "Москва",
    regionName: "Москва",
    district: "Сокольники",
    address: "ул. Стромынка, 19к2",
    landmark: "рядом с метро Сокольники",
    shiftDate: tomorrow,
    startAt: buildFutureDateTime(1, 10),
    endAt: buildFutureDateTime(1, 20),
    paymentAmountRub: 4500,
    paymentType: "FIXED_SHIFT",
    experienceLevelRequired: "LESS_THAN_3_MONTHS",
    isUrgent: true,
    description:
      "Нужна подмена на один день. Важен опыт выдачи посылок и работы с возвратами.",
    createdByName: "Анна Левина",
    applicationsCount: 4,
    favorite: true,
  },
  {
    id: "shift_2",
    createdByUserId: "user_owner_1",
    title: "Смена на день в Wildberries",
    type: "DAY_SHIFT",
    status: "PUBLISHED",
    marketplace: "WB",
    cityName: "Санкт-Петербург",
    regionName: "Санкт-Петербург",
    district: "Приморский",
    address: "Богатырский проспект, 12",
    landmark: "ТЦ у метро Пионерская",
    shiftDate: dayAfterTomorrow,
    startAt: buildFutureDateTime(2, 9),
    endAt: buildFutureDateTime(2, 21),
    paymentAmountRub: 5000,
    paymentType: "FIXED_SHIFT",
    experienceLevelRequired: "THREE_TO_TWELVE_MONTHS",
    isUrgent: false,
    description: "Ищем опытного сотрудника на дневную смену с уверенным знанием приёмки.",
    createdByName: "Олег Морозов",
    applicationsCount: 2,
    favorite: false,
  },
  {
    id: "shift_3",
    createdByUserId: "user_owner_1",
    title: "Замена старшего сотрудника ПВЗ",
    type: "DAY_SHIFT",
    status: "PUBLISHED",
    marketplace: "YANDEX",
    cityName: "Казань",
    regionName: "Республика Татарстан",
    district: "Ново-Савиновский",
    address: "ул. Чистопольская, 75",
    landmark: "ЖК Магеллан",
    shiftDate: inThreeDays,
    startAt: null,
    endAt: null,
    paymentAmountRub: 6500,
    paymentType: "FIXED_SHIFT",
    experienceLevelRequired: "ONE_PLUS_YEAR",
    isUrgent: false,
    description:
      "Нужна замена на один день для ПВЗ с опытом работы на выдаче и возвратах.",
    createdByName: "Сеть ПВЗ Казань",
    applicationsCount: 5,
    favorite: false,
  },
];

const demoEmployerView = {
  id: demoUsers[0].id,
  firstName: demoUsers[0].firstName,
  lastName: demoUsers[0].lastName,
  username: demoUsers[0].username,
  photoUrl: demoUsers[0].photoUrl ?? null,
};

const demoApplicantViews = demoUsers.slice(1).map((user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  photoUrl: user.photoUrl ?? null,
  experienceSummary: user.experienceSummary ?? null,
  cityName: user.cityName,
  district: user.district,
  marketplaces: user.marketplaces,
  ratingAvg: user.ratingAvg,
  completedAssignmentsCount: user.completedAssignmentsCount,
}));

export const demoApplications: ApplicationCard[] = [
  {
    id: "application_1",
    shiftPostId: "shift_1",
    shiftTitle: "Срочно нужен сотрудник на вечернюю смену",
    shiftMarketplace: "OZON",
    applicant: demoApplicantViews[0],
    employer: demoEmployerView,
    status: "SHORTLISTED",
    message: "Готов выйти завтра, опыт в Ozon 8 месяцев.",
    score: 91,
    createdAt: "2026-04-17T09:30:00.000Z",
    assignment: null,
  },
  {
    id: "application_2",
    shiftPostId: "shift_3",
    shiftTitle: "Замена старшего сотрудника ПВЗ",
    shiftMarketplace: "YANDEX",
    applicant: demoApplicantViews[1],
    employer: demoEmployerView,
    status: "APPLIED",
    message: "Готова выйти на замену, есть опыт работы в ПВЗ.",
    score: 78,
    createdAt: "2026-04-17T10:05:00.000Z",
    assignment: null,
  },
];

export const demoProfile: ProfileView = {
  ...demoUsers[1],
  bio: "Работаю с Ozon и WB, умею принимать возвраты и закрывать кассу.",
  phone: null,
  badges: ["Проверенный профиль", "27 завершённых смен", "Высокий рейтинг"],
  recentReviews: [
    {
      id: "review_1",
      authorName: "Анна Левина",
      rating: 5,
      text: "Приехал вовремя, уверенно работал с клиентами и возвратами.",
      createdAt: "2026-04-10T12:00:00.000Z",
    },
    {
      id: "review_2",
      authorName: "Олег Морозов",
      rating: 4,
      text: "Хорошая смена, аккуратная работа с приёмкой.",
      createdAt: "2026-03-28T12:00:00.000Z",
    },
  ],
};
