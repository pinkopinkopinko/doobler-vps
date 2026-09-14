import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import Script from "next/script";

import { Analytics } from "./analytics";
import "./globals.css";

const TELEGRAM_WEBAPP_SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js?57";
const EARLY_AUTH_DEBUG_SCRIPT = `
(() => {
  const startedAt = Date.now();
  let sent = 0;
  const maxReports = 12;

  function sanitizeUrl(value) {
    return String(value || "")
      .replace(/([?&](?:loginToken|token)=)[^&#]+/g, "$1<hidden>")
      .replace(/([?&]tgWebAppData=)[^&#]+/g, "$1<hidden>")
      .replace(/#tgWebAppData=.*$/g, "#<hidden>");
  }

  function searchKeys() {
    try {
      return Array.from(new URLSearchParams(window.location.search).keys());
    } catch {
      return [];
    }
  }

  function getSnapshot(event, extra) {
    const webApp = window.Telegram && window.Telegram.WebApp;
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const params = new URLSearchParams(search);
    const loginToken = (params.get("loginToken") || "").trim();

    return {
      source: "root-early-script",
      event,
      href: sanitizeUrl(window.location.href),
      pathname: window.location.pathname,
      search: search ? "<present>" : "",
      searchKeys: searchKeys(),
      hashLength: hash.length,
      hashHasTgWebAppData: hash.indexOf("tgWebAppData") !== -1,
      hasTelegram: Boolean(window.Telegram),
      hasWebApp: Boolean(webApp),
      initDataLength: webApp && webApp.initData ? webApp.initData.length : 0,
      unsafeUserId: webApp && webApp.initDataUnsafe && webApp.initDataUnsafe.user
        ? webApp.initDataUnsafe.user.id ?? null
        : null,
      colorScheme: webApp ? webApp.colorScheme ?? null : null,
      webAppVersion: webApp ? webApp.version ?? null : null,
      webAppPlatform: webApp ? webApp.platform ?? null : null,
      documentReadyState: document.readyState,
      visibilityState: document.visibilityState,
      elapsedMs: Date.now() - startedAt,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      loginTokenPresent: Boolean(loginToken),
      loginTokenLength: loginToken.length,
      extra: extra || null,
    };
  }

  function report(event, extra) {
    if (sent >= maxReports) return;
    sent += 1;
    try {
      fetch("/api/auth/client-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify(getSnapshot(event, extra)),
      }).catch(() => undefined);
    } catch {
      // This script is diagnostic only.
    }
  }

  function getLoginToken() {
    try {
      return (new URLSearchParams(window.location.search).get("loginToken") || "").trim();
    } catch {
      return "";
    }
  }

  function readInitDataFromHash() {
    const hash = window.location.hash || "";
    if (!hash || hash.length < 2) return "";

    try {
      const stripped = hash.charAt(0) === "#" ? hash.slice(1) : hash;
      const params = new URLSearchParams(stripped);
      const raw = params.get("tgWebAppData");
      return raw ? decodeURIComponent(raw) : "";
    } catch {
      return "";
    }
  }

  function getCleanReloadUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("loginToken");
    url.hash = "";
    return url.toString();
  }

  function redeemLoginTokenEarly() {
    const loginToken = getLoginToken();
    if (!loginToken || !window.location.pathname.startsWith("/telegram/")) {
      return;
    }

    const initData = readInitDataFromHash();
    report("early-redeem-start", {
      initDataLength: initData.length,
      hasInitData: Boolean(initData),
    });

    fetch("/api/auth/bot-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(initData ? { "x-telegram-init-data": initData } : {}),
      },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ token: loginToken, initData }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        report("early-redeem-response", {
          status: response.status,
          ok: response.ok,
          hasPayload: Boolean(payload),
          payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
        });

        if (response.ok) {
          window.setTimeout(() => {
            window.location.replace(getCleanReloadUrl());
          }, 80);
        }
      })
      .catch((error) => {
        report("early-redeem-failed", {
          message: error && error.message ? error.message : String(error || "unknown"),
        });
      });
  }

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      const resource = target && target !== window
        ? {
            tagName: target.tagName || null,
            src: sanitizeUrl(target.src || target.href || ""),
          }
        : null;
      report("window-error", {
        message: event.message || null,
        filename: sanitizeUrl(event.filename || ""),
        lineno: event.lineno || null,
        colno: event.colno || null,
        resource,
      });
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    report("unhandled-rejection", {
      message: reason && reason.message ? reason.message : String(reason || "unknown"),
      stack: reason && reason.stack ? String(reason.stack).slice(0, 1200) : null,
    });
  });

  report("start");
  redeemLoginTokenEarly();
  window.setTimeout(() => report("after-1s"), 1000);
  window.setTimeout(() => report("after-5s"), 5000);
})();
`;

const wixMadeforDisplay = localFont({
  variable: "--font-wix-madefor-display",
  src: [
    {
      path: "./fonts/WixMadeforDisplay-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/WixMadeforDisplay-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
  ],
  display: "swap",
});

const SITE_URL = "https://doobler.ru";
const SITE_NAME = "Дублер";
const SITE_DESCRIPTION =
  "Дублер — сервис для владельцев и сотрудников ПВЗ Ozon, Wildberries и Яндекс Маркет: быстрый поиск замены на смену, подмена сотрудника на день, публикация вакансий, прозрачные условия и подтверждённые профили.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Дублер — замены, подмены и смены в ПВЗ Ozon, WB, Яндекс Маркет",
    template: "%s — Дублер",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "замена сотрудника ПВЗ",
    "подмена в ПВЗ",
    "смены ПВЗ",
    "смены Ozon",
    "смены Wildberries",
    "смены WB",
    "смены Яндекс Маркет",
    "подработка ПВЗ",
    "работа в ПВЗ на день",
    "вакансии пункт выдачи",
    "найти замену в ПВЗ",
    "пункт выдачи заказов работа",
    "сотрудник ПВЗ Ozon",
    "сотрудник ПВЗ Wildberries",
    "Дублер",
    "doobler",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "business",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Дублер — замены, подмены и смены в ПВЗ Ozon, WB, Яндекс Маркет",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Дублер — сервис замен и смен в ПВЗ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Дублер — замены и смены в ПВЗ маркетплейсов",
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    // Заполняется через env. Если переменная пустая — meta-тег не рендерится.
    // Yandex.Webmaster выдаёт content из <meta name="yandex-verification" ...>.
    yandex: process.env.YANDEX_VERIFICATION || undefined,
    // Google Search Console выдаёт content из <meta name="google-site-verification" ...>.
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "640x640" }],
    shortcut: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png", type: "image/png", sizes: "640x640" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${wixMadeforDisplay.variable} h-full`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
        {/* beforeInteractive must live directly in the root layout in Next 16. */}
        <Script id="tg-early-auth-debug" strategy="beforeInteractive">
          {EARLY_AUTH_DEBUG_SCRIPT}
        </Script>
        <Script
          id="telegram-webapp-sdk"
          src={TELEGRAM_WEBAPP_SCRIPT_SRC}
          strategy="beforeInteractive"
        />
        <Analytics />
      </body>
    </html>
  );
}
