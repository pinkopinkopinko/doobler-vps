import { scryptSync, timingSafeEqual } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const ADMIN_SESSION_COOKIE = "dubler_admin_session";

export type AdminSessionPayload = {
  username: string;
  mode: "password";
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

type AdminCredentials = {
  login: string;
  passwordHash: string | null;
  passwordPlain: string | null;
};

function getAdminCredentials(): AdminCredentials {
  return {
    login: process.env.ADMIN_LOGIN?.trim() ?? "",
    // Preferred: ADMIN_PASSWORD_HASH in `scrypt$N$r$p$saltHex$keyHex` format
    // (see scripts/hash-admin-password.ts). Plain ADMIN_PASSWORD is still
    // accepted for dev convenience but logged as a warning.
    passwordHash: process.env.ADMIN_PASSWORD_HASH?.trim() || null,
    passwordPlain: process.env.ADMIN_PASSWORD || null,
  };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function safeBufferEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Verifies a password against a hash in the format `scrypt$N$r$p$saltHex$keyHex`.
 * Returns false on any malformed hash or mismatch.
 */
function verifyScryptHash(password: string, hash: string) {
  const parts = hash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }
  let salt: Buffer;
  let key: Buffer;
  try {
    salt = Buffer.from(parts[4], "hex");
    key = Buffer.from(parts[5], "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || key.length === 0) {
    return false;
  }
  let derived: Buffer;
  try {
    derived = scryptSync(password, salt, key.length, { N, r, p });
  } catch {
    return false;
  }
  return safeBufferEqual(derived, key);
}

export function hasConfiguredAdminCredentials() {
  const credentials = getAdminCredentials();
  return Boolean(credentials.login) && Boolean(credentials.passwordHash || credentials.passwordPlain);
}

export function validateAdminCredentials(login: string, password: string) {
  const credentials = getAdminCredentials();

  if (!credentials.login) {
    return false;
  }
  if (!credentials.passwordHash && !credentials.passwordPlain) {
    return false;
  }

  if (!safeEqual(login.trim(), credentials.login)) {
    return false;
  }

  if (credentials.passwordHash) {
    return verifyScryptHash(password, credentials.passwordHash);
  }

  // Fallback to plaintext comparison — dev only.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[admin-auth] ADMIN_PASSWORD_HASH is not set; refusing plaintext ADMIN_PASSWORD in production.",
    );
    return false;
  }
  return safeEqual(password, credentials.passwordPlain ?? "");
}

export async function createAdminSessionToken(payload: AdminSessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getSessionSecret());
}

export async function verifyAdminSessionToken(token: string) {
  const result = await jwtVerify<AdminSessionPayload>(token, getSessionSecret());
  return result.payload;
}

export async function setAdminSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSessionPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifyAdminSessionToken(token);
  } catch {
    return null;
  }
}
