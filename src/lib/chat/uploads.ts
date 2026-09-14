import { extname } from "node:path";

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type UploadValidationFailure = {
  ok: false;
  code: "missing" | "too_large" | "bad_type";
  message: string;
};

export type UploadValidationSuccess = {
  ok: true;
  mimeType: string;
  byteSize: number;
  extension: string;
};

function startsWith(data: Uint8Array, signature: readonly number[], offset = 0) {
  if (data.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => data[offset + index] === byte);
}

function hasGifSignature(data: Uint8Array) {
  const gif87a = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
  const gif89a = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
  return startsWith(data, gif87a) || startsWith(data, gif89a);
}

export function validateUploadBytes(mimeType: string, data: Uint8Array) {
  const normalizedMime = mimeType.toLowerCase();
  const matches =
    (normalizedMime === "image/jpeg" && startsWith(data, [0xff, 0xd8, 0xff])) ||
    (normalizedMime === "image/png" &&
      startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (normalizedMime === "image/webp" &&
      startsWith(data, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) ||
    (normalizedMime === "image/gif" && hasGifSignature(data));

  if (!matches) {
    return {
      ok: false as const,
      message: "Файл не похож на заявленное изображение.",
    };
  }

  return { ok: true as const };
}

export function validateUpload(file: {
  size: number;
  type: string;
  name?: string;
}): UploadValidationSuccess | UploadValidationFailure {
  if (!file || file.size === 0) {
    return { ok: false, code: "missing", message: "Файл пустой." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "too_large",
      message: `Размер файла больше ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ.`,
    };
  }

  const mimeType = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      code: "bad_type",
      message: "Можно прикреплять только изображения (JPEG / PNG / WebP / GIF).",
    };
  }

  const fallbackExt = file.name ? extname(file.name).toLowerCase() : "";
  return {
    ok: true,
    mimeType,
    byteSize: file.size,
    extension: EXT_BY_MIME[mimeType] ?? fallbackExt ?? "",
  };
}
