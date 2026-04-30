"use client";

import { useState, useTransition } from "react";
import { Heart, LoaderCircle, Send } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";

type ShiftActionsProps = {
  shiftId: string;
  initiallyFavorite?: boolean;
  canApply?: boolean;
};

export function ShiftActions({
  shiftId,
  initiallyFavorite = false,
  canApply = true,
}: ShiftActionsProps) {
  const [favorite, setFavorite] = useState(initiallyFavorite);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isApplying, setIsApplying] = useState(false);

  function toggleFavorite() {
    startTransition(async () => {
      setMessage(null);

      const nextFavorite = !favorite;
      const response = await fetchWithTelegramAuth(`/api/shift-posts/${shiftId}/favorite`, {
        method: nextFavorite ? "POST" : "DELETE",
      });

      if (response.ok) {
        setFavorite(nextFavorite);
        return;
      }

      setMessage("Не удалось обновить избранное.");
    });
  }

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
            "Готов выйти на смену. Подтверждение можно отправить прямо в Mini App.",
        }),
      });

      if (!response.ok) {
        setMessage("Не удалось откликнуться на смену.");
        return;
      }

      setApplied(true);
      setMessage("Отклик отправлен. Следите за подтверждением в разделе «Мои отклики».");
    } catch {
      setMessage("Сервис откликов временно недоступен.");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <button
          type="button"
          disabled={!canApply || isApplying || applied}
          onClick={applyToShift}
          className="flex items-center justify-center gap-2 rounded-[22px] bg-[#3387d1] px-4 py-4 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {isApplying ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {applied
            ? "Отклик отправлен"
            : canApply
              ? "Откликнуться на смену"
              : "Вы владелец объявления"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={toggleFavorite}
          className="flex items-center justify-center gap-2 rounded-[22px] bg-[#f2f5f8] px-4 py-4 text-[14px] font-semibold text-[#101214] disabled:opacity-60"
        >
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Heart
              className={`h-4 w-4 ${
                favorite ? "fill-current text-[#df6d64]" : "text-[#7f8791]"
              }`}
            />
          )}
          {favorite ? "В избранном" : "В избранное"}
        </button>
      </div>

      {message ? <p className="mt-3 text-[14px] text-[#7f8791]">{message}</p> : null}
    </div>
  );
}
