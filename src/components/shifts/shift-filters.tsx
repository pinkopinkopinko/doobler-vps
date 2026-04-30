"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { MARKETPLACE_CODES } from "@/lib/constants";
import { cn, formatMoney } from "@/lib/utils";

type DistrictOption = {
  label: string;
  count: number;
};

type ShiftFiltersProps = {
  activeCityId?: string | null;
  activeCityName?: string;
  activeDistrict?: string;
  districtOptions: DistrictOption[];
  marketplaceCode?: string;
  urgentOnly?: boolean;
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMin?: string;
  paymentMax?: string;
  totalCount: number;
};

type PanelKey = "district" | "marketplace" | "date" | "payment" | "urgent" | null;
type RealPanelKey = Exclude<PanelKey, null>;
type PanelPosition = {
  left: number;
  top: number;
  width: number;
};

const fieldClassName =
  "min-w-0 w-full rounded-[18px] border border-[#d7e2ec] bg-white px-4 py-3 text-[14px] text-[#101214] outline-none transition placeholder:text-[#95a1ad] focus:border-[#3387d1]";

function FilterButton({
  active = false,
  label,
  value,
  onClick,
  panelOpen = false,
}: {
  active?: boolean;
  label: string;
  value?: string;
  onClick: () => void;
  panelOpen?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[38px] w-full min-w-0 items-center justify-between gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition",
        active
          ? "border-[#3387d1] bg-[#3387d1] text-white"
          : "border-[#d7e2ec] bg-white text-[#101214]",
        panelOpen ? "relative z-[60]" : "",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-left">{value || label}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

export function ShiftFilters({
  activeCityId,
  activeCityName,
  activeDistrict = "",
  districtOptions,
  marketplaceCode = "",
  urgentOnly = false,
  searchQuery = "",
  dateFrom = "",
  dateTo = "",
  paymentMin = "",
  paymentMax = "",
  totalCount,
}: ShiftFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);
  const [draftSearch, setDraftSearch] = useState(searchQuery);
  const [draftDistrict, setDraftDistrict] = useState(activeDistrict);
  const [draftMarketplace, setDraftMarketplace] = useState(marketplaceCode);
  const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
  const [draftDateTo, setDraftDateTo] = useState(dateTo);
  const [draftPaymentMin, setDraftPaymentMin] = useState(paymentMin);
  const [draftPaymentMax, setDraftPaymentMax] = useState(paymentMax);
  const [draftUrgentOnly, setDraftUrgentOnly] = useState(urgentOnly);
  const panelContainerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<RealPanelKey, HTMLDivElement | null>>({
    district: null,
    marketplace: null,
    date: null,
    payment: null,
    urgent: null,
  });
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({
    left: 12,
    top: 44,
    width: 248,
  });

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!panelContainerRef.current) {
        return;
      }

      if (!panelContainerRef.current.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    }

    if (openPanel) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openPanel]);

  useEffect(() => {
    function updatePanelPosition(panel: RealPanelKey) {
      const container = panelContainerRef.current;
      const trigger = buttonRefs.current[panel];

      if (!container || !trigger) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const horizontalPadding = 12;
      const containerWidth = Math.max(0, containerRect.width);
      const maxWidth = Math.max(220, containerWidth - horizontalPadding * 2);
      const baseWidth =
        panel === "district" ? 308 : panel === "date" || panel === "payment" ? 272 : 248;
      const width = Math.min(baseWidth, maxWidth);
      const desiredLeft = triggerRect.left - containerRect.left;
      const left = Math.min(
        Math.max(horizontalPadding, desiredLeft),
        Math.max(horizontalPadding, containerWidth - width - horizontalPadding),
      );
      const top = trigger.offsetTop + trigger.offsetHeight + 6;

      setPanelPosition({ left, top, width });
    }

    if (!openPanel) {
      return;
    }

    const currentPanel = openPanel;
    updatePanelPosition(currentPanel);

    function handleResize() {
      updatePanelPosition(currentPanel);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [openPanel]);

  const marketplaceLabel =
    MARKETPLACE_CODES.find((item) => item.value === draftMarketplace)?.label ?? "";

  const dateLabel = useMemo(() => {
    if (draftDateFrom && draftDateTo) {
      return `${draftDateFrom} - ${draftDateTo}`;
    }

    if (draftDateFrom) {
      return `С ${draftDateFrom}`;
    }

    if (draftDateTo) {
      return `До ${draftDateTo}`;
    }

    return "";
  }, [draftDateFrom, draftDateTo]);

  const paymentLabel = useMemo(() => {
    if (draftPaymentMin && draftPaymentMax) {
      return `${formatMoney(Number(draftPaymentMin))} - ${formatMoney(Number(draftPaymentMax))}`;
    }

    if (draftPaymentMin) {
      return `От ${formatMoney(Number(draftPaymentMin))}`;
    }

    if (draftPaymentMax) {
      return `До ${formatMoney(Number(draftPaymentMax))}`;
    }

    return "";
  }, [draftPaymentMax, draftPaymentMin]);

  const activeFiltersCount = [
    draftDistrict,
    draftMarketplace,
    dateLabel,
    paymentLabel,
    draftUrgentOnly ? "urgent" : "",
    draftSearch,
  ].filter(Boolean).length;

  const quickDistricts = districtOptions.slice(0, 8);
  const resetHref = activeCityId ? `/shifts?cityId=${encodeURIComponent(activeCityId)}` : "/shifts";

  function buildFiltersHref() {
    const params = new URLSearchParams();

    if (activeCityId) {
      params.set("cityId", activeCityId);
    }

    if (draftSearch.trim()) {
      params.set("search", draftSearch.trim());
    }

    if (draftDistrict.trim()) {
      params.set("district", draftDistrict.trim());
    }

    if (draftMarketplace.trim()) {
      params.set("marketplace", draftMarketplace.trim());
    }

    if (draftDateFrom.trim()) {
      params.set("dateFrom", draftDateFrom.trim());
    }

    if (draftDateTo.trim()) {
      params.set("dateTo", draftDateTo.trim());
    }

    if (draftPaymentMin.trim()) {
      params.set("paymentMin", draftPaymentMin.trim());
    }

    if (draftPaymentMax.trim()) {
      params.set("paymentMax", draftPaymentMax.trim());
    }

    if (draftUrgentOnly) {
      params.set("urgentOnly", "true");
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpenPanel(null);

    const href = buildFiltersHref();

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function renderPanel(panel: PanelKey) {
    if (!panel) {
      return null;
    }

    return (
      <div
        className="absolute z-50 rounded-[22px] border border-[#dfe7ee] bg-white p-3 shadow-[0_24px_60px_rgba(20,27,33,0.16)]"
        style={{
          left: `${panelPosition.left}px`,
          top: `${panelPosition.top}px`,
          width: `${panelPosition.width}px`,
          maxWidth: "calc(100% - 24px)",
        }}
      >
        {panel === "district" ? (
          <div className="space-y-3">
            <label className="grid gap-2 text-[13px] font-medium text-[#101214]">
              <span>Район</span>
              <select
                value={draftDistrict}
                onChange={(event) => setDraftDistrict(event.target.value)}
                className={fieldClassName}
              >
                <option value="">Все районы</option>
                {districtOptions.map((district) => (
                  <option key={district.label} value={district.label}>
                    {district.label}
                  </option>
                ))}
              </select>
            </label>

            {quickDistricts.length ? (
              <div className="flex flex-col gap-2">
                {quickDistricts.map((district) => {
                  const isActive = district.label === draftDistrict;

                  return (
                    <button
                      key={district.label}
                      type="button"
                      onClick={() => {
                        setDraftDistrict(isActive ? "" : district.label);
                        setOpenPanel(null);
                      }}
                      className={cn(
                        "inline-flex max-w-full items-center justify-between rounded-full px-3 py-2 text-[13px] font-medium",
                        isActive ? "bg-[#3387d1] text-white" : "bg-[#eef3f7] !text-[#1c232b]",
                      )}
                    >
                      <span className="truncate">{district.label}</span>
                      <span className="ml-2 shrink-0 opacity-80">· {district.count}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {panel === "marketplace" ? (
          <label className="grid gap-2 text-[13px] font-medium text-[#101214]">
            <span>Компания</span>
            <select
              value={draftMarketplace}
              onChange={(event) => setDraftMarketplace(event.target.value)}
              className={fieldClassName}
            >
              <option value="">Все компании</option>
              {MARKETPLACE_CODES.map((marketplace) => (
                <option key={marketplace.value} value={marketplace.value}>
                  {marketplace.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {panel === "date" ? (
          <div className="grid grid-cols-1 gap-3">
            <label className="grid gap-2 text-[13px] font-medium text-[#101214]">
              <span>Дата от</span>
              <input
                type="date"
                value={draftDateFrom}
                onChange={(event) => setDraftDateFrom(event.target.value)}
                className={fieldClassName}
              />
            </label>

            <label className="grid gap-2 text-[13px] font-medium text-[#101214]">
              <span>Дата до</span>
              <input
                type="date"
                value={draftDateTo}
                onChange={(event) => setDraftDateTo(event.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>
        ) : null}

        {panel === "payment" ? (
          <div className="grid grid-cols-1 gap-3">
            <label className="grid gap-2 text-[13px] font-medium text-[#101214]">
              <span>Оплата от, ₽</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={draftPaymentMin}
                onChange={(event) => setDraftPaymentMin(event.target.value)}
                className={fieldClassName}
                placeholder="3000"
              />
            </label>

            <label className="grid gap-2 text-[13px] font-medium text-[#101214]">
              <span>Оплата до, ₽</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={draftPaymentMax}
                onChange={(event) => setDraftPaymentMax(event.target.value)}
                className={fieldClassName}
                placeholder="7000"
              />
            </label>
          </div>
        ) : null}

        {panel === "urgent" ? (
          <label className="flex min-w-0 items-center gap-3 rounded-[18px] bg-[#f4f8fb] px-4 py-3 text-[14px] font-medium text-[#101214]">
            <input
              type="checkbox"
              checked={draftUrgentOnly}
              onChange={(event) => setDraftUrgentOnly(event.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-[#c2cfda] text-[#3387d1]"
            />
            <span className="truncate">Только срочные смены</span>
          </label>
        ) : null}
      </div>
    );
  }

  return (
    <section className="relative z-20 mb-5 rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="grid gap-2 text-[13px] font-medium text-[#101214]">
          <span>Поиск</span>
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            className={fieldClassName}
            placeholder="Улица, район или заголовок"
          />
        </label>

        <div ref={panelContainerRef} className="relative">
          <div className="grid grid-cols-2 gap-2">
            <div
              ref={(node) => {
                buttonRefs.current.district = node;
              }}
            >
              <FilterButton
                active={openPanel === "district" || Boolean(draftDistrict)}
                panelOpen={openPanel === "district"}
                label="Район"
                value={draftDistrict}
                onClick={() => setOpenPanel((current) => (current === "district" ? null : "district"))}
              />
            </div>

            <div
              ref={(node) => {
                buttonRefs.current.marketplace = node;
              }}
            >
              <FilterButton
                active={openPanel === "marketplace" || Boolean(draftMarketplace)}
                panelOpen={openPanel === "marketplace"}
                label="Компания"
                value={marketplaceLabel}
                onClick={() =>
                  setOpenPanel((current) => (current === "marketplace" ? null : "marketplace"))
                }
              />
            </div>

            <div
              ref={(node) => {
                buttonRefs.current.date = node;
              }}
            >
              <FilterButton
                active={openPanel === "date" || Boolean(dateLabel)}
                panelOpen={openPanel === "date"}
                label="Дата"
                value={dateLabel}
                onClick={() => setOpenPanel((current) => (current === "date" ? null : "date"))}
              />
            </div>

            <div
              ref={(node) => {
                buttonRefs.current.payment = node;
              }}
            >
              <FilterButton
                active={openPanel === "payment" || Boolean(paymentLabel)}
                panelOpen={openPanel === "payment"}
                label="Оплата"
                value={paymentLabel}
                onClick={() => setOpenPanel((current) => (current === "payment" ? null : "payment"))}
              />
            </div>

            <div
              ref={(node) => {
                buttonRefs.current.urgent = node;
              }}
            >
              <FilterButton
                active={openPanel === "urgent" || draftUrgentOnly}
                panelOpen={openPanel === "urgent"}
                label="Срочность"
                value={draftUrgentOnly ? "Срочные" : ""}
                onClick={() => setOpenPanel((current) => (current === "urgent" ? null : "urgent"))}
              />
            </div>
          </div>

          {openPanel ? renderPanel(openPanel) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-full bg-[#3387d1] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {isPending ? "Обновляем..." : "Применить"}
          </button>
          <Link
            href={resetHref}
            className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-[#d0dae3] bg-[#e7eef5] px-4 text-[13px] font-semibold !text-[#1c232b]"
          >
            Сбросить
          </Link>
        </div>
        <div className="flex items-center justify-between text-[12px] text-[#7f8791]">
          <span>
            {activeCityName ? `${activeCityName} · ` : ""}
            Фильтров: {activeFiltersCount}
          </span>
          <span>{`${totalCount} объявлений`}</span>
        </div>
      </form>
    </section>
  );
}
