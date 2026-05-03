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
        ready?: () => void;
        expand?: () => void;
        BackButton?: {
          show: () => void;
          hide: () => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: "light" | "medium" | "heavy") => void;
        };
        onEvent?: (eventType: "themeChanged", eventHandler: () => void) => void;
        offEvent?: (eventType: "themeChanged", eventHandler: () => void) => void;
      };
    };
  }
}

export type ThemeMode = "light" | "dark";

export const THEME_OVERRIDE_STORAGE_KEY = "doobler-theme-override";
const LEGACY_THEME_STORAGE_KEY = "doobler-theme";
const THEME_APPLIED_EVENT = "doobler-theme-applied";

type WaitForWebAppOptions = {
  timeoutMs?: number;
  requireInitData?: boolean;
};

let telegramWebAppWaitPromise: Promise<ReturnType<typeof getTelegramWebApp>> | null = null;
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

function logTelegramWebAppDebug(event: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return;
  }

  if (isVerboseLoggingEnabled) {
    console.info(`[tg-debug] webapp:${event}`, payload);
  }

  // Инцидент-репортинг на бэкенд — не гасим verbose-флагом, чтобы видеть
  // реальные таймауты Telegram WebApp в проде.
  if (["timeout", "missing-init-data"].includes(event) && shouldSendWebAppDebug(event, payload)) {
    fetch("/api/auth/client-debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        source: "telegram-webapp",
        event,
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search ? "<present>" : "",
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

export async function waitForTelegramWebApp({
  timeoutMs = 8000,
  requireInitData = false,
}: WaitForWebAppOptions = {}) {
  if (typeof window === "undefined") {
    return null;
  }

  const existingWebApp = getTelegramWebApp();
  if (existingWebApp && (!requireInitData || Boolean(existingWebApp.initData))) {
    return existingWebApp;
  }

  if (!telegramWebAppWaitPromise) {
    telegramWebAppWaitPromise = (async () => {
      const startedAt = Date.now();
      let iterations = 0;

      while (Date.now() - startedAt < timeoutMs) {
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
      telegramWebAppWaitPromise = null;
    });
  }

  const resolvedWebApp = await telegramWebAppWaitPromise;
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
  return getTelegramWebApp()?.initData ?? "";
}

export async function getTelegramInitDataSafe() {
  const webApp = await waitForTelegramWebApp({ requireInitData: true });
  return webApp?.initData ?? "";
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

  return extractTelegramUserIdFromInitData(webApp?.initData ?? "");
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredThemeOverride(): ThemeMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(THEME_OVERRIDE_STORAGE_KEY);
  return isThemeMode(stored) ? stored : null;
}

function getForcedThemeFromQuery(): ThemeMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const forcedTheme = new URLSearchParams(window.location.search).get("theme");
  return isThemeMode(forcedTheme) ? forcedTheme : null;
}

export function getPreferredTheme(): ThemeMode {
  const webApp = getTelegramWebApp();
  return webApp?.colorScheme ?? getSystemTheme();
}

export function getCurrentTheme(): ThemeMode {
  if (typeof document === "undefined") {
    return "light";
  }

  const current = document.documentElement.dataset.theme ?? null;
  if (isThemeMode(current)) {
    return current;
  }

  return getPreferredTheme();
}

function dispatchThemeApplied(mode: ThemeMode, source: "query" | "manual" | "device") {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(THEME_APPLIED_EVENT, {
      detail: { mode, source },
    }),
  );
}

function cleanupLegacyThemeStorage() {
  if (typeof window === "undefined") {
    return;
  }

  // Older builds used this key as a permanent override. The VDS build now
  // follows the device by default, so stale values should not pin the theme.
  window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
}

export async function getTelegramUserIdSafe() {
  const webApp = await waitForTelegramWebApp({ requireInitData: true });
  const unsafeUserId = webApp?.initDataUnsafe?.user?.id;

  if (unsafeUserId) {
    return String(unsafeUserId);
  }

  return extractTelegramUserIdFromInitData(webApp?.initData ?? "");
}

export function applyTelegramTheme() {
  if (typeof document === "undefined") {
    return "light";
  }

  const root = document.documentElement;
  cleanupLegacyThemeStorage();

  const webApp = getTelegramWebApp();
  const queryTheme = getForcedThemeFromQuery();
  const manualTheme = getStoredThemeOverride();
  const source = queryTheme ? "query" : manualTheme ? "manual" : "device";
  const theme = queryTheme ?? manualTheme ?? getPreferredTheme();

  root.dataset.theme = theme;
  root.dataset.tgScheme = theme;
  root.dataset.themeSource = source;

  if (webApp?.themeParams) {
    Object.entries(webApp.themeParams).forEach(([key, value]) => {
      root.style.setProperty(`--tg-${key.replaceAll("_", "-")}`, value);
    });
  }

  dispatchThemeApplied(theme, source);
  return theme;
}

export function setManualThemeOverride(mode: ThemeMode) {
  window.localStorage.setItem(THEME_OVERRIDE_STORAGE_KEY, mode);
  applyTelegramTheme();
}

export function clearManualThemeOverride() {
  window.localStorage.removeItem(THEME_OVERRIDE_STORAGE_KEY);
  applyTelegramTheme();
}

export function subscribeToDeviceThemeChanges() {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  const handleThemeChange = () => {
    applyTelegramTheme();
  };

  mediaQuery?.addEventListener?.("change", handleThemeChange);

  const webApp = getTelegramWebApp();
  webApp?.onEvent?.("themeChanged", handleThemeChange);

  return () => {
    mediaQuery?.removeEventListener?.("change", handleThemeChange);
    webApp?.offEvent?.("themeChanged", handleThemeChange);
  };
}

export async function prepareTelegramWebApp() {
  const webApp = await waitForTelegramWebApp();
  webApp?.ready?.();
  webApp?.expand?.();
  applyTelegramTheme();
  return subscribeToDeviceThemeChanges();
}
