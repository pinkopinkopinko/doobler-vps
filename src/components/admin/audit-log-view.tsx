"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";

type Entry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  metaJson: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; displayName: string } | null;
};

const ENTITY_TYPES = [
  { value: "", label: "Все сущности" },
  { value: "User", label: "User" },
  { value: "UserRole", label: "UserRole" },
  { value: "Report", label: "Report" },
  { value: "ShiftPost", label: "ShiftPost" },
  { value: "Application", label: "Application" },
  { value: "Assignment", label: "Assignment" },
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type Props = { initialEntityType?: string; initialEntityId?: string };

export function AuditLogView({ initialEntityType, initialEntityId }: Props) {
  const [entityType, setEntityType] = useState(initialEntityType ?? "");
  const [entityIdInput, setEntityIdInput] = useState(initialEntityId ?? "");
  const [entityId, setEntityId] = useState(initialEntityId ?? "");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (entityType) params.set("entityType", entityType);
    if (entityId) params.set("entityId", entityId);
    return params.toString();
  }, [entityType, entityId]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithTelegramAuth(`/api/admin/audit?${qs}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось получить audit log.");
        return;
      }
      const payload = (await response.json()) as { entries: Entry[] };
      setEntries(payload.entries);
    } catch (err) {
      console.error("[admin] audit reload", err);
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

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setEntityId(entityIdInput.trim());
        }}
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="text-xs uppercase tracking-wider text-slate-500">Сущность</span>
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-slate-400"
          >
            {ENTITY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 items-center gap-2 text-sm text-slate-700">
          <span className="text-xs uppercase tracking-wider text-slate-500">ID</span>
          <input
            value={entityIdInput}
            onChange={(event) => setEntityIdInput(event.target.value)}
            placeholder="конкретный entityId (необязательно)"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-slate-400"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Применить
        </button>
      </form>

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

      {!loading && entries && entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Записей по текущим фильтрам нет.
        </div>
      ) : null}

      {!loading && entries && entries.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {entry.entityType}
                </span>
                <span className="font-medium text-slate-900">{entry.action}</span>
                <span className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                <span>
                  id:{" "}
                  {entry.entityType === "User" ? (
                    <Link
                      href={`/admin/users/${entry.entityId}`}
                      className="text-slate-700 underline-offset-2 hover:underline"
                    >
                      {entry.entityId}
                    </Link>
                  ) : (
                    <span className="font-mono">{entry.entityId}</span>
                  )}
                </span>
                {entry.actor ? (
                  <span>
                    actor:{" "}
                    <Link
                      href={`/admin/users/${entry.actor.id}`}
                      className="text-slate-700 underline-offset-2 hover:underline"
                    >
                      {entry.actor.displayName}
                    </Link>
                  </span>
                ) : (
                  <span>actor: —</span>
                )}
              </div>
              {entry.metaJson && Object.keys(entry.metaJson).length > 0 ? (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {JSON.stringify(entry.metaJson, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
