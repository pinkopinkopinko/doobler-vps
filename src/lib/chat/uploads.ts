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
