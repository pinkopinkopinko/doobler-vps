import { z } from "zod";

import { getTodayDateValue } from "@/lib/utils";

export const shiftPostSchema = z
  .object({
    pickupPointId: z.string().optional().nullable(),
    title: z.string().trim().min(5).max(120),
    type: z.enum(["URGENT_REPLACEMENT", "DAY_SHIFT", "PERMANENT_JOB"]),
    marketplaceId: z.string().min(1),
    cityId: z.string().min(1),
    regionId: z.string().min(1),
    district: z.string().trim().max(120).optional().nullable().transform((value) => value ?? ""),
    address: z.string().trim().min(5).max(255),
    addressSuggestionUri: z.string().trim().optional().nullable(),
    landmark: z.string().trim().max(255).optional().nullable(),
    description: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim() : value),
        z.string().max(1000).optional(),
      )
      .transform((value) => value ?? ""),
    shiftDate: z.string().min(1),
    startAt: z.string().optional().nullable(),
    endAt: z.string().optional().nullable(),
    paymentAmountRub: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().int().positive("Укажите оплату больше 0 ₽."),
    ),
    paymentType: z.enum(["FIXED_SHIFT", "HOURLY", "MONTHLY"]).default("FIXED_SHIFT"),
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

// Аватарка профиля. До этой ревизии profileSchema принимала «любую строку
// до 5 МБ» — это позволяло пихать в БД мегабайтовые data: URI с любыми MIME
// (svg+xml со скриптами, gif-анимации, всё что угодно), плюс раздувало
// payload и хранилище. Теперь:
//  - либо пусто / null,
//  - либо строгий data: URI на jpeg/png/webp + base64 (никаких svg/gif/html),
//  - либо same-origin ссылка вида /api/uploads/<cuid> (под будущую миграцию
//    на media-storage).
//
// 2_800_000 символов base64 ≈ 2 МБ исходного бинаря с запасом на padding
// и заголовок data: URI. Сам бинарь ограничен в magic-byte хелпере
// (profile-photo.ts) уже до 2 МБ, чтобы лимит работал и при идеально
// плотной кодировке. Финальная проверка соответствия MIME реальным
// байтам — там же.
const PHOTO_DATA_URI_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const PHOTO_UPLOAD_PATH_RE = /^\/api\/uploads\/[a-z0-9]+$/;

const photoUrlSchema = z
  .string()
  .max(2_800_000, "Фото должно быть меньше 2 МБ.")
  .refine(
    (value) =>
      value === "" ||
      PHOTO_DATA_URI_RE.test(value) ||
      PHOTO_UPLOAD_PATH_RE.test(value),
    "Поддерживаются только JPEG, PNG и WebP до 2 МБ.",
  )
  .optional()
  .nullable();

export const profileSchema = z
  .object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(2).max(80).optional().nullable(),
    age: z.coerce.number().int().min(14).max(80).optional().nullable(),
    photoUrl: photoUrlSchema,
    // Поле осталось в БД для будущей верификации, но в UI его сейчас нет —
    // отдаём свободный текст до 64 символов, без обязательного формата.
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
    roles: z.array(z.enum(["OWNER", "MANAGER", "EMPLOYEE", "TEMP_WORKER", "MODERATOR"])).min(1),
    marketplaces: z.array(z.enum(["OZON", "WB", "YANDEX", "OTHER"])).default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.age || value.age < 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите возраст.",
        path: ["age"],
      });
    }

    if (!value.photoUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Добавьте аватарку профиля.",
        path: ["photoUrl"],
      });
    }

    if (value.roles.includes("OWNER") && value.marketplaces.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Отметьте маркетплейсы, ПВЗ которых у вас есть.",
        path: ["marketplaces"],
      });
    }

    if (
      (value.roles.includes("EMPLOYEE") || value.roles.includes("TEMP_WORKER")) &&
      !value.experienceSummary?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для сотрудника нужно указать опыт работы.",
        path: ["experienceSummary"],
      });
    }
  });

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(4).max(500),
});
