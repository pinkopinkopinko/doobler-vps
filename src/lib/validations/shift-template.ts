import { z } from "zod";

const timeSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Укажите корректное время.")
    .optional()
    .nullable(),
);

export const shiftTemplateSchema = z
  .object({
    name: z.string().trim().min(1, "Назовите шаблон.").max(60),
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
    startAt: timeSchema,
    endAt: timeSchema,
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
    if (!value.pickupPointId?.trim() && !value.addressSuggestionUri?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите адрес из подсказок перед сохранением шаблона.",
        path: ["addressSuggestionUri"],
      });
    }
  });
