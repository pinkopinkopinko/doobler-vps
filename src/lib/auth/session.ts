import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";

const SESSION_COOKIE = "pvz_session";

export type SessionPayload = {
  userId: string;
  telegramId: string;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string) {
  const result = await jwtVerify<SessionPayload>(token, getSessionSecret());
  return result.payload;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // КРИТИЧНО: Mini App открывается в iframe внутри web.telegram.org,
    // и без `SameSite=None` браузер считает cookie third-party и не
    // отправляет её обратно после `setSessionCookie` — авторизация на
    // Telegram Web ломалась именно из-за этого (auth/telegram 200, но
    // следующий auth/me 401: cookie не пришла назад).
    //
    // По спецификации `SameSite=None` обязывает выставить `Secure=true`,
    // иначе браузер cookie вообще не примет. Поэтому в любом env (даже
    // dev) cookie ставится только по HTTPS. Локально тестировать Mini App
    // и так нужно через HTTPS-туннель (ngrok), так что это совместимо.
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

const readSessionPayload = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
});

export async function getSessionPayload() {
  return readSessionPayload();
}
