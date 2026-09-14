"use client";

import { useState, useTransition } from "react";
import { Check, FileText, LoaderCircle, RefreshCw, X } from "lucide-react";

import type { MarketplaceCode } from "@/lib/types";

type EmployerVerificationItem = {
  id: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    telegramId: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
    marketplaces: MarketplaceCode[];
    regionName: string | null;
  } | null;
  document: {
    mediaId: string;
    mimeType: string;
    byteSize: number;
    originalName: string | null;
    url: string;
  } | null;
};

type Props = {
  initialItems: EmployerVerificationItem[];
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "На проверке",
  APPROVED: "Подтверждено",
  REJECTED: "Отклонено",
  EXPIRED: "Заменено новым документом",
};

function formatBytes(value: number) {
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

export function EmployerVerificationsList({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  async function reload() {
    startTransition(async () => {
      const response = await fetch("/api/admin/employer-verifications", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        verifications?: EmployerVerificationItem[];
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Не удалось обновить список.");
        return;
      }

      setItems(payload?.verifications ?? []);
      setError(null);
    });
  }

  async function act(verificationId: string, action: "approve" | "reject") {
    setPendingId(verificationId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/employer-verifications/${verificationId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Не удалось выполнить действие.");
        return;
      }

      await reload();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Проверка работодателей</h3>
          <p className="text-sm text-slate-500">Документы на владение или управление ПВЗ.</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Заявок работодателей пока нет.
        </div>
      ) : null}

      {items.map((item) => {
        const displayName = item.user
          ? [item.user.firstName, item.user.lastName].filter(Boolean).join(" ")
          : "Пользователь удален";
        const pending = pendingId === item.id;
        const isImage = item.document?.mimeType.startsWith("image/");

        return (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-semibold text-slate-900">{displayName}</h4>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                  <p>
                    Telegram:{" "}
                    {item.user?.username ? `@${item.user.username}` : item.user?.telegramId ?? "-"}
                  </p>
                  <p>Регион: {item.user?.regionName ?? "не указан"}</p>
                  <p>Маркетплейсы: {item.user?.marketplaces.join(", ") || "-"}</p>
                  <p>Создано: {new Date(item.createdAt).toLocaleString("ru-RU")}</p>
                </div>
              </div>
            </div>

            {item.document ? (
              <a
                href={item.document.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.document.url}
                    alt="Документ работодателя"
                    className="max-h-80 w-full object-contain"
                  />
                ) : (
                  <div className="flex items-center gap-3 p-4 text-sm font-medium text-slate-700">
                    <FileText className="h-5 w-5 text-slate-500" />
                    Открыть документ
                  </div>
                )}
                <div className="px-3 py-2 text-xs text-slate-500">
                  {item.document.originalName ?? item.document.mimeType} ·{" "}
                  {formatBytes(item.document.byteSize)}
                </div>
              </a>
            ) : (
              <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Документ не найден.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void act(item.id, "approve")}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Подтвердить
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void act(item.id, "reject")}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                Отклонить
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
