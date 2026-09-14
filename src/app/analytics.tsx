"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";

const COOKIE_NAME = "doobler_analytics_consent";
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

type AnalyticsDecision = "granted" | "denied" | null;

function getStoredDecision(): AnalyticsDecision {
  const entry = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];

  return entry === "granted" || entry === "denied" ? entry : null;
}

function storeDecision(decision: Exclude<AnalyticsDecision, null>) {
  document.cookie = `${COOKIE_NAME}=${decision}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure`;
}

/**
 * Analytics deliberately runs on the public landing page only.
 * It never runs inside the Telegram app, profile, chat, or shift routes.
 */
export function Analytics() {
  const pathname = usePathname();
  const yandexId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
  const [decision, setDecision] = useState<AnalyticsDecision>(null);
  const [loaded, setLoaded] = useState(false);
  const enabledHere = pathname === "/";
  const hasCounterId = Boolean(yandexId && /^\d+$/.test(yandexId));
  const canPreviewConsent = process.env.NODE_ENV === "development";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDecision(getStoredDecision());
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (!enabledHere || !loaded || (!hasCounterId && !canPreviewConsent)) {
    return null;
  }

  if (decision !== "granted") {
    return decision === "denied" ? null : (
      <aside
        aria-label="Использование файлов cookie"
        className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-[520px] rounded-[16px] border border-[rgba(230,238,245,0.08)] bg-[#11161c] p-4 text-[#eef3f7] shadow-[0_12px_28px_rgba(0,0,0,0.24)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:mx-0 sm:w-[380px]"
      >
        <p className="text-[13px] leading-5 text-[#9aa8b5]">
          Мы используем обязательные файлы cookie для работы сайта. С вашего согласия подключим
          аналитические cookie Яндекс Метрики. Нажимая «Разрешить», вы соглашаетесь с{" "}
          <Link className="font-semibold text-accent" href="/privacy">
            Политикой обработки персональных данных
          </Link>
          .
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="h-10 flex-1 rounded-[8px] bg-accent px-4 text-[13px] font-semibold text-accent-foreground"
            onClick={() => {
              storeDecision("granted");
              setDecision("granted");
            }}
          >
            Разрешить
          </button>
          <button
            type="button"
            className="h-10 flex-1 rounded-[8px] border border-[rgba(230,238,245,0.08)] bg-[#202b36] px-4 text-[13px] font-semibold text-[#eef3f7]"
            onClick={() => {
              storeDecision("denied");
              setDecision("denied");
            }}
          >
            Не разрешать
          </button>
        </div>
      </aside>
    );
  }

  if (!hasCounterId) {
    return null;
  }

  return (
    <Script id="yandex-metrika" strategy="afterInteractive">
      {`
        (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
        (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
        ym(${yandexId}, "init", { ssr: true, webvisor: false, clickmap: true, accurateTrackBounce: true, trackLinks: true });
      `}
    </Script>
  );
}
