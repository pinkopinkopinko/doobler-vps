"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, UserPlus2 } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";

type ManagerRow = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  isBanned: boolean;
  pickupPointsCount: number;
};

type ManagersPayload = {
  managers?: ManagerRow[];
  error?: string;
};

export function OwnerManagerPanel() {
  const [username, setUsername] = useState("");
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadManagers() {
      setLoading(true);

      try {
        const response = await fetchWithTelegramAuth("/api/managers", { cache: "no-store" });
        const payload = ((await response.json().catch(() => null)) as ManagersPayload | null) ?? null;

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setMessage(payload?.error ?? "Не удалось загрузить управляющих.");
          setManagers([]);
          return;
        }

        setManagers(payload?.managers ?? []);
      } catch {
        if (!ignore) {
          setMessage("Не удалось загрузить управляющих.");
          setManagers([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadManagers();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleAssign() {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetchWithTelegramAuth("/api/managers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      const payload = ((await response.json().catch(() => null)) as
        | { manager?: ManagerRow; error?: string }
        | null) ?? null;

      if (!response.ok || !payload?.manager) {
        setMessage(payload?.error ?? "Не удалось назначить управляющего.");
        return;
      }

      setManagers((current) => {
        const withoutCurrent = current.filter((manager) => manager.id !== payload.manager?.id);
        return [...withoutCurrent, payload.manager as ManagerRow].sort((left, right) =>
          [left.firstName, left.lastName].filter(Boolean).join(" ").localeCompare(
            [right.firstName, right.lastName].filter(Boolean).join(" "),
            "ru",
          ),
        );
      });
      setUsername("");
      setMessage("Управляющий назначен. Он сможет создавать смены только в ваших ПВЗ.");
    } catch {
      setMessage("Не удалось назначить управляющего.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-[#eef3f7] p-2 text-[#3387d1]">
          <UserPlus2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[17px] font-semibold tracking-[-0.03em]">Управляющие</h4>
          <p className="mt-1 text-[14px] font-medium text-[#7f8791]">
            Назначение только по точному Telegram username. Доступ выдаётся к вашим ПВЗ.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="@telegram_username"
          className="min-w-0 flex-1 rounded-[20px] border border-[#e1e6eb] bg-[#f8fbfd] px-4 py-3 text-[14px] text-[#101214] outline-none transition placeholder:text-[#a6abb2] focus:border-[#3387d1] focus:bg-white"
        />
        <button
          type="button"
          disabled={submitting || !username.trim()}
          onClick={() => void handleAssign()}
          className="inline-flex items-center justify-center rounded-[20px] bg-[#3387d1] px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Назначить"}
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[14px] text-[#7f8791]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Загружаем список управляющих...
          </div>
        ) : managers.length > 0 ? (
          <div className="space-y-2">
            {managers.map((manager) => (
              <div
                key={manager.id}
                className="flex items-center justify-between gap-3 rounded-[20px] bg-[#f8fbfd] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#101214]">
                    {[manager.firstName, manager.lastName].filter(Boolean).join(" ")}
                  </p>
                  <p className="mt-1 text-[13px] text-[#7f8791]">
                    {manager.username ? `@${manager.username}` : "без username"} · ПВЗ:{" "}
                    {manager.pickupPointsCount}
                  </p>
                </div>
                {manager.isBanned ? (
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-700">
                    забанен
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-[#7f8791]">Пока никто не назначен.</p>
        )}
      </div>

      {message ? <p className="mt-4 text-[14px] text-[#7f8791]">{message}</p> : null}
    </div>
  );
}
