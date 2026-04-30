"use client";

import { isVerboseLoggingEnabled } from "@/lib/log";
import {
  getTelegramInitData,
  getTelegramInitDataSafe,
  getTelegramUserIdSafe,
  getTelegramWebApp,
} from "@/lib/telegram/webapp";

let authBootstrapPromise: Promise<boolean> | null = null;
let bootstrappedTelegramUserId: string | null = null;
let lastDebugSignature = "";
let lastDebugAt = 0;

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

function logAuthClientDebug(event: string, payload: Record<string, unknown>) {
  if (isVerboseLoggingEnabled) {
    console.info(`[tg-debug] client:${event}`, payload);
  }

  // Инцидент-репортинг на бэкенд — оставляем независимо от verbose-флага,
  // чтобы можно было разбирать ошибки авторизации в проде.
  if (
    typeof window !== "undefined" &&
    [
      "bootstrap-no-init-data",
      "bot-token-denied",
      "fetch-401",
      "fetch-reauth-failed",
    ].includes(event) &&
    shouldSendDebug(event, payload)
  ) {
    const webApp = window.Telegram?.WebApp;
    fetch("/api/auth/client-debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        source: "auth-client",
        event,
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search ? "<present>" : "",
        hasTelegram: Boolean(window.Telegram),
        hasWebApp: Boolean(webApp),
        initDataLength: webApp?.initData?.length ?? 0,
        unsafeUserId: webApp?.initDataUnsafe?.user?.id ?? null,
        colorScheme: webApp?.colorScheme ?? null,
        payload,
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
  const initData = await getTelegramInitDataSafe();

  logAuthClientDebug("bot-token-start", {
    expectedTelegramUserId,
    loginTokenPresent: Boolean(loginToken),
    loginTokenLength: loginToken.length,
    initDataLength: initData.length,
  });

  if (!loginToken) {
    return false;
  }

  const authResponse = await fetch("/api/auth/bot-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
  const initData = await getTelegramInitDataSafe();
  const loginToken = getBotLoginTokenFromUrl();

  logAuthClientDebug("bootstrap-start", {
    expectedTelegramUserId,
    initDataLength: initData.length,
    loginTokenPresent: Boolean(loginToken),
    previousBootstrappedTelegramUserId: bootstrappedTelegramUserId,
  });

  if (!initData) {
    const tokenResult = await bootstrapWithBotLoginToken(expectedTelegramUserId);
    if (tokenResult) {
      return true;
    }

    logAuthClientDebug("bootstrap-no-init-data", {
      expectedTelegramUserId,
      loginTokenPresent: Boolean(loginToken),
    });
    bootstrappedTelegramUserId = null;
    return false;
  }

  const authResponse = await fetch("/api/auth/telegram", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
      fallbackLoginTokenPresent: Boolean(loginToken),
    });

    const tokenResult = await bootstrapWithBotLoginToken(expectedTelegramUserId);
    if (tokenResult) {
      return true;
    }

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
  logAuthClientDebug("bootstrap-finished", {
    bootstrappedTelegramUserId,
  });
  return true;
}

export async function ensureTelegramSession(force = false) {
  const currentTelegramUserId = await getCurrentTelegramUserId();
  const shouldRebootstrap =
    force ||
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
  if (initData) {
    headers.set("x-telegram-init-data", initData);
  }
  return headers;
}

export async function fetchWithTelegramAuth(input: RequestInfo | URL, init?: RequestInit) {
  // КРИТИЧНО: на Android Telegram WebView отдаёт initData асинхронно, а
  // прежде чем он успевает прийти, клиент мог уже отправить запрос с
  // одним лишь session-cookie от предыдущего юзера (cookies в Telegram
  // WebView шарятся между аккаунтами). Поэтому если есть признаки
  // Telegram (либо WebApp уже виден, либо user-agent от Telegram-клиента) —
  // ждём загрузки initData. В обычном браузере не блокируем запрос.
  const webAppPresent = Boolean(getTelegramWebApp());
  const insideTelegramWebApp = webAppPresent || isLikelyTelegramUserAgent();
  const initData = insideTelegramWebApp
    ? await getTelegramInitDataSafe()
    : getTelegramInitData();
  const loginToken = getBotLoginTokenFromUrl();
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
