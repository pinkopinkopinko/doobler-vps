import { isVerboseLoggingEnabled } from "@/lib/log";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: Record<string, unknown> & {
          user?: {
            id?: number | string;
          };
        };
        colorScheme?: "light" | "dark";
        themeParams?: Record<string, string>;
        version?: string;
        platform?: string;
        ready?: () => void;
        expand?: () => void;
        BackButton?: {
          show: () => void;
          hide: () => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: "light" | "medium" | "heavy") => void;
        };
      };
    };
  }
}

type WaitForWebAppOptions = {
  timeoutMs?: number;
  requireInitData?: boolean;
};

let telegramWebAppWaitPromise: Promise<ReturnType<typeof getTelegramWebApp>> | null = null;
let telegramWebAppInitDataWaitPromise: Promise<ReturnType<typeof getTelegramWebApp>> | null = null;
let lastWaitDebugKey: string | null = null;
let lastWebAppDebugSignature = "";
let lastWebAppDebugAt = 0;

function shouldSendWebAppDebug(event: string, payload: Record<string, unknown>) {
  const signature = `${event}:${JSON.stringify(payload)}`;
  const now = Date.now();

  if (signature === lastWebAppDebugSignature && now - lastWebAppDebugAt < 15_000) {
    return false;
  }

  lastWebAppDebugSignature = signature;
  lastWebAppDebugAt = now;
  return true;
}

function sanitizeDebugUrl(value: string) {
  return value
    .replace(/([?&](?:loginToken|token)=)[^&#]+/g, "$1<hidden>")
    .replace(/([?&]tgWebAppData=)[^&#]+/g, "$1<hidden>")
    .replace(/#tgWebAppData=.*$/g, "#<hidden>");
}

function getWebAppDebugSnapshot() {
  const webApp = getTelegramWebApp();
  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash ?? "";
  const loginToken = searchParams.get("loginToken")?.trim() ?? "";

  return {
    href: sanitizeDebugUrl(window.location.href),
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
    userAgent: window.navigator.userAgent,
    platform: window.navigator.platform,
    language: window.navigator.language,
    cookieEnabled: window.navigator.cookieEnabled,
    loginTokenPresent: Boolean(loginToken),
    loginTokenLength: loginToken.length,
  };
}

function shouldReportWebAppDebug(
  event: string,
  payload: Record<string, unknown>,
  snapshot: ReturnType<typeof getWebAppDebugSnapshot>,
) {
  if (["timeout", "missing-init-data"].includes(event)) {
    return true;
  }

  if (snapshot.loginTokenPresent) {
    return true;
  }

  if (payload.requireInitData === true) {
    return true;
  }

  return Boolean(snapshot.initDataLength === 0 && (snapshot.hasWebApp || snapshot.hashHasTgWebAppData));
}

function logTelegramWebAppDebug(event: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return;
  }

  if (isVerboseLoggingEnabled) {
    console.info(`[tg-debug] webapp:${event}`, payload);
  }

  // Инцидент-репортинг на бэкенд — не гасим verbose-флагом, чтобы видеть
  // реальные таймауты Telegram WebApp в проде.
  const snapshot = getWebAppDebugSnapshot();
  if (
    shouldReportWebAppDebug(event, payload, snapshot) &&
    shouldSendWebAppDebug(event, payload)
  ) {
    fetch("/api/auth/client-debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        source: "telegram-webapp",
        event,
        ...snapshot,
        ...payload,
      }),
    }).catch(() => undefined);
  }
}

export function getTelegramWebApp() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Telegram?.WebApp ?? null;
}

