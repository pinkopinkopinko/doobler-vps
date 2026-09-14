"use client";

import { useState } from "react";
import { Flag, LoaderCircle, X } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";

type ShiftReportButtonProps = {
  shiftId: string;
};

const SHIFT_REPORT_REASONS = [
  { code: "fake_shift", label: "Фейковая смена" },
  { code: "wrong_shift_info", label: "Неверная информация в смене" },
  { code: "suspicious_employer", label: "Подозрительный работодатель" },
  { code: "rude_communication", label: "Грубое или опасное общение" },
  { code: "payment_issue", label: "Проблема с оплатой" },
] as const;

type ShiftReportReasonCode = (typeof SHIFT_REPORT_REASONS)[number]["code"];

export function ShiftReportButton({ shiftId }: ShiftReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState<ShiftReportReasonCode>(
    SHIFT_REPORT_REASONS[0].code,
  );
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submitReport() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetchWithTelegramAuth("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "SHIFT_POST",
          targetId: shiftId,
          reasonCode,
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(payload?.error ?? "Не удалось отправить жалобу.");
        return;
      }

      setSubmitted(true);
      setDescription("");
      setMessage("Жалоба отправлена модератору.");
      window.setTimeout(() => setIsOpen(false), 900);
    } catch {
      setMessage("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setIsOpen(true);
        }}
        className="flex items-center gap-2 rounded-full bg-[#f2f5f8] px-3 py-2 text-[12px] text-[#7f8791]"
      >
        <Flag className="h-3.5 w-3.5" />
        Пожаловаться
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-12 backdrop-blur-[2px] sm:items-center sm:py-8">
          <div className="flex max-h-[min(82dvh,620px)] w-full max-w-[390px] flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_24px_60px_rgba(13,19,27,0.24)]">
            <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#a6abb2]">
                  Жалоба на смену
                </p>
                <h3 className="mt-1.5 text-[20px] font-semibold tracking-[-0.04em] text-[#101214]">
                  Что не так?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#f2f5f8] text-[#101214]"
                aria-label="Закрыть жалобу"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
              <div className="mt-4 space-y-2">
                {SHIFT_REPORT_REASONS.map((reason) => (
                  <label
                    key={reason.code}
                    className="flex cursor-pointer items-center gap-3 rounded-[18px] bg-[#f8fbfd] px-4 py-2.5 text-[14px] font-semibold text-[#101214]"
                  >
                    <input
                      type="radio"
                      name="shift-report-reason"
                      value={reason.code}
                      checked={reasonCode === reason.code}
                      onChange={() => setReasonCode(reason.code)}
                      className="h-4 w-4 accent-[#3387d1]"
                    />
                    {reason.label}
                  </label>
                ))}
              </div>

              <label className="mt-4 block">
                <span className="text-[13px] font-medium text-[#7f8791]">
                  Комментарий для модератора
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Опишите проблему: что произошло, где ошибка, почему смена кажется подозрительной."
                  className="mt-2 w-full resize-none rounded-[22px] border border-[#dfe6ed] bg-white px-4 py-3 text-[14px] text-[#101214] outline-none placeholder:text-[#a6abb2] focus:border-[#3387d1]"
                />
              </label>

              {message ? <p className="mt-3 text-[14px] text-[#7f8791]">{message}</p> : null}
            </div>

            <div className="shrink-0 border-t border-[#eef3f7] bg-white px-4 py-3">
              <button
                type="button"
                onClick={submitReport}
                disabled={isSubmitting || submitted}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#3387d1] px-5 text-[15px] font-semibold text-white disabled:opacity-60"
              >
                {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {submitted ? "Жалоба отправлена" : "Отправить жалобу"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
