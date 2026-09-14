"use client";

import { useState } from "react";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { fetchWithTelegramAuth } from "@/lib/auth/client";

type ShiftDeleteButtonProps = {
  shiftId: string;
  /** Куда редиректить после успешного удаления. */
  redirectTo?: string;
};

/**
 * Кнопка удаления смены для её автора. Показывает confirm-модалку, потому
 * что удаление безвозвратное (вместе со всеми Application). Если
 * на смене активный Assignment, сервер вернёт 409 — в этом случае подсказываем
 * сначала отменить смену.
 */
export function ShiftDeleteButton({
  shiftId,
  redirectTo = "/posts",
}: ShiftDeleteButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function open() {
    setMessage(null);
    setIsOpen(true);
  }

  function close() {
    if (isSubmitting) {
      return;
    }
    setIsOpen(false);
  }

  async function submitDelete() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetchWithTelegramAuth(`/api/shift-posts/${shiftId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setMessage(payload?.error ?? "Не удалось удалить смену.");
        return;
      }

      setIsOpen(false);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setMessage("Сервис временно недоступен. Попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex items-center justify-center gap-2 rounded-[22px] border border-[#df3447]/30 bg-white px-4 py-3 text-[14px] font-semibold text-[#df3447]"
      >
        <Trash2 className="h-4 w-4" />
        Удалить смену
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-6 pt-12 sm:items-center">
          <div className="relative w-full max-w-md rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(20,27,33,0.22)]">
            <button
              type="button"
              onClick={close}
              aria-label="Закрыть"
              disabled={isSubmitting}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f2f5f8] text-[#7f8791]"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="pr-10 text-[18px] font-semibold tracking-[-0.02em] text-[#101214]">
              Удалить смену?
            </h2>
            <p className="mt-2 text-[14px] leading-5 text-[#7f8791]">
              Объявление и все отклики на него удалятся безвозвратно. Если на
              смене уже подтверждён исполнитель — сначала отмените смену, а уже
              потом удаляйте.
            </p>

            {message ? (
              <p className="mt-3 rounded-[16px] bg-[#fbecee] px-3 py-2 text-[13px] leading-5 text-[#df3447]">
                {message}
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
              <button
                type="button"
                onClick={close}
                disabled={isSubmitting}
                className="rounded-[18px] bg-[#f2f5f8] px-4 py-3 text-[14px] font-semibold text-[#101214] disabled:opacity-60"
              >
                Не удалять
              </button>
              <button
                type="button"
                onClick={submitDelete}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 rounded-[18px] bg-[#df3447] px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
