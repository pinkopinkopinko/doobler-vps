"use client";

import { useEffect, useState } from "react";

const COOKIE_NAME = "doobler_analytics_consent";
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

type Decision = "granted" | "denied" | null;

function readDecision(): Decision {
  const value = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];
  return value === "granted" || value === "denied" ? value : null;
}

function saveDecision(decision: Exclude<Decision, null>) {
  document.cookie = `${COOKIE_NAME}=${decision}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure`;
}

export function AnalyticsConsentControl() {
  const [decision, setDecision] = useState<Decision>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDecision(readDecision());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="rounded-[8px] border border-border bg-muted p-4">
      <p className="text-[13px] leading-5 text-foreground">
        Статистика посещений:{" "}
        <span className="font-semibold">
          {decision === "granted"
            ? "разрешена"
            : decision === "denied"
              ? "отключена"
              : "решение не принято"}
        </span>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="h-10 rounded-[8px] bg-accent px-4 text-[13px] font-semibold text-accent-foreground"
          onClick={() => {
            saveDecision("granted");
            setDecision("granted");
          }}
        >
          Разрешить Метрику
        </button>
        <button
          type="button"
          className="h-10 rounded-[8px] border border-border bg-card px-4 text-[13px] font-semibold text-foreground"
          onClick={() => {
            saveDecision("denied");
            setDecision("denied");
          }}
        >
          Отозвать согласие
        </button>
      </div>
    </div>
  );
}
