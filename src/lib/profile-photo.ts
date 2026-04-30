// Серверная проверка аватарки профиля. Регексп в zod-схеме гарантирует
// формат строки, но НЕ — что внутри base64 действительно лежит файл
// заявленного MIME. Этот модуль декодирует содержимое и сравнивает первые
// байты с magic-bytes сигнатур JPEG / PNG / WebP. Если байты не совпали —
// клиент пытался подсунуть SVG/HTML/прочее под видом картинки.
//
// Также делаем повторную проверку байтового размера (после base64-декода),
// чтобы строковый лимит не обходился padding'ом.

const DATA_URI_PREFIX = /^data:image\/(jpeg|png|webp);base64,/;

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
