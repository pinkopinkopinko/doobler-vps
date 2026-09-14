import { z } from "zod";

import { isTrustedRemoteProfilePhotoUrl } from "@/lib/profile-photo";
import { getTodayDateValue } from "@/lib/utils";

const NAME_RE = /^[\p{L}\s'-]+$/u;
const PHOTO_DATA_URI_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const PHOTO_UPLOAD_PATH_RE = /^\/api\/uploads\/[a-z0-9]+$/;

export const shiftPostSchema = z
  .object({
    pickupPointId: z.string().optional().nullable(),
    title: z.string().trim().min(5, "Вам нужно добавить заголовок").max(120),
    type: z.enum(["URGENT_REPLACEMENT", "DAY_SHIFT"]),
    marketplaceId: z.string().min(1, "Выберите маркетплейс"),
    cityId: z.string().min(1, "Выберите город"),
    regionId: z.string().min(1, "Укажите регион"),
    district: z.string().trim().max(120).optional().nullable().transform((value) => value ?? ""),
    address: z.string().trim().min(5, "Введите адрес").max(255),
    addressSuggestionUri: z.string().trim().optional().nullable(),
    landmark: z.string().trim().max(255).optional().nullable(),
    description: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim() : value),
        z.string().max(1000).optional(),
      )
      .transform((value) => value ?? ""),
    shiftDate: z.string().min(1, "Выберите дату смены"),
    startAt: z.string().optional().nullable(),
    endAt: z.string().optional().nullable(),
    paymentAmountRub: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().int().positive("Укажите оплату больше 0 ₽."),
    ),
    paymentType: z.enum(["FIXED_SHIFT", "HOURLY"]).default("FIXED_SHIFT"),
    experienceLevelRequired: z.enum([
      "NO_EXPERIENCE",
      "LESS_THAN_3_MONTHS",
      "THREE_TO_TWELVE_MONTHS",
      "ONE_PLUS_YEAR",
    ]),
    isUrgent: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.shiftDate < getTodayDateValue()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Нельзя поставить дату меньше сегодняшней.",
        path: ["shiftDate"],
      });
    }

    if (!value.pickupPointId && !value.addressSuggestionUri?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите адрес из подсказок.",
        path: ["addressSuggestionUri"],
      });
    }
  });

export const applicationSchema = z.object({
  message: z.string().max(500).optional().nullable(),
});

const photoUrlSchema = z
  .string()
  .max(2_800_000, "Фото должно быть меньше 2 МБ.")
  .refine(
    (value) =>
      value === "" ||
      PHOTO_DATA_URI_RE.test(value) ||
      PHOTO_UPLOAD_PATH_RE.test(value) ||
      isTrustedRemoteProfilePhotoUrl(value),
    "Поддерживаются только JPEG, PNG, WebP и Telegram userpic SVG до 2 МБ.",
  )
  .optional()
  .nullable();

export const profileSchema = z
  .object({
    firstName: z.string().trim().min(2).max(80).regex(NAME_RE, "Имя не должно содержать цифры."),
    lastName: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(NAME_RE, "Фамилия не должна содержать цифры.")
      .optional()
      .nullable(),
    age: z.coerce.number().int().min(16).max(99).optional().nullable(),
    photoUrl: photoUrlSchema,
    pickupPointCode: z.string().max(64).optional().nullable(),
    experienceSummary: z
      .string()
      .regex(/^(?:0\.5|[1-9]\d*(?:\.5)?)$/, "Укажите опыт в годах: 0.5, 1, 1.5, 2, 2.5")
      .optional()
      .nullable(),
    username: z.string().max(80).optional().nullable(),
    bio: z.string().max(500).optional().nullable(),
    cityId: z.string().min(1),
    regionId: z.string().min(1),
    district: z.string().max(120).optional().nullable(),
    roles: z.array(z.enum(["OWNER", "EMPLOYEE", "TEMP_WORKER"])).min(1),
    marketplaces: z.array(z.enum(["OZON", "WB", "YANDEX", "OTHER"])).default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.age || value.age < 16 || value.age > 99) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите возраст от 16 до 99 лет.",
        path: ["age"],
      });
    }

    if (value.roles.includes("OWNER") && value.marketplaces.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Отметьте маркетплейсы, ПВЗ которых у вас есть.",
        path: ["marketplaces"],
      });
    }

    const isWorker =
      value.roles.includes("EMPLOYEE") || value.roles.includes("TEMP_WORKER");

    if (isWorker && !value.experienceSummary?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для сотрудника нужно указать опыт работы.",
        path: ["experienceSummary"],
      });
    }

    if (!value.cityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите город профиля.",
        path: ["cityId"],
      });
    }
  });

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(4).max(500),
});
