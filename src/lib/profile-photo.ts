// Серверная проверка аватарки профиля. Регексп в zod-схеме гарантирует
// формат строки, но НЕ — что внутри base64 действительно лежит файл
// заявленного MIME. Этот модуль декодирует содержимое и сравнивает первые
// байты с magic-bytes сигнатур JPEG / PNG / WebP. Если байты не совпали —
// клиент пытался подсунуть SVG/HTML/прочее под видом картинки.
//
// Также делаем повторную проверку байтового размера (после base64-декода),
// чтобы строковый лимит не обходился padding'ом.

const DATA_URI_PREFIX = /^data:image\/(jpeg|png|webp);base64,/;
const DATA_IMAGE_PREFIX = /^data:image\//i;
const TELEGRAM_USERPIC_URL_RE =
  /^https:\/\/t\.me\/i\/userpic\/\d+\/[A-Za-z0-9_-]+\.(svg|jpg|jpeg|png|webp)$/i;
const DEFAULT_COMPACT_INLINE_PHOTO_LIMIT = 8 * 1024;

const MAX_DECODED_BYTES = 2 * 1024 * 1024; // 2 МБ финального бинаря.

const SIGNATURES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // WebP: "RIFF" .... "WEBP".
  webpRiff: [0x52, 0x49, 0x46, 0x46],
  webpTag: [0x57, 0x45, 0x42, 0x50],
} as const;

function startsWith(buffer: Buffer, signature: readonly number[], offset = 0) {
  if (buffer.length < offset + signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[offset + i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

export type PhotoValidationResult =
  | { ok: true }
  | { ok: false; reason: "format_mismatch" | "decode_failed" | "too_large" };

export function isTrustedRemoteProfilePhotoUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) {
    return false;
  }

  return TELEGRAM_USERPIC_URL_RE.test(photoUrl);
}

/**
 * Проверяет, что photoUrl — либо same-origin ссылка на /api/uploads, либо
 * валидный data: URI, реально содержащий JPEG/PNG/WebP. Возвращает ok:true
 * для пустых значений (поле опциональное).
 */
export function validateProfilePhotoUrl(photoUrl: string | null | undefined): PhotoValidationResult {
  if (!photoUrl || photoUrl === "") {
    return { ok: true };
  }

  // Same-origin upload: магию проверять нечего, сам файл уже прошёл
  // через /api/uploads с MIME-валидацией.
  if (photoUrl.startsWith("/api/uploads/")) {
    return { ok: true };
  }

  if (isTrustedRemoteProfilePhotoUrl(photoUrl)) {
    return { ok: true };
  }

  const match = photoUrl.match(DATA_URI_PREFIX);
  if (!match) {
    return { ok: false, reason: "format_mismatch" };
  }

  const declaredMime = match[1] as "jpeg" | "png" | "webp";
  const base64 = photoUrl.slice(match[0].length);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, reason: "decode_failed" };
  }

  if (buffer.length === 0) {
    return { ok: false, reason: "decode_failed" };
  }

  if (buffer.length > MAX_DECODED_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  if (declaredMime === "jpeg" && startsWith(buffer, SIGNATURES.jpeg)) {
    return { ok: true };
  }

  if (declaredMime === "png" && startsWith(buffer, SIGNATURES.png)) {
    return { ok: true };
  }

  if (
    declaredMime === "webp" &&
    startsWith(buffer, SIGNATURES.webpRiff) &&
    startsWith(buffer, SIGNATURES.webpTag, 8)
  ) {
    return { ok: true };
  }

  return { ok: false, reason: "format_mismatch" };
}

export function compactProfilePhotoUrl(
  photoUrl: string | null | undefined,
  options?: { maxInlineLength?: number },
) {
  if (!photoUrl) {
    return null;
  }

  if (!DATA_IMAGE_PREFIX.test(photoUrl)) {
    return photoUrl;
  }

  const maxInlineLength = options?.maxInlineLength ?? DEFAULT_COMPACT_INLINE_PHOTO_LIMIT;
  return photoUrl.length <= maxInlineLength ? photoUrl : null;
}

export function buildCompactProfilePhotoSource(params: {
  userId: string;
  photoUrl: string | null | undefined;
  fallbackPath?: string;
  maxInlineLength?: number;
}) {
  const { photoUrl, fallbackPath = `/api/profile-photo/${params.userId}` } = params;
  const compact = compactProfilePhotoUrl(photoUrl, {
    maxInlineLength: params.maxInlineLength,
  });

  if (compact) {
    return compact;
  }

  if (photoUrl && DATA_IMAGE_PREFIX.test(photoUrl)) {
    return fallbackPath;
  }

  return null;
}

export function decodeInlineProfilePhoto(photoUrl: string | null | undefined) {
  if (!photoUrl) {
    return null;
  }

  const match = photoUrl.match(DATA_URI_PREFIX);
  if (!match) {
    return null;
  }

  const contentType = `image/${match[1]}`;
  const base64 = photoUrl.slice(match[0].length);

  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) {
      return null;
    }

    return {
      buffer,
      contentType,
    };
  } catch {
    return null;
  }
}
