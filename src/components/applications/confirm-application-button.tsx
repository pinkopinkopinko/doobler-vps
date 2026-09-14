"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";

type ConfirmApplicationButtonProps = {
  applicationId: string;
};

export function ConfirmApplicationButton({ applicationId }: ConfirmApplicationButtonProps) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);

    try {
      const response = await fetchWithTelegramAuth(`/api/applications/${applicationId}/confirm`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось подтвердить отклик.");
        return;
      }

      setDone(true);
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending || done}
        onClick={handleConfirm}
        className="flex items-center justify-center gap-2 rounded-[20px] bg-[#e9f6ef] px-4 py-3 text-[14px] font-semibold text-[#2f8a59] disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {done ? "Кандидат подтверждён" : "Подтвердить"}
      </button>
      {done ? (
        <p className="rounded-[16px] border border-emerald-100 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
          Исполнитель назначен. Дальше можно перейти в чат и дождаться завершения смены.
        </p>
      ) : null}
      {error ? (
        <p className="flex items-start gap-2 rounded-[16px] border border-rose-100 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
