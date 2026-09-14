export const APP_NAME = "Дублер";

export const APP_ROLES = [
  { value: "OWNER", label: "Владелец ПВЗ" },
  { value: "MANAGER", label: "Управляющий" },
  { value: "EMPLOYEE", label: "Сотрудник ПВЗ" },
  { value: "TEMP_WORKER", label: "Подменный сотрудник" },
  { value: "MODERATOR", label: "Модератор" },
] as const;

export const SHIFT_POST_TYPES = [
  { value: "URGENT_REPLACEMENT", label: "Срочная замена" },
  { value: "DAY_SHIFT", label: "Смена на день" },
] as const;

export const MARKETPLACE_CODES = [
  { value: "OZON", label: "Ozon" },
  { value: "WB", label: "Wildberries" },
  { value: "YANDEX", label: "Яндекс Маркет" },
  { value: "OTHER", label: "Другое" },
] as const;

export const EXPERIENCE_LEVELS = [
  { value: "NO_EXPERIENCE", label: "Без опыта" },
  { value: "LESS_THAN_3_MONTHS", label: "До 3 месяцев" },
  { value: "THREE_TO_TWELVE_MONTHS", label: "3–12 месяцев" },
  { value: "ONE_PLUS_YEAR", label: "1 год и больше" },
] as const;

export const SHIFT_STATUSES = [
  { value: "PUBLISHED", label: "Опубликовано" },
  { value: "IN_REVIEW", label: "На проверке" },
  { value: "MATCHED", label: "Исполнитель найден" },
  { value: "CLOSED", label: "Закрыто" },
  { value: "CANCELLED", label: "Отменено" },
  { value: "EXPIRED", label: "Срок истек" },
] as const;

export const APPLICATION_STATUSES = [
  { value: "APPLIED", label: "Откликнулся" },
  { value: "SHORTLISTED", label: "В шорт-листе" },
  { value: "REJECTED", label: "Отклонен" },
  { value: "WITHDRAWN", label: "Отклик отозван" },
  { value: "CONFIRMED", label: "Подтвержден" },
  { value: "NO_SHOW", label: "Не вышел на смену" },
  { value: "CANCELLED_BY_WORKER", label: "Отменено исполнителем" },
  { value: "CANCELLED_BY_EMPLOYER", label: "Отменено работодателем" },
] as const;

export const REPORT_REASONS = [
  "Фейковое объявление",
  "Невежливое общение",
  "Подозрительный профиль",
  "Неявка на смену",
  "Неверная информация в объявлении",
] as const;
