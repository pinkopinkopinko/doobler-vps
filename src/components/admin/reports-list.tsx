"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reasonCode: string;
  description: string | null;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  riskLevel: string;
  resolutionNote: string | null;
  createdAt: string;
  reporter: {
    id: string;
    telegramId: string;
    username: string | null;
    displayName: string;
  } | null;
  moderator: { id: string; displayName: string } | null;
};

const STATUSES = [
  { value: "", label: "Все" },
  { value: "OPEN", label: "Открытые" },
  { value: "IN_REVIEW", label: "В работе" },
  { value: "RESOLVED", label: "Решены" },
  { value: "DISMISSED", label: "Отклонены" },
];

const RISK_LEVELS = [
  { value: "", label: "Любой риск" },
  { value: "HIGH", label: "HIGH" },
  { value: "MEDIUM", label: "MEDIUM" },
  { value: "LOW", label: "LOW" },
];

const TARGET_TYPES = [
  { value: "", label: "Все объекты" },
  { value: "USER", label: "Пользователь" },
  { value: "SHIFT_POST", label: "Смена" },
  { value: "APPLICATION", label: "Отклик" },
  { value: "ASSIGNMENT", label: "Назначение" },
  { value: "REVIEW", label: "Отзыв" },
  { value: "PICKUP_POINT", label: "ПВЗ" },
];

type Props = {
  initialStatus?: string;
  initialRiskLevel?: string;
  initialTargetType?: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ReportsList({ initialStatus, initialRiskLevel, initialTargetType }: Props) {
  const [status, setStatus] = useState(initialStatus ?? "OPEN");
  const [riskLevel, setRiskLevel] = useState(initialRiskLevel ?? "");
  const [targetType, setTargetType] = useState(initialTargetType ?? "");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (riskLevel) params.set("riskLevel", riskLevel);
    if (targetType) params.set("targetType", targetType);
    return params.toString();
  }, [status, riskLevel, targetType]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithTelegramAuth(`/api/admin/reports?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось получить жалобы.");
        return;
      }
      const payload = (await response.json()) as { reports: Report[] };
      setReports(payload.reports);
    } catch (err) {
      console.error("[admin] reports reload", err);
      setError("Сеть недоступна.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function act(report: Report, action: "resolve" | "dismiss" | "in_review") {
    setBusyId(`${report.id}:${action}`);
    try {
      const response = await fetchWithTelegramAuth(
        `/api/admin/reports/${report.id}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: notesById[report.id]?.trim() || undefined,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось обновить жалобу.");
        return;
      }

      setNotesById((prev) => ({ ...prev, [report.id]: "" }));
      await reload();
    } catch (err) {
      console.error("[admin] report action", err);
      setError("Сеть недоступна.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Select label="Статус" value={status} onChange={setStatus} options={STATUSES} />
        <Select label="Риск" value={riskLevel} onChange={setRiskLevel} options={RISK_LEVELS} />
        <Select
          label="Объект"
          value={targetType}
          onChange={setTargetType}
          options={TARGET_TYPES}
        />
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

      {!loading && reports && reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Жалобы по текущим фильтрам не найдены.
        </div>
      ) : null}

      {!loading && reports && reports.length > 0 ? (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li
              key={report.id}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={report.riskLevel} />
                <StatusBadge status={report.status} />
                <span className="text-xs text-slate-400">{formatDateTime(report.createdAt)}</span>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{report.reasonCode}</p>
                  {report.description ? (
                    <p className="mt-1 text-sm text-slate-700">{report.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Объект: <TargetLink type={report.targetType} id={report.targetId} />
                  </p>
                  {report.reporter ? (
                    <p className="text-xs text-slate-500">
                      От:{" "}
                      <Link
                        className="text-slate-700 underline-offset-2 hover:underline"
                        href={`/admin/users/${report.reporter.id}`}
                      >
                        {report.reporter.displayName}
                        {report.reporter.username ? ` (@${report.reporter.username})` : ""}
                      </Link>
                    </p>
                  ) : null}
                  {report.moderator ? (
                    <p className="text-xs text-slate-500">
                      Модератор: {report.moderator.displayName}
                    </p>
                  ) : null}
                  {report.resolutionNote ? (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Заметка: {report.resolutionNote}
                    </p>
                  ) : null}
                </div>
              </div>

              {report.status !== "RESOLVED" && report.status !== "DISMISSED" ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <textarea
                    value={notesById[report.id] ?? ""}
                    onChange={(event) =>
                      setNotesById((prev) => ({ ...prev, [report.id]: event.target.value }))
                    }
                    placeholder="Заметка модератора (необязательно)"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                  <div className="flex flex-wrap gap-2">
                    {report.status !== "IN_REVIEW" ? (
                      <ActionButton
                        onClick={() => act(report, "in_review")}
                        loading={busyId === `${report.id}:in_review`}
                        variant="neutral"
                      >
                        Взять в работу
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      onClick={() => act(report, "resolve")}
                      loading={busyId === `${report.id}:resolve`}
                      variant="success"
                    >
                      Подтвердить
                    </ActionButton>
                    <ActionButton
                      onClick={() => act(report, "dismiss")}
                      loading={busyId === `${report.id}:dismiss`}
                      variant="danger"
                    >
                      Отклонить
                    </ActionButton>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-slate-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RiskBadge({ level }: { level: string }) {
  const classes = {
    HIGH: "bg-rose-100 text-rose-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-slate-100 text-slate-700",
  }[level] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", classes)}>
      risk: {level}
    </span>
  );
}

function StatusBadge({ status }: { status: Report["status"] }) {
  const classes = {
    OPEN: "bg-amber-100 text-amber-700",
    IN_REVIEW: "bg-blue-100 text-blue-700",
    RESOLVED: "bg-emerald-100 text-emerald-700",
    DISMISSED: "bg-slate-100 text-slate-700",
  }[status];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", classes)}>{status}</span>
  );
}

function ActionButton({
  children,
  onClick,
  loading,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  variant: "success" | "danger" | "neutral";
}) {
  const classes = {
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    neutral: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50",
        classes,
      )}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function TargetLink({ type, id }: { type: string; id: string }) {
  if (type === "USER") {
    return (
      <Link className="text-slate-700 underline-offset-2 hover:underline" href={`/admin/users/${id}`}>
        USER/{id}
      </Link>
    );
  }
  if (type === "SHIFT_POST") {
    return (
      <Link
        className="text-slate-700 underline-offset-2 hover:underline"
        href={`/admin/shifts?q=${id}`}
      >
        SHIFT_POST/{id}
      </Link>
    );
  }
  return (
    <span className="font-mono text-xs text-slate-500">
      {type}/{id}
    </span>
  );
}
