import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  APPLICATION_STATUSES,
  EXPERIENCE_LEVELS,
  MARKETPLACE_CODES,
  SHIFT_POST_TYPES,
  SHIFT_STATUSES,
} from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
  }).format(new Date(value));
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatShiftTimeRange(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) {
    return null;
  }

  return `${formatTime(startAt)}-${formatTime(endAt)}`;
}

export function getDateInputValue(date = new Date(), timeZone = "Europe/Moscow") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function getTodayDateValue(timeZone = "Europe/Moscow") {
  return getDateInputValue(new Date(), timeZone);
}

export function getMarketplaceLabel(value: string) {
  return MARKETPLACE_CODES.find((item) => item.value === value)?.label ?? value;
}

export function getShiftTypeLabel(value: string) {
  return SHIFT_POST_TYPES.find((item) => item.value === value)?.label ?? value;
}

export function getShiftStatusLabel(value: string) {
  return SHIFT_STATUSES.find((item) => item.value === value)?.label ?? value;
}

export function getApplicationStatusLabel(value: string) {
  return APPLICATION_STATUSES.find((item) => item.value === value)?.label ?? value;
}

export function getExperienceLabel(value: string) {
  return EXPERIENCE_LEVELS.find((item) => item.value === value)?.label ?? value;
}

export function buildTelegramProfileUrl(username: string | null) {
  return username ? `https://t.me/${username}` : null;
}

export function isValidExperienceYears(value: string | null | undefined) {
  return /^(?:0\.5|[1-9]\d*(?:\.5)?)$/.test((value ?? "").trim());
}

export function normalizeExperienceYearsInput(value: string | null | undefined) {
  const trimmed = (value ?? "").trim().replace(",", ".");

  if (!trimmed) {
    return "";
  }

  return isValidExperienceYears(trimmed) ? trimmed : "";
}

export function formatExperienceYears(value: string | null | undefined) {
  const normalized = normalizeExperienceYearsInput(value);

  if (!normalized) {
    return null;
  }

  const years = Number(normalized);

  if (!Number.isFinite(years)) {
    return null;
  }

  const isFractional = years % 1 !== 0;
  const mod100 = years % 100;
  const mod10 = years % 10;

  let unit = "лет";

  if (isFractional) {
    unit = "года";
  } else if (mod100 >= 11 && mod100 <= 14) {
    unit = "лет";
  } else if (mod10 === 1) {
    unit = "год";
  } else if (mod10 >= 2 && mod10 <= 4) {
    unit = "года";
  }

  return `${normalized} ${unit}`;
}

export function normalizeDistrictName(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  return trimmed
    .replace(/\b(?:р-?н|район)\b/giu, "")
    .replace(/\b(?:жилой район|микрорайон)\b/giu, "")
    .replace(/\s+/g, " ")
    .replace(/^[,\s-]+|[,\s-]+$/g, "")
    .trim();
}

export function getDistrictCompareKey(value: string | null | undefined) {
  return normalizeDistrictName(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLocationPart(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCountryLocationPart(value: string) {
  const normalized = normalizeLocationPart(value);
  return normalized === "россия" || normalized === "российская федерация";
}

function isRegionLocationPart(value: string) {
  const normalized = normalizeLocationPart(value);

  return (
    normalized.includes("область") ||
    normalized.includes("обл.") ||
    normalized === "обл" ||
    normalized.endsWith(" обл") ||
    normalized.includes("край") ||
    normalized.includes("республика") ||
    normalized.includes("респ.") ||
    normalized.startsWith("респ ") ||
    normalized.includes("автономный округ") ||
    normalized.includes("автономная область") ||
    normalized === "ао" ||
    normalized.endsWith(" ао")
  );
}

function locationPartMatches(part: string, target: string | null | undefined) {
  if (!target) {
    return false;
  }

  const normalizedPart = normalizeLocationPart(part);
  const normalizedTarget = normalizeLocationPart(target);

  return normalizedPart === normalizedTarget || normalizedPart.includes(normalizedTarget);
}

function formatShiftAddressPart(value: string) {
  return value
    .replace(/(^|\s)ул\.?\s+/giu, "$1ул. ")
    .replace(/(^|\s)дом\s*([0-9А-ЯA-ZЁ/\\-])/giu, "$1д.$2")
    .replace(/(^|\s)д\.?\s*([0-9А-ЯA-ZЁ/\\-])/giu, "$1д.$2")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCompactShiftAddress(
  city: string | null | undefined,
  district: string | null | undefined,
  address: string | null | undefined,
) {
  const addressParts = (address ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isCountryLocationPart(part))
    .filter((part) => !isRegionLocationPart(part));

  const dedupedAddressParts = addressParts.filter((part, index, parts) => {
    const normalized = normalizeLocationPart(part);
    return parts.findIndex((item) => normalizeLocationPart(item) === normalized) === index;
  });

  const specificAddressParts = dedupedAddressParts.filter(
    (part) => !locationPartMatches(part, city) && !locationPartMatches(part, district),
  );

  return specificAddressParts.map(formatShiftAddressPart).join(", ");
}

export function formatShiftLocation(
  city: string | null | undefined,
  district: string | null | undefined,
  address: string | null | undefined,
) {
  const compactAddress = formatCompactShiftAddress(city, district, address);
  const locationParts = [city, district]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const resultParts = compactAddress ? [...locationParts, compactAddress] : locationParts;

  return resultParts.join(", ");
}
