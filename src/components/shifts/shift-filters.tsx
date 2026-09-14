"use client";

import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { MARKETPLACE_CODES } from "@/lib/constants";
import {
  getPlatformPrefixFromPathname,
  withPlatformPrefix,
} from "@/lib/routing/platform";
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

type DraftFilters = {
  sourceKey: string;
  search: string;
  district: string;
  marketplace: string;
  dateFrom: string;
  dateTo: string;
  paymentMin: string;
  paymentMax: string;
  urgentOnly: boolean;
};

const fieldClassName =
  "min-w-0 w-full rounded-[18px] border border-[#d7e2ec] bg-white px-4 py-3 text-[14px] text-[#101214] outline-none transition placeholder:text-[#95a1ad] focus:border-[#3387d1]";

const chipClassName =
  "inline-flex items-center justify-center rounded-full px-3.5 py-2 text-[13px] font-medium transition";

const chipActive = "bg-[#3387d1] text-white";
const chipIdle = "bg-[#eef3f7] text-[#1c232b]";

function getDraftSourceKey(values: Omit<DraftFilters, "sourceKey">) {
  return JSON.stringify(values);
}

function createDraftFilters(values: Omit<DraftFilters, "sourceKey">): DraftFilters {
  return {
    ...values,
    sourceKey: getDraftSourceKey(values),
  };
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
  const platformPrefix = getPlatformPrefixFromPathname(pathname);
  const [isPending, startTransition] = useTransition();

  // Drafts — что юзер сейчас выбирает в модалке. Применяются только по
  // кнопке «Применить» (либо «Сбросить»). Поиск — отдельный draftSearch
  // снаружи модалки, применяется тут же по submit.
  const currentDraftValues = {
    search: searchQuery,
    district: activeDistrict,
    marketplace: marketplaceCode,
    dateFrom,
    dateTo,
    paymentMin,
    paymentMax,
    urgentOnly,
  };
  const currentDraftSourceKey = getDraftSourceKey(currentDraftValues);
  const [draftFilters, setDraftFilters] = useState(() => createDraftFilters(currentDraftValues));

  if (draftFilters.sourceKey !== currentDraftSourceKey) {
    setDraftFilters(createDraftFilters(currentDraftValues));
  }

  const {
    search: draftSearch,
    district: draftDistrict,
    marketplace: draftMarketplace,
    dateFrom: draftDateFrom,
    dateTo: draftDateTo,
    paymentMin: draftPaymentMin,
    paymentMax: draftPaymentMax,
    urgentOnly: draftUrgentOnly,
  } = draftFilters;

  const setDraftSearch = (search: string) =>
    setDraftFilters((draft) => ({ ...draft, search }));
  const setDraftDistrict = (district: string) =>
    setDraftFilters((draft) => ({ ...draft, district }));
  const setDraftMarketplace = (marketplace: string) =>
    setDraftFilters((draft) => ({ ...draft, marketplace }));
  const setDraftDateFrom = (nextDateFrom: string) =>
    setDraftFilters((draft) => ({ ...draft, dateFrom: nextDateFrom }));
  const setDraftDateTo = (nextDateTo: string) =>
    setDraftFilters((draft) => ({ ...draft, dateTo: nextDateTo }));
  const setDraftPaymentMin = (nextPaymentMin: string) =>
    setDraftFilters((draft) => ({ ...draft, paymentMin: nextPaymentMin }));
  const setDraftPaymentMax = (nextPaymentMax: string) =>
    setDraftFilters((draft) => ({ ...draft, paymentMax: nextPaymentMax }));
  const setDraftUrgentOnly = (nextUrgentOnly: boolean) =>
    setDraftFilters((draft) => ({ ...draft, urgentOnly: nextUrgentOnly }));

  const [modalOpen, setModalOpen] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState<string | null>(null);

  // Лочим скролл фона пока модалка открыта.
  useEffect(() => {
    if (!modalOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [modalOpen]);

  const activeFiltersCount = useMemo(() => {
    return [
      activeDistrict,
      marketplaceCode,
      dateFrom || dateTo ? "date" : "",
      paymentMin || paymentMax ? "payment" : "",
      urgentOnly ? "urgent" : "",
      searchQuery,
    ].filter(Boolean).length;
  }, [
    activeDistrict,
    marketplaceCode,
    dateFrom,
    dateTo,
    paymentMin,
    paymentMax,
    urgentOnly,
    searchQuery,
  ]);

  const resetHref = withPlatformPrefix(
    activeCityId ? `/shifts?cityId=${encodeURIComponent(activeCityId)}` : "/shifts",
    platformPrefix,
  );

  function buildHref(overrides?: {
    search?: string;
    district?: string;
    marketplace?: string;
    dateFrom?: string;
    dateTo?: string;
    paymentMin?: string;
    paymentMax?: string;
    urgentOnly?: boolean;
  }) {
    const params = new URLSearchParams();

    if (activeCityId) params.set("cityId", activeCityId);

    const search = (overrides?.search ?? draftSearch).trim();
    const district = (overrides?.district ?? draftDistrict).trim();
    const marketplace = (overrides?.marketplace ?? draftMarketplace).trim();
    const dFrom = (overrides?.dateFrom ?? draftDateFrom).trim();
    const dTo = (overrides?.dateTo ?? draftDateTo).trim();
    const pMin = (overrides?.paymentMin ?? draftPaymentMin).trim();
    const pMax = (overrides?.paymentMax ?? draftPaymentMax).trim();
    const urgent = overrides?.urgentOnly ?? draftUrgentOnly;

    if (search) params.set("search", search);
    if (district) params.set("district", district);
    if (marketplace) params.set("marketplace", marketplace);
    if (dFrom) params.set("dateFrom", dFrom);
    if (dTo) params.set("dateTo", dTo);
    if (pMin) params.set("paymentMin", pMin);
    if (pMax) params.set("paymentMax", pMax);
    if (urgent) params.set("urgentOnly", "true");

    const query = params.toString();
    const currentPathname = pathname || withPlatformPrefix("/shifts", platformPrefix);
    return query ? `${currentPathname}?${query}` : currentPathname;
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => {
      router.replace(buildHref(), { scroll: false });
    });
  }

  function handleApplyFilters() {
    setModalOpen(false);
    startTransition(() => {
      router.replace(buildHref(), { scroll: false });
    });
  }

  function handleResetFilters() {
    setDraftFilters((draft) => ({
      ...draft,
      district: "",
      marketplace: "",
      dateFrom: "",
      dateTo: "",
      paymentMin: "",
      paymentMax: "",
      urgentOnly: false,
    }));
  }

  function parsePaymentAmount(value: string) {
    const amount = Number(value.replace(/\s/g, ""));
    return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : null;
  }

  async function handleSaveNotificationFilter() {
    if (!activeCityId) {
      setNotificationFeedback("Сначала выберите город в фильтрах.");
      return;
    }

    setNotificationSaving(true);
    setNotificationFeedback(null);

    try {
      const response = await fetchWithTelegramAuth("/api/shift-notification-filter", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isEnabled: true,
          cityId: activeCityId,
          district: draftDistrict.trim() || null,
          marketplaceCodes: draftMarketplace ? [draftMarketplace] : [],
          urgentOnly: draftUrgentOnly,
          paymentMinRub: parsePaymentAmount(draftPaymentMin),
          paymentMaxRub: parsePaymentAmount(draftPaymentMax),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось сохранить уведомления.");
      }

      setNotificationFeedback("Готово: будем присылать новые смены по этим фильтрам.");
    } catch (error) {
      setNotificationFeedback(
        error instanceof Error ? error.message : "Не удалось сохранить уведомления.",
      );
    } finally {
      setNotificationSaving(false);
    }
  }

  return (
    <section className="relative z-20 mb-5 rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
      <form onSubmit={handleSearchSubmit} className="space-y-3">
        <label className="grid gap-2 text-[13px] font-medium text-[#101214]">
          <span>Поиск</span>
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            className={fieldClassName}
            placeholder="Улица, район или заголовок"
          />
        </label>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-[#d7e2ec] bg-white px-4 py-3 text-[14px] font-semibold text-[#101214] transition hover:bg-[#f4f8fb]"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Фильтры
          </span>
          {activeFiltersCount > 0 ? (
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#3387d1] px-2 text-[12px] font-semibold text-white">
              {activeFiltersCount}
            </span>
          ) : (
            <span className="text-[12px] font-medium text-[#7f8791]">Все</span>
          )}
        </button>

        <div className="flex items-center justify-between text-[12px] text-[#7f8791]">
          <span>{activeCityName ?? "Город не выбран"}</span>
          <span>{`${totalCount} объявлений`}</span>
        </div>
      </form>

      {modalOpen ? (
        <FiltersModal
          districtOptions={districtOptions}
          draftDistrict={draftDistrict}
          setDraftDistrict={setDraftDistrict}
          draftMarketplace={draftMarketplace}
          setDraftMarketplace={setDraftMarketplace}
          draftDateFrom={draftDateFrom}
          setDraftDateFrom={setDraftDateFrom}
          draftDateTo={draftDateTo}
          setDraftDateTo={setDraftDateTo}
          draftPaymentMin={draftPaymentMin}
          setDraftPaymentMin={setDraftPaymentMin}
          draftPaymentMax={draftPaymentMax}
          setDraftPaymentMax={setDraftPaymentMax}
          draftUrgentOnly={draftUrgentOnly}
          setDraftUrgentOnly={setDraftUrgentOnly}
          isPending={isPending}
          activeFiltersCount={activeFiltersCount}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          onSaveNotificationFilter={handleSaveNotificationFilter}
          notificationSaving={notificationSaving}
          notificationFeedback={notificationFeedback}
          onClose={() => setModalOpen(false)}
          resetHref={resetHref}
        />
      ) : null}
    </section>
  );
}

type FiltersModalProps = {
  districtOptions: DistrictOption[];
  draftDistrict: string;
  setDraftDistrict: (v: string) => void;
  draftMarketplace: string;
  setDraftMarketplace: (v: string) => void;
  draftDateFrom: string;
  setDraftDateFrom: (v: string) => void;
  draftDateTo: string;
  setDraftDateTo: (v: string) => void;
  draftPaymentMin: string;
  setDraftPaymentMin: (v: string) => void;
  draftPaymentMax: string;
  setDraftPaymentMax: (v: string) => void;
  draftUrgentOnly: boolean;
  setDraftUrgentOnly: (v: boolean) => void;
  isPending: boolean;
  activeFiltersCount: number;
  onApply: () => void;
  onReset: () => void;
  onSaveNotificationFilter: () => void;
  notificationSaving: boolean;
  notificationFeedback: string | null;
  onClose: () => void;
  resetHref: string;
};

function FiltersModal({
  districtOptions,
  draftDistrict,
  setDraftDistrict,
  draftMarketplace,
  setDraftMarketplace,
  draftDateFrom,
  setDraftDateFrom,
  draftDateTo,
  setDraftDateTo,
  draftPaymentMin,
  setDraftPaymentMin,
  draftPaymentMax,
  setDraftPaymentMax,
  draftUrgentOnly,
  setDraftUrgentOnly,
  isPending,
  activeFiltersCount,
  onApply,
  onReset,
  onSaveNotificationFilter,
  notificationSaving,
  notificationFeedback,
  onClose,
  resetHref,
}: FiltersModalProps) {
  const paymentSummary = useMemo(() => {
    if (draftPaymentMin && draftPaymentMax) {
      return `${formatMoney(Number(draftPaymentMin))} - ${formatMoney(Number(draftPaymentMax))}`;
    }
    if (draftPaymentMin) return `От ${formatMoney(Number(draftPaymentMin))}`;
    if (draftPaymentMax) return `До ${formatMoney(Number(draftPaymentMax))}`;
    return "";
  }, [draftPaymentMax, draftPaymentMin]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/45"
      onClick={onClose}
    >
      <div
        className="ml-auto mr-auto mt-auto flex h-[min(82dvh,640px)] w-full max-w-[390px] flex-col rounded-t-[24px] bg-white shadow-[0_-12px_40px_rgba(20,27,33,0.18)] sm:mb-4 sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#eef3f7] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть фильтры"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f8fb] text-[#101214] transition hover:bg-[#eef3f7]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="flex-1 text-[18px] font-semibold tracking-[-0.02em] text-[#101214]">
            Фильтры
          </h2>
          <div className="h-9 w-9" aria-hidden />
        </div>

        {/* Body — scroll */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-3">
          {/* Район */}
          {districtOptions.length > 0 ? (
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-[#101214]">Район</h3>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraftDistrict("")}
                  className={cn(chipClassName, !draftDistrict ? chipActive : chipIdle)}
                >
                  Любой
                </button>
                {districtOptions.map((d) => {
                  const isActive = d.label === draftDistrict;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setDraftDistrict(isActive ? "" : d.label)}
                      className={cn(chipClassName, isActive ? chipActive : chipIdle)}
                    >
                      <span className="truncate">{d.label}</span>
                      <span className="ml-1.5 opacity-70">· {d.count}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Компания */}
          <section>
            <h3 className="mb-2 text-[14px] font-semibold text-[#101214]">Компания</h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDraftMarketplace("")}
                className={cn(chipClassName, !draftMarketplace ? chipActive : chipIdle)}
              >
                Любая
              </button>
              {MARKETPLACE_CODES.map((m) => {
                const isActive = m.value === draftMarketplace;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setDraftMarketplace(isActive ? "" : m.value)}
                    className={cn(chipClassName, isActive ? chipActive : chipIdle)}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Дата */}
          <section>
            <h3 className="mb-2 text-[14px] font-semibold text-[#101214]">Дата</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1.5">
                <span className="text-[12px] text-[#7f8791]">От</span>
                <input
                  type="date"
                  value={draftDateFrom}
                  onChange={(e) => setDraftDateFrom(e.target.value)}
                  className={fieldClassName}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[12px] text-[#7f8791]">До</span>
                <input
                  type="date"
                  value={draftDateTo}
                  onChange={(e) => setDraftDateTo(e.target.value)}
                  className={fieldClassName}
                />
              </label>
            </div>
          </section>

          {/* Оплата */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[14px] font-semibold text-[#101214]">Оплата, ₽</h3>
              {paymentSummary ? (
                <span className="text-[12px] text-[#7f8791]">{paymentSummary}</span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1.5">
                <span className="text-[12px] text-[#7f8791]">От</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={draftPaymentMin}
                  onChange={(e) => setDraftPaymentMin(e.target.value)}
                  className={fieldClassName}
                  placeholder="3000"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[12px] text-[#7f8791]">До</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={draftPaymentMax}
                  onChange={(e) => setDraftPaymentMax(e.target.value)}
                  className={fieldClassName}
                  placeholder="7000"
                />
              </label>
            </div>
          </section>

          {/* Срочность */}
          <section>
            <label className="flex items-center justify-between gap-3 rounded-[20px] bg-[#f4f8fb] px-4 py-3 text-[14px] font-medium text-[#101214]">
              <span>Только срочные смены</span>
              <span
                className={cn(
                  "relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors",
                  draftUrgentOnly ? "bg-[#3387d1]" : "bg-[#d7e2ec]",
                )}
              >
                <input
                  type="checkbox"
                  checked={draftUrgentOnly}
                  onChange={(e) => setDraftUrgentOnly(e.target.checked)}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Только срочные смены"
                />
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgba(20,27,33,0.18)] transition-transform",
                    draftUrgentOnly ? "translate-x-[22px]" : "translate-x-0.5",
                  )}
                />
              </span>
            </label>
          </section>
        </div>

        {/* Footer — sticky CTA */}
        <div className="border-t border-[#eef3f7] bg-white px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <div className="grid grid-cols-[0.82fr_1.18fr] gap-2">
            <Link
              href={resetHref}
              onClick={onClose}
              className="inline-flex h-12 min-w-0 items-center justify-center rounded-full border border-[#d0dae3] bg-[#e7eef5] px-4 text-[13px] font-semibold text-[#1c232b]"
            >
              Сбросить всё
            </Link>
            <button
              type="button"
              onClick={onApply}
              disabled={isPending}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-[#3387d1] px-5 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {isPending ? "Применяем..." : "Применить"}
            </button>
          </div>
          <button
            type="button"
            onClick={onSaveNotificationFilter}
            disabled={notificationSaving}
            className="mt-3 w-full rounded-[18px] border border-border bg-card px-4 py-3 text-[14px] font-semibold text-card-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {notificationSaving ? "Сохраняем..." : "Уведомлять по этим фильтрам"}
          </button>
          {notificationFeedback ? (
            <p className="mt-2 text-center text-[12px] leading-5 text-muted-foreground">
              {notificationFeedback}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