/**
 * Резервный парсинг initData напрямую из URL hash'а — для случаев, когда
 * Telegram Web подгрузил Mini App, но `telegram-web-app.js` ещё не успел
 * выполниться (медленный CDN, временный сбой) и `window.Telegram.WebApp`
 * пока не существует. Telegram Web кладёт initData в hash в виде
 * `#tgWebAppData=<urlencoded-initdata>&tgWebAppVersion=...&...`, поэтому
 * мы можем достать её сами и разблокировать авторизацию даже без SDK.
 *
 * Возвращаем уже декодированную строку — в том же формате, в котором SDK
 * нормально отдаёт `webApp.initData` (т.е. это querystring с user/hash/
 * auth_date, готовый для серверной HMAC-проверки).
 */
export function readInitDataFromUrlHash(): string {
  if (typeof window === "undefined") return "";

  const hash = window.location.hash || "";
  if (!hash || hash.length < 2) return "";

  // У хеша может или не быть ведущего '#', и параметры разделены '&'.
  const stripped = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(stripped);
  const raw = params.get("tgWebAppData");
  if (!raw) return "";

  try {
    // tgWebAppData в hash хранится URL-encoded — внутри уже своя
    // querystring с user/hash/auth_date. После decodeURIComponent
    // получаем строку «query_id=...&user={...}&auth_date=...&hash=...».
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export async function waitForTelegramWebApp({
  timeoutMs,
  requireInitData = false,
}: WaitForWebAppOptions = {}) {
  if (typeof window === "undefined") {
    return null;
  }

  const effectiveTimeoutMs = timeoutMs ?? (requireInitData ? 15_000 : 8_000);

  const existingWebApp = getTelegramWebApp();
  if (existingWebApp && (!requireInitData || Boolean(existingWebApp.initData))) {
    logTelegramWebAppDebug("ready-existing", {
      requireInitData,
      initDataLength: existingWebApp.initData?.length ?? 0,
      unsafeUserId: existingWebApp.initDataUnsafe?.user?.id ?? null,
      colorScheme: existingWebApp.colorScheme ?? null,
    });
    return existingWebApp;
  }

  let waitPromise = requireInitData
    ? telegramWebAppInitDataWaitPromise
    : telegramWebAppWaitPromise;

  if (!waitPromise) {
    waitPromise = (async () => {
      const startedAt = Date.now();
      let iterations = 0;

      while (Date.now() - startedAt < effectiveTimeoutMs) {
        iterations += 1;
        const webApp = getTelegramWebApp();

        if (webApp?.ready) {
          webApp.ready();
        }

        if (webApp) {
          webApp.expand?.();

          if (!requireInitData || Boolean(webApp.initData)) {
            const debugKey = `ready:${requireInitData}:${Boolean(webApp.initData)}:${webApp.initDataUnsafe?.user?.id ?? "no-user"}`;
            if (lastWaitDebugKey !== debugKey) {
              lastWaitDebugKey = debugKey;
              logTelegramWebAppDebug("ready", {
                requireInitData,
                initDataLength: webApp.initData?.length ?? 0,
                unsafeUserId: webApp.initDataUnsafe?.user?.id ?? null,
                colorScheme: webApp.colorScheme ?? null,
                waitedMs: Date.now() - startedAt,
                iterations,
                userAgent: window.navigator.userAgent,
              });
            }
            return webApp;
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }

      const finalWebApp = getTelegramWebApp();
      logTelegramWebAppDebug("timeout", {
        requireInitData,
        hasTelegram: Boolean(window.Telegram),
        hasWebApp: Boolean(finalWebApp),
        initDataLength: finalWebApp?.initData?.length ?? 0,
        unsafeUserId: finalWebApp?.initDataUnsafe?.user?.id ?? null,
        waitedMs: Date.now() - startedAt,
        iterations,
        userAgent: window.navigator.userAgent,
      });

      return finalWebApp;
    })().finally(() => {
      if (requireInitData) {
        telegramWebAppInitDataWaitPromise = null;
      } else {
        telegramWebAppWaitPromise = null;
      }
    });

    if (requireInitData) {
      telegramWebAppInitDataWaitPromise = waitPromise;
    } else {
      telegramWebAppWaitPromise = waitPromise;
    }
  }

  const resolvedWebApp = await waitPromise;
  if (!resolvedWebApp) {
    return null;
  }

  if (requireInitData && !resolvedWebApp.initData) {
    logTelegramWebAppDebug("missing-init-data", {
      requireInitData,
      hasTelegram: Boolean(window.Telegram),
      hasWebApp: Boolean(resolvedWebApp),
      unsafeUserId: resolvedWebApp.initDataUnsafe?.user?.id ?? null,
      userAgent: window.navigator.userAgent,
    });
    return null;
  }

  return resolvedWebApp;
}

export function getTelegramInitData() {
  // Сначала пробуем SDK. Если он уже инициализирован — это самый
  // надёжный источник: initData там уже валидирован Telegram и обновляется
  // при `webApp.ready()` / переоткрытии Mini App.
  const fromSdk = getTelegramWebApp()?.initData ?? "";
  if (fromSdk) return fromSdk;

  // Fallback: вытащить initData из URL hash напрямую. Срабатывает
  // в Telegram Web, если SDK ещё не догрузился, или если CDN недоступен.
  return readInitDataFromUrlHash();
}

export async function getTelegramInitDataSafe() {
  const webApp = await waitForTelegramWebApp({ requireInitData: true });
  if (webApp?.initData) return webApp.initData;

  // Последний шанс: если SDK так и не загрузился, но Telegram Web
  // прислал initData в hash — используем её. На бэке всё равно идёт
  // HMAC-проверка, так что фальшивкой подсунуть не получится.
  return readInitDataFromUrlHash();
}

function extractTelegramUserIdFromInitData(initData: string) {
  if (!initData) {
    return null;
  }

  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");

  if (!userRaw) {
    return null;
  }

  try {
    const user = JSON.parse(userRaw) as { id?: number | string };
    return user.id ? String(user.id) : null;
  } catch {
    return null;
  }
}

export function getTelegramUserId() {
  const webApp = getTelegramWebApp();
  const unsafeUserId = webApp?.initDataUnsafe?.user?.id;

  if (unsafeUserId) {
    return String(unsafeUserId);
  }

  // Если SDK ещё не догрузился, но initData уже доступна из hash —
  // достаём user.id из неё (формат querystring c user=<json>).
  return extractTelegramUserIdFromInitData(
    webApp?.initData ?? readInitDataFromUrlHash(),
  );
}

export async function getTelegramUserIdSafe() {
  const webApp = await waitForTelegramWebApp({ requireInitData: true });
  const unsafeUserId = webApp?.initDataUnsafe?.user?.id;

  if (unsafeUserId) {
    return String(unsafeUserId);
  }

  return extractTelegramUserIdFromInitData(
    webApp?.initData ?? readInitDataFromUrlHash(),
  );
}

export function applyTelegramTheme() {
  const root = document.documentElement;
  const forcedTheme =
    new URLSearchParams(window.location.search).get("theme") ??
    window.localStorage.getItem("doobler-theme");
  const hasForcedTheme = forcedTheme === "dark" || forcedTheme === "light";

  if (hasForcedTheme) {
    root.dataset.theme = forcedTheme;
    root.dataset.tgScheme = forcedTheme;
  }

  const webApp = getTelegramWebApp();
  if (!webApp?.themeParams || typeof document === "undefined") {
    return;
  }

  Object.entries(webApp.themeParams).forEach(([key, value]) => {
    root.style.setProperty(`--tg-${key.replaceAll("_", "-")}`, value);
  });

  root.dataset.tgScheme = hasForcedTheme ? forcedTheme : (webApp.colorScheme ?? "light");
}

export async function prepareTelegramWebApp() {
  const webApp = await waitForTelegramWebApp();
  webApp?.ready?.();
  webApp?.expand?.();
  applyTelegramTheme();
}
