"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FileText,
  LoaderCircle,
  Phone,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { CONSENT_TEXT } from "@/lib/legal-consents";
import type { VerificationStatus } from "@/lib/types";

type VerificationPanelProps = {
  isPhoneVerified: boolean;
  isOwner?: boolean;
  employerVerificationStatus?: VerificationStatus | null;
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

type EmployerVerificationResponse = {
  verification?: {
    id: string;
    status: VerificationStatus;
  };
  error?: string;
};

const TELEGRAM_BOT_LINK = "https://t.me/doobler_bot";
const MAX_EMPLOYER_FILE_MB = 10;
const EMPLOYER_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getEmployerStatusText(status: VerificationStatus | null | undefined) {
  switch (status) {
    case "APPROVED":
      return "Документ ПВЗ подтвержден";
    case "PENDING":
      return "Документ ПВЗ на проверке";
    case "REJECTED":
      return "Документ ПВЗ отклонен";
    case "EXPIRED":
      return "Нужен новый документ ПВЗ";
    default:
      return "Документ ПВЗ не отправлен — без одобрения создавать смены нельзя";
  }
}

export function PhoneVerificationPanel({
  isPhoneVerified,
  isOwner = false,
  employerVerificationStatus = null,
}: VerificationPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [submittingPhone, setSubmittingPhone] = useState(false);
  const [employerModalOpen, setEmployerModalOpen] = useState(false);
  const [employerFile, setEmployerFile] = useState<File | null>(null);
  const [submittingEmployer, setSubmittingEmployer] = useState(false);
  const [phoneConsentActive, setPhoneConsentActive] = useState(false);
  const [phoneConsentChecked, setPhoneConsentChecked] = useState(false);
  const [documentConsentActive, setDocumentConsentActive] = useState(false);
  const [documentConsentChecked, setDocumentConsentChecked] = useState(false);
  const [refreshing, startRefreshTransition] = useTransition();

  const employerApproved = employerVerificationStatus === "APPROVED";
  const employerPending = employerVerificationStatus === "PENDING";
  const shouldShowPhoneAction = !isPhoneVerified;
  const shouldShowEmployerWarning = isOwner && !employerApproved;
  const shouldShowEmployerAction = isOwner && !employerApproved && !employerPending;
  const shouldShowPanel = shouldShowPhoneAction || shouldShowEmployerWarning;

  useEffect(() => {
    let active = true;

    void fetchWithTelegramAuth("/api/legal-events", { cache: "no-store" })
      .then((response) => response.json().catch(() => null))
      .then((payload: { consents?: Record<string, boolean> } | null) => {
        if (!active) {
          return;
        }
        setPhoneConsentActive(Boolean(payload?.consents?.PHONE_PROCESSING));
        setDocumentConsentActive(Boolean(payload?.consents?.EMPLOYER_DOCUMENT_PROCESSING));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

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
          setMessage("Номер подтвержден. Обновляем профиль...");
          setError(null);
          startRefreshTransition(() => {
            router.refresh();
          });
        }
      } finally {
        checking = false;
      }
    }

    // Юзер делится контактом из Telegram → веб-хук ставит
    // `isPhoneVerified=true` обычно за 1-2 с. 4-секундный polling
    // создавал лишнюю нагрузку (~15 SELECT/мин), 6 с по-прежнему даёт
    // ощущение «мгновенной» реакции (focus/visibility-хендлеры ниже
    // догоняют сразу при возврате во вкладку).
    const intervalId = window.setInterval(() => {
      void checkVerificationStatus();
    }, 6000);

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

  if (!shouldShowPanel) {
    return null;
  }

  async function handlePhoneVerify() {
    setSubmittingPhone(true);
    setMessage(null);
    setError(null);

    try {
      if (!phoneConsentActive) {
        const consentResponse = await fetchWithTelegramAuth("/api/legal-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purpose: "PHONE_PROCESSING",
            granted: true,
            source: "phone-verification-panel",
          }),
        });
        if (!consentResponse.ok) {
          setError("Не удалось сохранить согласие на обработку номера телефона.");
          return;
        }
        setPhoneConsentActive(true);
      }

      const response = await fetchWithTelegramAuth("/api/profile/phone-verification/request", {
        method: "POST",
      });

      const payload =
        ((await response.json().catch(() => null)) as PhoneVerificationResponse | null) ?? null;

      if (!response.ok) {
        setError(payload?.error ?? "Не удалось отправить запрос на подтверждение номера.");
        return;
      }

      if (payload?.status === "already_verified") {
        setRequestSent(true);
        setMessage("Номер уже подтвержден. Сейчас обновим профиль.");
        startRefreshTransition(() => {
          router.refresh();
        });
        return;
      }

      setRequestSent(true);
      setMessage(
        "Бот прислал кнопку. Откройте чат, поделитесь номером в Telegram — статус обновится автоматически.",
      );
    } catch {
      setError("Не удалось отправить запрос на подтверждение номера.");
    } finally {
      setSubmittingPhone(false);
    }
  }

  function handleEmployerFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!EMPLOYER_ALLOWED_TYPES.has(file.type)) {
      setError("Для документа ПВЗ подойдут PDF, JPEG, PNG или WebP.");
      return;
    }

    if (file.size > MAX_EMPLOYER_FILE_MB * 1024 * 1024) {
      setError(`Документ должен быть не больше ${MAX_EMPLOYER_FILE_MB} МБ.`);
      return;
    }

    setEmployerFile(file);
    setDocumentConsentChecked(false);
    setError(null);
  }

  async function handleEmployerSubmit() {
    if (!employerFile) {
      setError("Прикрепите документ для проверки ПВЗ.");
      return;
    }

    setSubmittingEmployer(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", employerFile);

    try {
      if (!documentConsentActive) {
        const consentResponse = await fetchWithTelegramAuth("/api/legal-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purpose: "EMPLOYER_DOCUMENT_PROCESSING",
            granted: true,
            source: "phone-verification-panel",
          }),
        });
        if (!consentResponse.ok) {
          setError("Не удалось сохранить согласие на обработку документа.");
          return;
        }
        setDocumentConsentActive(true);
      }

      const response = await fetchWithTelegramAuth("/api/profile/employer-verification", {
        method: "POST",
        body: formData,
      });

      const payload =
        ((await response.json().catch(() => null)) as EmployerVerificationResponse | null) ?? null;

      if (!response.ok) {
        setError(payload?.error ?? "Не удалось отправить документ ПВЗ на проверку.");
        return;
      }

      setMessage("Документ ПВЗ отправлен на проверку.");
      setEmployerFile(null);
      setEmployerModalOpen(false);
      startRefreshTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Не удалось отправить документ ПВЗ на проверку.");
    } finally {
      setSubmittingEmployer(false);
    }
  }

  const pending = submittingPhone || submittingEmployer || refreshing;

  return (
    <>
      <article className="rounded-[28px] bg-[#fff7eb] p-4 text-[#101214] shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
        <div className="flex items-start gap-3">
          <span className="rounded-[18px] bg-white p-2.5 text-[#c27a2c] shadow-[inset_0_0_0_1px_rgba(194,122,44,0.14)]">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-semibold tracking-[-0.03em]">
              Профиль требует верификации
            </h3>
            <p className="mt-1 text-[14px] leading-6 text-[#7f6a4f]">
              Подтвердите номер телефона. Владельцу или управляющему дополнительно понадобится
              документ, подтверждающий отношение к ПВЗ.
            </p>
            {shouldShowEmployerWarning ? (
              <p className="mt-2 rounded-[16px] bg-white/70 px-3 py-2 text-[13px] text-[#7f6a4f]">
                {getEmployerStatusText(employerVerificationStatus)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {shouldShowPhoneAction ? (
            <div className="w-full">
              <p className="mb-2 text-[12px] leading-5 text-muted-foreground">
                Номер будет использован только для подтверждения профиля и связи в сервисе.
              </p>
              {!phoneConsentActive ? (
                <label className="mb-3 flex items-start gap-3 rounded-[8px] border border-border bg-card p-3 text-[12px] leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={phoneConsentChecked}
                    onChange={(event) => setPhoneConsentChecked(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    {CONSENT_TEXT.PHONE_PROCESSING}{" "}
                    <Link className="font-semibold text-accent" href="/privacy">
                      Открыть политику
                    </Link>
                    .
                  </span>
                </label>
              ) : null}
              <button
                type="button"
                disabled={pending || requestSent || (!phoneConsentActive && !phoneConsentChecked)}
                onClick={() => void handlePhoneVerify()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#3387d1] px-5 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {submittingPhone || refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {requestSent ? "Ожидаем номер в Telegram" : "Подтвердить номер телефона"}
              </button>
            </div>
          ) : null}

          {shouldShowEmployerAction ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setEmployerModalOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#e7edf3] px-5 text-[14px] font-semibold text-[#1c4f7a] disabled:opacity-60"
            >
              <FileText className="h-4 w-4" />
              {employerVerificationStatus === "REJECTED" ||
              employerVerificationStatus === "EXPIRED"
                ? "Загрузить новый документ ПВЗ"
                : "Загрузить документ ПВЗ"}
            </button>
          ) : null}

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

      {employerModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 px-4 pb-4 pt-10 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-[430px] overflow-y-auto rounded-[30px] bg-white p-5 text-[#101214] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7f8791]">
                  Верификация ПВЗ
                </p>
                <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.04em]">
                  Документ владельца ПВЗ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmployerModalOpen(false);
                  setEmployerFile(null);
                  setDocumentConsentChecked(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef3f7] text-[#101214]"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-[22px] bg-[#f8fbfd] px-4 py-3 text-[14px] leading-6 text-[#5f6975]">
              <p className="font-semibold text-[#101214]">
                Подойдёт договор аренды, скриншот из приложения управления ПВЗ или другой
                документ, подтверждающий, что вы владеете или управляете пунктом выдачи.
              </p>
              <p className="mt-2">
                Без одобрения этого документа создавать смены нельзя. PDF, JPEG, PNG или WebP,
                до {MAX_EMPLOYER_FILE_MB} МБ.
              </p>
              <p className="mt-2">
                Загруженный документ удаляется не позднее чем через 30 дней после загрузки.
              </p>
            </div>

            <label className="mt-4 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-[#cbd6e2] bg-[#f8fbfd] px-4 py-5 text-center">
              <Upload className="h-7 w-7 text-[#3387d1]" />
              <span className="mt-2 text-[15px] font-semibold">
                {employerFile ? "Заменить файл" : "Выбрать файл"}
              </span>
              <span className="mt-1 text-[13px] text-[#7f8791]">PDF, JPEG, PNG или WebP</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleEmployerFileChange}
              />
            </label>

            {employerFile ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-[16px] bg-[#f2f5f8] px-3 py-2 text-[13px] text-[#5f6975]">
                <span className="truncate">{employerFile.name}</span>
                <button
                  type="button"
                  className="text-[#b35b54]"
                  onClick={() => setEmployerFile(null)}
                >
                  Убрать
                </button>
              </div>
            ) : null}

            {!documentConsentActive ? (
              <label className="mt-5 flex items-start gap-3 rounded-[8px] border border-border bg-muted p-3 text-[12px] leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={documentConsentChecked}
                  onChange={(event) => setDocumentConsentChecked(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                />
                <span>
                  {CONSENT_TEXT.EMPLOYER_DOCUMENT_PROCESSING}{" "}
                  <Link className="font-semibold text-accent" href="/privacy">
                    Открыть политику
                  </Link>
                  .
                </span>
              </label>
            ) : null}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void handleEmployerSubmit()}
                disabled={
                  submittingEmployer ||
                  !employerFile ||
                  (!documentConsentActive && !documentConsentChecked)
                }
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#3387d1] px-5 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {submittingEmployer ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Отправить
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmployerModalOpen(false);
                  setEmployerFile(null);
                  setDocumentConsentChecked(false);
                }}
                disabled={submittingEmployer}
                className="h-12 rounded-full bg-[#eef3f7] px-5 text-[14px] font-semibold text-[#101214]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
