"use client";

import { isVerboseLoggingEnabled } from "@/lib/log";
import {
  getTelegramInitData,
  getTelegramInitDataSafe,
  getTelegramUserId,
  getTelegramUserIdSafe,
  getTelegramWebApp,
} from "@/lib/telegram/webapp";

let authBootstrapPromise: Promise<boolean> | null = null;
let bootstrappedTelegramUserId: string | null = null;
let lastDebugSignature = "";
let lastDebugAt = 0;

const AUTH_CLIENT_REPORT_EVENTS = new Set([
  "bootstrap-start",
  "bootstrap-no-init-data",
  "bootstrap-auth-denied",
  "bootstrap-auth-ok",
  "bootstrap-telegram-mismatch",
  "bootstrap-finished",
  "bot-token-start",
  "bot-token-denied",
  "bot-token-ok",
  "ensure-rebootstrap",
  "ensure-reuse",
  "ensure-result",
  "fetch-start",
  "fetch-finished",
  "fetch-401",
  "fetch-reauth-failed",
  "fetch-retry-finished",
]);

function shouldSendDebug(event: string, payload: Record<string, unknown>) {
  const signature = `${event}:${JSON.stringify(payload)}`;
  const now = Date.now();

  if (signature === lastDebugSignature && now - lastDebugAt < 15_000) {
    return false;
  }

  lastDebugSignature = signature;
  lastDebugAt = now;
  return true;
}

function sanitizeDebugString(value: string) {
  return value
    .replace(/([?&](?:loginToken|token)=)[^&#]+/g, "$1<hidden>")
    .replace(/([?&]tgWebAppData=)[^&#]+/g, "$1<hidden>")
    .replace(/#tgWebAppData=.*$/g, "#<hidden>");
}

function sanitizeDebugPayload(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeDebugString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeDebugPayload);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        ["initData", "loginToken", "token"].includes(key) ? "<hidden>" : sanitizeDebugPayload(item),
      ]),
    );
  }

  return value;
}

function canUseStorage(kind: "localStorage" | "sessionStorage") {
  try {
    const storage = window[kind];
    const key = "__doobler_auth_debug__";
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getNavigationType() {
  try {
    return (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
      ?.type ?? null;
  } catch {
    return null;
  }
}

function getAuthClientDebugSnapshot() {
  const webApp = window.Telegram?.WebApp;
  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash ?? "";
  const loginToken = searchParams.get("loginToken")?.trim() ?? "";

  return {
    href: sanitizeDebugString(window.location.href),
    pathname: window.location.pathname,
    search: window.location.search ? "<present>" : "",
    searchKeys: Array.from(searchParams.keys()),
    hashLength: hash.length,
    hashHasTgWebAppData: hash.includes("tgWebAppData"),
    hasTelegram: Boolean(window.Telegram),
    hasWebApp: Boolean(webApp),
    initDataLength: webApp?.initData?.length ?? 0,
    unsafeUserId: webApp?.initDataUnsafe?.user?.id ?? null,
    colorScheme: webApp?.colorScheme ?? null,
    themeParamsKeys: Object.keys(webApp?.themeParams ?? {}),
    webAppVersion: webApp?.version ?? null,
    webAppPlatform: webApp?.platform ?? null,
    documentReadyState: document.readyState,
    visibilityState: document.visibilityState,
    performanceNow: Math.round(performance.now()),
    navigationType: getNavigationType(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    localStorageAvailable: canUseStorage("localStorage"),
    sessionStorageAvailable: canUseStorage("sessionStorage"),
    loginTokenPresent: Boolean(loginToken),
    loginTokenLength: loginToken.length,
  };
}

function shouldReportAuthClientEvent(
  event: string,
  payload: Record<string, unknown>,
  snapshot: ReturnType<typeof getAuthClientDebugSnapshot>,
) {
  if (!AUTH_CLIENT_REPORT_EVENTS.has(event)) {
    return false;
  }

  const url = typeof payload.url === "string" ? payload.url : "";
  const status = typeof payload.status === "number" ? payload.status : null;
  const critical =
    event.includes("denied") ||
    event.includes("failed") ||
    event.includes("401") ||
    event.includes("no-init-data") ||
    event.includes("mismatch") ||
    (status !== null && status >= 400);

  if (critical) return true;
  if (snapshot.loginTokenPresent) return true;
  if (event.startsWith("bot-token")) return true;
  if (event.startsWith("bootstrap")) return true;
  if (event.startsWith("ensure")) return true;
  if (
    url.includes("/api/auth/me") ||
    url.includes("/api/auth/bot-token") ||
    url.includes("/api/auth/telegram")
  ) {
    return true;
  }

  return Boolean(
    snapshot.hasWebApp ||
      snapshot.hashHasTgWebAppData ||
      (snapshot.initDataLength === 0 && isLikelyTelegramUserAgent()),
  );
}

function logAuthClientDebug(event: string, payload: Record<string, unknown>) {
  if (isVerboseLoggingEnabled) {
    console.info(`[tg-debug] client:${event}`, payload);
  }

  // Инцидент-репортинг на бэкенд — оставляем независимо от verbose-флага,
  // чтобы можно было разбирать ошибки авторизации в проде.
  if (
    typeof window !== "undefined" &&
    shouldSendDebug(event, payload)
  ) {
    const snapshot = getAuthClientDebugSnapshot();
    if (!shouldReportAuthClientEvent(event, payload, snapshot)) {
      return;
    }

    fetch("/api/auth/client-debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        source: "auth-client",
        event,
        ...snapshot,
        payload: sanitizeDebugPayload(payload),
      }),
    }).catch(() => undefined);
  }
}

async function getCurrentTelegramUserId() {
  return await getTelegramUserIdSafe();
}

function getBotLoginTokenFromUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("loginToken")?.trim() ?? "";
}

function removeBotLoginTokenFromUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has("loginToken")) {
    return;
  }

  url.searchParams.delete("loginToken");
  window.history.replaceState(window.history.state, "", url.toString());
}

async function bootstrapWithBotLoginToken(expectedTelegramUserId: string | null) {
  const loginToken = getBotLoginTokenFromUrl();
  // Отправляем initData (если Telegram его дал) — сервер по нему сверится,
  // что владелец loginToken совпадает с текущим Telegram-юзером.
  const initData = getTelegramInitData();

  logAuthClientDebug("bot-token-start", {
    expectedTelegramUserId,
    loginTokenPresent: Boolean(loginToken),
    loginTokenLength: loginToken.length,
    initDataLength: initData.length,
  });

  if (!loginToken) {
    return false;
  }

  // initData дублируем в заголовке: edge-валидатор (nginx/njs) режет всё,
  // что не подписано Telegram-токеном, ДО того как запрос дойдёт до Next.js.
  // В body initData оставляем для совместимости с route'ом /api/auth/bot-token.
  const authResponse = await fetch("/api/auth/bot-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(initData ? { "x-telegram-init-data": initData } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ token: loginToken, initData }),
  });

  if (!authResponse.ok) {
    const errorPayload = (await authResponse.json().catch(() => null)) as unknown;
    logAuthClientDebug("bot-token-denied", {
      expectedTelegramUserId,
      status: authResponse.status,
      payload: errorPayload,
    });
    return false;
  }

  const payload = (await authResponse.json().catch(() => null)) as
    | {
        user?: {
          telegramId?: string | null;
        };
      }
    | null;

  const sessionTelegramUserId = payload?.user?.telegramId ? String(payload.user.telegramId) : null;
  bootstrappedTelegramUserId = expectedTelegramUserId ?? sessionTelegramUserId ?? null;
  removeBotLoginTokenFromUrl();

  logAuthClientDebug("bot-token-ok", {
    expectedTelegramUserId,
    sessionTelegramUserId,
    bootstrappedTelegramUserId,
  });

  return true;
}

async function bootstrapTelegramSession(expectedTelegramUserId: string | null) {
  const loginToken = getBotLoginTokenFromUrl();
  const immediateInitData = getTelegramInitData();

  logAuthClientDebug("bootstrap-start", {
    expectedTelegramUserId,
    initDataLength: immediateInitData.length,
    loginTokenPresent: Boolean(loginToken),
    previousBootstrappedTelegramUserId: bootstrappedTelegramUserId,
  });

  if (loginToken) {
    const tokenResult = await bootstrapWithBotLoginToken(expectedTelegramUserId);
    if (tokenResult) {
      return true;
    }
  }

  const initData = immediateInitData || await getTelegramInitDataSafe();

  if (!initData) {
    logAuthClientDebug("bootstrap-no-init-data", {
      expectedTelegramUserId,
      loginTokenPresent: Boolean(loginToken),
    });
    bootstrappedTelegramUserId = null;
    return false;
  }

  // initData дублируем в заголовке: edge-валидатор (nginx/njs) на проде
  // делает HMAC-проверку до проксирования в Next.js. В body тоже оставляем
  // — Next.js разбирает initData оттуда же, чтобы не зависеть от заголовков.
  const authResponse = await fetch("/api/auth/telegram", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": initData,
    },
    credentials: "include",
    body: JSON.stringify({ initData }),
  });

  if (!authResponse.ok) {
    const errorPayload = (await authResponse.json().catch(() => null)) as unknown;
    logAuthClientDebug("bootstrap-auth-denied", {
      expectedTelegramUserId,
      status: authResponse.status,
      payload: errorPayload,
    });

    bootstrappedTelegramUserId = null;
    return false;
  }

  const payload = (await authResponse.json().catch(() => null)) as
    | {
        user?: {
          telegramId?: string | null;
        };
      }
    | null;

  const sessionTelegramUserId = payload?.user?.telegramId ? String(payload.user.telegramId) : null;

  logAuthClientDebug("bootstrap-auth-ok", {
    expectedTelegramUserId,
    sessionTelegramUserId,
    payloadHasUser: Boolean(payload?.user),
  });

  if (
    expectedTelegramUserId &&
    sessionTelegramUserId &&
    sessionTelegramUserId !== expectedTelegramUserId
  ) {
    bootstrappedTelegramUserId = null;
    logAuthClientDebug("bootstrap-telegram-mismatch", {
      expectedTelegramUserId,
      sessionTelegramUserId,
    });
    return false;
  }

  bootstrappedTelegramUserId = expectedTelegramUserId ?? sessionTelegramUserId ?? null;
  removeBotLoginTokenFromUrl();
  logAuthClientDebug("bootstrap-finished", {
    bootstrappedTelegramUserId,
  });
  return true;
}

