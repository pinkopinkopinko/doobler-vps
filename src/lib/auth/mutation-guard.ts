import { fail } from "@/lib/api";
import { inspectTelegramInitData } from "@/lib/auth/telegram";

const TRUSTED_CLIENT_HEADER = "x-dubler-client";
const TRUSTED_CLIENT_VALUE = "telegram-mini-app";

function getOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function requireSameOriginMutationRequest(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    return null;
  }

  if (hasSameOriginHeader(request)) {
    return null;
  }

  return fail("Untrusted request source.", 403);
}

function getTargetOrigins(request: Request) {
  const origins = new Set<string>();
  const requestOrigin = getOrigin(request.url);
  if (requestOrigin) {
    origins.add(requestOrigin);
  }

  const configuredOrigin = getOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (configuredOrigin) {
    origins.add(configuredOrigin);
  }

  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    origins.add(`${forwardedProto.split(",")[0]?.trim() || "https"}://${forwardedHost.split(",")[0]?.trim()}`);
  }

  return origins;
}

function hasSameOriginHeader(request: Request) {
  const targetOrigins = getTargetOrigins(request);
  const origin = getOrigin(request.headers.get("origin"));
  if (origin) {
    return targetOrigins.has(origin);
  }

  const referer = getOrigin(request.headers.get("referer"));
  return Boolean(referer && targetOrigins.has(referer));
}

function hasTrustedTelegramInitData(request: Request, sessionTelegramId?: string | null) {
  if (!sessionTelegramId) {
    return false;
  }

  const initData = request.headers.get("x-telegram-init-data")?.trim();
  if (!initData) {
    return false;
  }

  const inspection = inspectTelegramInitData(initData);
  if (!inspection.ok) {
    return false;
  }

  return String(inspection.user.id) === String(sessionTelegramId);
}

export function requireTrustedMutationRequest(
  request: Request,
  options: { sessionTelegramId?: string | null } = {},
) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    return null;
  }

  if (hasTrustedTelegramInitData(request, options.sessionTelegramId)) {
    return null;
  }

  if (hasSameOriginHeader(request)) {
    return null;
  }

  if (request.headers.get(TRUSTED_CLIENT_HEADER) === TRUSTED_CLIENT_VALUE) {
    return null;
  }

  return fail("Недоверенный источник запроса.", 403);
}
