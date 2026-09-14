"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { MARKETPLACE_CODES } from "@/lib/constants";
import type { MarketplaceCode } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

type ShiftNotificationFilter = {
  id: string;
  isEnabled: boolean;
  cityId: string | null;
  district: string | null;
  marketplaceCodes: MarketplaceCode[];
  urgentOnly: boolean;
  paymentMinRub: number | null;
  paymentMaxRub: number | null;
  city: {
    id: string;
    name: string;
  } | null;
};

type ShiftNotificationFilterPayload = {
  filter?: ShiftNotificationFilter | null;
};

function getMarketplaceLabel(code: MarketplaceCode) {
  return MARKETPLACE_CODES.find((item) => item.value === code)?.label ?? code;
}

function buildFilterSummary(filter: ShiftNotificationFilter) {
  const chunks = [
    filter.city?.name ?? "любой город",
    filter.district ? `район ${filter.district}` : null,
    filter.marketplaceCodes.length
      ? filter.marketplaceCodes.map((code) => getMarketplaceLabel(code)).join(", ")
      : "любой маркетплейс",
    filter.urgentOnly ? "только срочные" : null,
    filter.paymentMinRub ? `от ${formatMoney(filter.paymentMinRub)}` : null,
    filter.paymentMaxRub ? `до ${formatMoney(filter.paymentMaxRub)}` : null,
  ].filter(Boolean);

  return chunks.join(" · ");
}

export function ShiftNotificationSettings() {
  const [filter, setFilter] = useState<ShiftNotificationFilter | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadFilter() {
      setLoading(true);
      try {
        const response = await fetchWithTelegramAuth("/api/shift-notification-filter", {
          cache: "no-store",
        });
        const payload = response.ok
          ? (((await response.json().catch(() => null)) as ShiftNotificationFilterPayload | null) ??
            null)
          : null;

        if (!ignore) {
          setFilter(payload?.filter ?? null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadFilter();

    return () => {
      ignore = true;
    };
  }, []);

  const summary = useMemo(() => (filter ? buildFilterSummary(filter) : ""), [filter]);

  async function setEnabled(isEnabled: boolean) {
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetchWithTelegramAuth("/api/shift-notification-filter", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isEnabled }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось изменить уведомления.");
      }

      const payload = ((await response.json().catch(() => null)) as ShiftNotificationFilterPayload | null) ??
        null;
      setFilter(payload?.filter ?? null);
      setFeedback(isEnabled ? "Уведомления включены." : "Уведомления выключены.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Не удалось изменить уведомления.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 text-card-foreground shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-secondary text-accent">
          {filter?.isEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Уведомления о сменах</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Сохраняйте фильтр в ленте смен, и бот пришлет сообщение, когда появится подходящая
            смена.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-border bg-muted p-4">
        {loading ? (
          <p className="text-[13px] text-muted-foreground">Загружаем настройки...</p>
        ) : filter ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-semibold">
                {filter.isEnabled ? "Фильтр активен" : "Фильтр выключен"}
              </p>
              <span className="rounded-full bg-background px-3 py-1 text-[12px] font-semibold text-muted-foreground">
                {filter.isEnabled ? "Вкл" : "Выкл"}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{summary}</p>
          </>
        ) : (
          <p className="text-[13px] leading-5 text-muted-foreground">
            Фильтр еще не сохранен. Откройте ленту смен, настройте фильтры и нажмите
            “Уведомлять по этим фильтрам”.
          </p>
        )}
      </div>

      {filter ? (
        <button
          type="button"
          onClick={() => setEnabled(!filter.isEnabled)}
          disabled={saving}
          className="mt-4 w-full rounded-full bg-accent px-4 py-3 text-[14px] font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? "Сохраняем..."
            : filter.isEnabled
              ? "Выключить уведомления"
              : "Включить уведомления"}
        </button>
      ) : null}

      {feedback ? <p className="mt-3 text-center text-[12px] text-muted-foreground">{feedback}</p> : null}
    </section>
  );
}
