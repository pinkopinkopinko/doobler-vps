"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, ShieldAlert, ShieldCheck, ShieldPlus, Undo2 } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";

type Props = {
  userId: string;
  isBanned: boolean;
  isModerator: boolean;
  isSelf: boolean;
};

export function UserDetailActions({ userId, isBanned, isModerator, isSelf }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "ban" | "unban" | "role">(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function submit(action: "ban" | "unban" | "role", body: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    try {
      const endpoint =
        action === "ban"
          ? `/api/admin/users/${userId}/ban`
          : action === "unban"
            ? `/api/admin/users/${userId}/unban`
            : `/api/admin/users/${userId}/roles`;

      const response = await fetchWithTelegramAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось выполнить действие.");
        return;
      }

      router.refresh();
      if (action === "ban") {
        setReason("");
      }
    } catch (err) {
      console.error("[admin] user action", err);
      setError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  if (isSelf) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Это ваш аккаунт — действия недоступны.
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {isBanned ? (
        <button
          onClick={() => submit("unban", {})}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === "unban" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Undo2 className="h-4 w-4" />
          )}
          Разблокировать
        </button>
      ) : (
        <>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Причина бана (обязательно)"
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          />
          <button
            onClick={() => {
              if (!reason.trim()) {
                setError("Укажите причину бана.");
                return;
              }
              void submit("ban", { reason: reason.trim() });
            }}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy === "ban" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Забанить
          </button>
        </>
      )}

      {isModerator ? (
        <button
          onClick={() => submit("role", { role: "MODERATOR", action: "remove" })}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {busy === "role" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Снять роль модератора
        </button>
      ) : (
        <button
          onClick={() => submit("role", { role: "MODERATOR", action: "add" })}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {busy === "role" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldPlus className="h-4 w-4" />
          )}
          Выдать роль модератора
        </button>
      )}

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