export async function ensureTelegramSession(force = false) {
  const loginToken = getBotLoginTokenFromUrl();
  const currentTelegramUserId = loginToken ? getTelegramUserId() : await getCurrentTelegramUserId();
  const shouldRebootstrap =
    force ||
    Boolean(loginToken) ||
    !authBootstrapPromise ||
    Boolean(
      currentTelegramUserId &&
        bootstrappedTelegramUserId &&
        currentTelegramUserId !== bootstrappedTelegramUserId,
    );

  if (shouldRebootstrap) {
    logAuthClientDebug("ensure-rebootstrap", {
      force,
      currentTelegramUserId,
      bootstrappedTelegramUserId,
      hasExistingPromise: Boolean(authBootstrapPromise),
    });
    authBootstrapPromise = bootstrapTelegramSession(currentTelegramUserId);
  } else {
    logAuthClientDebug("ensure-reuse", {
      force,
      currentTelegramUserId,
      bootstrappedTelegramUserId,
    });
  }

  const result = await authBootstrapPromise;

  if (!result) {
    authBootstrapPromise = null;
    bootstrappedTelegramUserId = null;
  }

  logAuthClientDebug("ensure-result", {
    result,
    currentTelegramUserId,
    bootstrappedTelegramUserId,
  });

  return result;
}

function isLikelyTelegramUserAgent() {
  if (typeof navigator === "undefined") return false;
  return /Telegram-Android|Telegram-iOS|TelegramiOS|TgWebView/i.test(navigator.userAgent);
}

function buildAuthHeaders(initData: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("x-dubler-client", "telegram-mini-app");
  if (initData) {
    headers.set("x-telegram-init-data", initData);
  }
  return headers;
}

export async function fetchWithTelegramAuth(input: RequestInfo | URL, init?: RequestInit) {
  const loginToken = getBotLoginTokenFromUrl();
  if (loginToken) {
    await ensureTelegramSession(true);
  }

  // КРИТИЧНО: на Android Telegram WebView отдаёт initData асинхронно, а
  // прежде чем он успевает прийти, клиент мог уже отправить запрос с
  // одним лишь session-cookie от предыдущего юзера (cookies в Telegram
  // WebView шарятся между аккаунтами). Поэтому если есть признаки
  // Telegram (либо WebApp уже виден, либо user-agent от Telegram-клиента) —
  // ждём загрузки initData. В обычном браузере не блокируем запрос.
  const webAppPresent = Boolean(getTelegramWebApp());
  const insideTelegramWebApp = webAppPresent || isLikelyTelegramUserAgent();
  const initData = loginToken
    ? getTelegramInitData()
    : insideTelegramWebApp
      ? await getTelegramInitDataSafe()
      : getTelegramInitData();
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  logAuthClientDebug("fetch-start", {
    url,
    method: init?.method ?? "GET",
    initDataLength: initData.length,
    insideTelegramWebApp,
    webAppPresent,
    loginTokenPresent: Boolean(loginToken),
  });

  const initialResponse = await fetch(input, {
    ...init,
    headers: buildAuthHeaders(initData, init),
    credentials: "include",
  });

  if (initialResponse.status !== 401) {
    logAuthClientDebug("fetch-finished", {
      url,
      status: initialResponse.status,
      reauthenticated: false,
    });
    return initialResponse;
  }

  logAuthClientDebug("fetch-401", {
    url,
    status: initialResponse.status,
  });

  const reauthenticated = await ensureTelegramSession(true);
  if (!reauthenticated) {
    logAuthClientDebug("fetch-reauth-failed", {
      url,
    });
    return initialResponse;
  }

  // После переавторизации Telegram WebApp уже точно подгружен — пересоберём
  // заголовки со свежим initData, чтобы сервер мог сверить identity.
  const retryInitData = await getTelegramInitDataSafe();
  const retryResponse = await fetch(input, {
    ...init,
    headers: buildAuthHeaders(retryInitData, init),
    credentials: "include",
  });

  logAuthClientDebug("fetch-retry-finished", {
    url,
    status: retryResponse.status,
    retryInitDataLength: retryInitData.length,
  });

  return retryResponse;
}
