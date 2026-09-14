"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import type { ApplicationStatus } from "@/lib/types";

type ShiftActionsProps = {
  shiftId: string;
  canApply?: boolean;
  applyDisabledLabel?: string;
  existingApplicationStatus?: ApplicationStatus | null;
};

export function ShiftActions({
  shiftId,
  canApply = true,
  applyDisabledLabel = "Отклик недоступен",
  existingApplicationStatus = null,
}: ShiftActionsProps) {
  const [applied, setApplied] = useState(Boolean(existingApplicationStatus));
  const [message, setMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  async function applyToShift() {
    setIsApplying(true);
    setMessage(null);

    try {
      const response = await fetchWithTelegramAuth(`/api/shift-posts/${shiftId}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message:
            "Готов выйти на смену. Подтверждение можно отправить прямо в приложении.",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(payload?.error ?? "Не удалось откликнуться на смену.");
        return;
      }

      setApplied(true);
      setMessage(
        "Отклик отправлен. Следите за подтверждением в разделе «Мои отклики».",
      );
    } catch {
      setMessage("Сервис откликов временно недоступен.");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={!canApply || isApplying || applied}
        onClick={applyToShift}
        className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-accent px-4 py-4 text-[14px] font-semibold text-accent-foreground disabled:opacity-60"
      >
        {isApplying ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {applied
          ? existingApplicationStatus === "CANCELLED_BY_WORKER"
            ? "Вы отказались от данной смены"
            : existingApplicationStatus
              ? "Вы уже откликнулись"
            : "Отклик отправлен"
          : canApply
            ? "Откликнуться на смену"
            : applyDisabledLabel}
      </button>

      {message ? <p className="mt-3 text-[14px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
