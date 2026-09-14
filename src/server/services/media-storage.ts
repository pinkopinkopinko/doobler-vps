import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type StoredMedia = {
  storageKey: string;
  absolutePath: string;
};

function getUploadsRoot(): string {
  // Explicit override wins on every platform — this is what production should set
  // (e.g. mounted volume in Docker) so uploads survive restarts.
  const explicit = process.env.UPLOADS_DIR?.trim();
  if (explicit) {
    return explicit;
  }

  const localAppData = process.env.LOCALAPPDATA?.trim();
  if (localAppData) {
    return join(localAppData, "Dubler", "uploads");
  }

  if (process.env.NODE_ENV === "production") {
    // Refuse to silently write to /tmp in production; that data is ephemeral.
    throw new Error(
      "UPLOADS_DIR is not configured. Set UPLOADS_DIR to a persistent directory.",
    );
  }

  return join(tmpdir(), "dubler-uploads");
}

function getMediaAbsolutePath(storageKey: string) {
  const safeKey = sanitizeKey(storageKey);

  return {
    safeKey,
    absolutePath: join(getUploadsRoot(), safeKey),
  };
}

function sanitizeKey(key: string) {
  if (!/^[A-Za-z0-9/._-]+$/.test(key)) {
    throw new Error("Invalid storage key");
  }
  if (key.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return key;
}

export function buildStorageKey(scope: string, extension: string) {
  const safeScope = scope.replace(/[^A-Za-z0-9_-]/g, "");
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = randomBytes(12).toString("hex");
  const ext = extension.startsWith(".") ? extension : extension ? `.${extension}` : "";
  return `${safeScope || "misc"}/${stamp}/${random}${ext}`;
}

export async function writeMedia(storageKey: string, data: Uint8Array): Promise<StoredMedia> {
  const { safeKey, absolutePath } = getMediaAbsolutePath(storageKey);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, data);

  return { storageKey: safeKey, absolutePath };
}

export async function readMedia(storageKey: string): Promise<Buffer> {
  const { absolutePath } = getMediaAbsolutePath(storageKey);

  return readFile(absolutePath);
}

export async function statMedia(storageKey: string) {
  const { absolutePath } = getMediaAbsolutePath(storageKey);
  const info = await stat(absolutePath);

  if (!info.isFile()) {
    throw new Error("Media is not a file");
  }

  return {
    byteSize: info.size,
    mtime: info.mtime,
  };
}

export function createMediaReadStream(storageKey: string) {
  const { absolutePath } = getMediaAbsolutePath(storageKey);

  return createReadStream(absolutePath);
}

export async function deleteMedia(storageKey: string): Promise<void> {
  const { absolutePath } = getMediaAbsolutePath(storageKey);

  await unlink(absolutePath).catch(() => undefined);
}

export async function mediaExists(storageKey: string): Promise<boolean> {
  const { absolutePath } = getMediaAbsolutePath(storageKey);

  try {
    const info = await stat(absolutePath);
    return info.isFile();
  } catch {
    return false;
  }
}

export function getUploadsRootForTests() {
  return getUploadsRoot();
}
