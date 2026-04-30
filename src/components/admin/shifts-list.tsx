"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Ban, Search } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type ShiftRow = {
  id: string;
  title: string;
  type: string;
  status:
    | "PUBLISHED"
    | "IN_REVIEW"
    | "MATCHED"
    | "CLOSED"
    | "CANCELLED"
    | "EXPIRED";
  cityName: string;
  district: string;
  address: string;
  marketplace: string;
  paymentAmountRub: number;
  workersNeeded: number;
  isUrgent: boolean;
  shiftDate: string;
  publishedAt: string;
  applicationsCount: number;
  createdBy: {
    id: string;
    displayName: string;
    username: string | null;
    isBanned: boolean;
  };
};

const STATUSES = [
  { value: "", label: "Все" },
  { value: "PUBLISHED", label: "Опубликовано" },
  { value: "IN_REVIEW", label: "На проверке" },
  { value: "MATCHED", label: "Назначено" },
  { value: "CLOSED", label: "Закрыто" },
  { value: "CANCELLED", label: "Отменено" },
  { value: "EXPIRED", label: "Истекло" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
}

type Props = { initialStatus?: string; initialQuery?: string };

export function ShiftsList({ initialStatus, initialQuery }: Props) {
  const [status, setStatus] = useState(initialStatus ?? "PUBLISHED");
  const [queryInput, setQueryInput] = useState(initialQuery ?? "");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [rows, setRows] = useState<ShiftRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelState, setCancelState] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (query) params.set("q", query);
    return params.toString();
  }, [status, query]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithTelegramAuth(`/api/admin/shifts?${qs}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось получить смены.");
        return;
      }
      const payload = (await response.json()) as { shifts: ShiftRow[] };
      setRows(payload.shifts);
    } catch (err) {
      console.error("[admin] shifts reload", err);
      setError("Сеть недоступна.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function cancel(row: ShiftRow) {
    const reason = cancelState[row.id]?.trim();
    if (!reason) {
      setError(`Укажите причину для отмены смены «${row.title}».`);
      return;
    }

    setBusyId(row.id);
    setError(null);
    try {
      const response = await fetchWithTelegramAuth(`/api/admin/shifts/${row.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось отменить смену.");
        return;
      }
      setCancelState((prev) => ({ ...prev, [row.id]: "" }));
      await reload();
    } catch (err) {
      console.error("[admin] shift cancel", err);
      setError("Сеть недоступна.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="text-xs uppercase tracking-wider text-slate-500">Статус</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-slate-400"
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(queryInput.trim());
          }}
          className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
        >
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Поиск по заголовку, адресу, описанию, ID"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
          >
            Ок
          </button>
        </form>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Загружаем…
        </div>
      ) : null}

      {!loading && rows && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Смен по текущим фильтрам нет.
        </div>
      ) : null}

      {!loading && rows && rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={row.status} />
                {row.isUrgent ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                    срочно
                  </span>
                ) : null}
                <span className="text-xs text-slate-400">{row.marketplace}</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">опубликовано {formatDate(row.publishedAt)}</span>
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-900">{row.title}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {row.cityName} · {row.district} · {row.address}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {row.paymentAmountRub.toLocaleString("ru-RU")} ₽ · {row.workersNeeded} чел. ·{" "}
                  смена {formatDate(row.shiftDate)} · откликов {row.applicationsCount}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Автор:{" "}
                  <Link
                    href={`/admin/users/${row.createdBy.id}`}
                    className="text-slate-700 underline-offset-2 hover:underline"
                  >
                    {row.createdBy.displayName}
                    {row.createdBy.username ? ` (@${row.createdBy.username})` : ""}
                  </Link>
                  {row.createdBy.isBanned ? (
                    <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700">
                      автор забанен
                    </span>
                  ) : null}
                </p>
              </div>

              {row.status === "PUBLISHED" || row.status === "IN_REVIEW" || row.status === "MATCHED" ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <textarea
                    value={cancelState[row.id] ?? ""}
                    onChange={(event) =>
                      setCancelState((prev) => ({ ...prev, [row.id]: event.target.value }))
                    }
                    placeholder="Причина отмены"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                  <button
                    onClick={() => cancel(row)}
                    disabled={busyId === row.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {busyId === row.id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                    Отменить смену
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusChip({ status }: { status: ShiftRow["status"] }) {
  const classes = {
    PUBLISHED: "bg-emerald-100 text-emerald-700",
    IN_REVIEW: "bg-amber-100 text-amber-700",
    MATCHED: "bg-blue-100 text-blue-700",
    CLOSED: "bg-slate-200 text-slate-700",
    CANCELLED: "bg-rose-100 text-rose-700",
    EXPIRED: "bg-slate-100 text-slate-500",
  }[status];

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", classes)}>{status}</span>
  );
}
