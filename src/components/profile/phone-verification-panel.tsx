"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, Phone } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";

type PhoneVerificationPanelProps = {
  isPhoneVerified: boolean;
};

type PhoneVerificationResponse = {
  status?: "sent" | "already_verified";
  message?: string;
  error?: string;
};

type ProfileStatusResponse = {
  profile?: {
    isPhoneVerified?: boolean;
  } | null;
};

const TELEGRAM_BOT_LINK = "https://t.me/doobler_bot";

export function PhoneVerificationPanel({ isPhoneVerified }: PhoneVerificationPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startRefreshTransition] = useTransition();

  useEffect(() => {
    if (!requestSent) {
      return;
    }

    let active = true;
    let checking = false;

    async function checkVerificationStatus() {
      if (!active || checking) {
        return;
      }

      checking = true;

      try {
        const response = await fetchWithTelegramAuth("/api/profile?view=phone-status", {
          cache: "no-store",
        });

        const payload =
          ((await response.json().catch(() => null)) as ProfileStatusResponse | null) ?? null;

        if (!active || !response.ok) {
          return;
        }

        if (payload?.profile?.isPhoneVerified) {
          setMessage("Номер подтверждён. Обновляем профиль...");
          setError(null);
          startRefreshTransition(() => {
            router.refresh();
          });
        }
      } finally {
        checking = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void checkVerificationStatus();
    }, 4000);

    const handleWindowFocus = () => {
      void checkVerificationStatus();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkVerificationStatus();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void checkVerificationStatus();

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestSent, router, startRefreshTransition]);

  if (isPhoneVerified) {
    return null;
  }

  async function handleVerify() {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetchWithTelegramAuth("/api/profile/phone-verification/request", {
        method: "POST",
      });

      const payload = ((await response.json().catch(() => null)) as PhoneVerificationResponse | null) ?? null;

      if (!response.ok) {
        setError(payload?.error ?? "Не удалось отправить запрос на подтверждение номера.");
        return;
      }

      if (payload?.status === "already_verified") {
        setRequestSent(true);
        setMessage("Номер уже подтверждён. Сейчас обновим профиль.");
        startRefreshTransition(() => {
          router.refresh();
        });
        return;
      }

      setRequestSent(true);
      setMessage(
        "Бот уже прислал кнопку. Откройте чат, отправьте свой контакт в Telegram — статус обновится автоматически.",
      );
    } catch {
      setError("Не удалось отправить запрос на подтверждение номера.");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = submitting || refreshing;

  return (
    <article className="rounded-[28px] bg-[#fff7eb] p-4 text-[#101214] shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
      <div className="flex items-start gap-3">
        <span className="rounded-[18px] bg-white p-2.5 text-[#c27a2c] shadow-[inset_0_0_0_1px_rgba(194,122,44,0.14)]">
          <Phone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold tracking-[-0.03em]">
            Не пройдена верификация по номеру телефона
          </h3>
          <p className="mt-1 text-[14px] leading-6 text-[#7f6a4f]">
            Подтвердите номер через Telegram, чтобы профиль выглядел надёжнее для владельцев и
            управляющих ПВЗ.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || requestSent}
          onClick={() => void handleVerify()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#3387d1] px-5 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {requestSent ? "Ожидаем подтверждение в Telegram" : "Подтвердить номер телефона"}
        </button>

        {requestSent ? (
          <a
            href={TELEGRAM_BOT_LINK}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-[#1c4f7a] shadow-[inset_0_0_0_1px_rgba(28,79,122,0.18)]"
          >
            <ExternalLink className="h-4 w-4" />
            Открыть чат с ботом
          </a>
        ) : null}

        {message ? (
          <p className="text-[13px] leading-5 text-[#7f6a4f]" aria-live="polite">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="text-[13px] leading-5 text-[#b35b54]" aria-live="polite">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
