"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MapPin } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { getCachedResource } from "@/lib/client/reference-cache";
import { EXPERIENCE_LEVELS, SHIFT_POST_TYPES } from "@/lib/constants";
import { isManagerRole } from "@/lib/profile-completion";
import type { AppRole } from "@/lib/types";
import { getTodayDateValue } from "@/lib/utils";

type RegionOption = {
  id: string;
  name: string;
};

type CityOption = {
  id: string;
  name: string;
  regionId: string;
};

type MarketplaceOption = {
  id: string;
  code: string;
  name: string;
};

type PickupPointOption = {
  id: string;
  title: string;
  regionId: string;
  cityId: string;
  district: string | null;
  address: string;
  landmark: string | null;
  marketplaceId: string;
  city: { name: string };
  marketplace: { name: string };
};

type ProfilePayload = {
  profile?: {
    cityId?: string;
    regionId?: string;
    roles?: AppRole[];
  };
};

type AddressSuggestionOption = {
  title: string;
  subtitle: string | null;
  formattedAddress: string;
  district: string | null;
  city: string | null;
  street: string | null;
  house: string | null;
  uri: string | null;
  tags: string[];
};

type AddressVerifyPayload = {
  verified?: {
    formattedAddress: string;
    district: string;
    city: string | null;
    street: string | null;
    house: string | null;
    precision: string | null;
  };
  error?: string;
};

type ShiftFormState = {
  pickupPointId: string;
  title: string;
  type: string;
  marketplaceId: string;
  regionId: string;
  cityId: string;
  district: string;
  address: string;
  addressSuggestionUri: string;
  landmark: string;
  description: string;
  shiftDate: string;
  startAt: string;
  endAt: string;
  paymentAmountRub: string;
  paymentType: string;
  experienceLevelRequired: string;
  isUrgent: boolean;
};

const initialForm: ShiftFormState = {
  pickupPointId: "",
  title: "",
  type: "URGENT_REPLACEMENT",
  marketplaceId: "",
  regionId: "",
  cityId: "",
  district: "",
  address: "",
  addressSuggestionUri: "",
  landmark: "",
  description: "",
  shiftDate: "",
  startAt: "",
  endAt: "",
  paymentAmountRub: "4500",
  paymentType: "FIXED_SHIFT",
  experienceLevelRequired: "LESS_THAN_3_MONTHS",
  isUrgent: true,
};

const fieldClassName =
  "min-w-0 w-full rounded-[22px] border border-[#e1e6eb] bg-[#f8fbfd] px-4 py-3.5 text-[15px] text-[#101214] outline-none transition placeholder:text-[#a6abb2] focus:border-[#3387d1] focus:bg-white";

function resetAddressFields(current: ShiftFormState) {
  return {
    ...current,
    district: "",
    address: "",
    addressSuggestionUri: "",
  };
}

function applyPickupPointToForm(current: ShiftFormState, pickupPoint: PickupPointOption) {
  return {
    ...current,
    pickupPointId: pickupPoint.id,
    marketplaceId: pickupPoint.marketplaceId,
    regionId: pickupPoint.regionId,
    cityId: pickupPoint.cityId,
    district: pickupPoint.district ?? "",
    address: pickupPoint.address,
    addressSuggestionUri: `pickup-point:${pickupPoint.id}`,
    landmark: pickupPoint.landmark ?? "",
  };
}

export function CreateShiftForm() {
  const todayDate = getTodayDateValue();
  const didLoadReferencesRef = useRef(false);
  const [form, setForm] = useState<ShiftFormState>(initialForm);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [marketplaces, setMarketplaces] = useState<MarketplaceOption[]>([]);
  const [pickupPoints, setPickupPoints] = useState<PickupPointOption[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestionOption[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [verifyingAddress, setVerifyingAddress] = useState(false);

  const managerMode = isManagerRole(roles);
  const selectedPickupPoint =
    pickupPoints.find((pickupPoint) => pickupPoint.id === form.pickupPointId) ?? null;

  useEffect(() => {
    if (didLoadReferencesRef.current) {
      return;
    }

    didLoadReferencesRef.current = true;

    async function loadReferences() {
      setLoadingRefs(true);

      try {
        const [regionsPayload, marketplacesPayload, profileRes, pickupPointsRes] = await Promise.all([
          getCachedResource(
            "refs:regions",
            async () => {
              const response = await fetch("/api/regions", { cache: "force-cache" });
              return ((await response.json().catch(() => null)) as { regions?: RegionOption[] } | null) ?? {};
            },
            60 * 60_000,
          ),
          getCachedResource(
            "refs:marketplaces",
            async () => {
              const response = await fetch("/api/marketplaces", { cache: "force-cache" });
              return (
                ((await response.json().catch(() => null)) as {
                  marketplaces?: MarketplaceOption[];
                } | null) ?? {}
              );
            },
            60 * 60_000,
          ),
          fetchWithTelegramAuth("/api/profile?view=location", { cache: "no-store" }),
          fetchWithTelegramAuth("/api/pickup-points", { cache: "no-store" }),
        ]);
        const profilePayload = profileRes.ok
          ? ((await profileRes.json()) as ProfilePayload)
          : null;
        const pickupPointsPayload = pickupPointsRes.ok
          ? (((await pickupPointsRes.json().catch(() => null)) as {
              pickupPoints?: PickupPointOption[];
            } | null) ?? null)
          : null;

        const nextRegions = regionsPayload.regions ?? [];
        const nextMarketplaces = marketplacesPayload.marketplaces ?? [];
        const nextPickupPoints = pickupPointsPayload?.pickupPoints ?? [];
        const nextRoles = profilePayload?.profile?.roles ?? [];
        const preferredRegionId = profilePayload?.profile?.regionId ?? nextRegions[0]?.id ?? "";
        const firstPickupPoint = nextPickupPoints[0] ?? null;

        setRegions(nextRegions);
        setMarketplaces(nextMarketplaces);
        setPickupPoints(nextPickupPoints);
        setRoles(nextRoles);
        setForm((current) => {
          const baseState = {
            ...current,
            regionId: preferredRegionId,
            cityId: profilePayload?.profile?.cityId ?? current.cityId,
            marketplaceId: current.marketplaceId || nextMarketplaces[0]?.id || "",
          };

          if (firstPickupPoint && nextRoles.includes("MANAGER")) {
            return applyPickupPointToForm(baseState, firstPickupPoint);
          }

          return baseState;
        });
      } catch {
        setMessage("Не удалось загрузить регионы, города, маркетплейсы и ПВЗ.");
      } finally {
        setLoadingRefs(false);
      }
    }

    void loadReferences();
  }, []);

  useEffect(() => {
    async function loadCities() {
      if (!form.regionId) {
        setCities([]);
        return;
      }

      try {
        const payload = await getCachedResource(
          `refs:cities:${form.regionId}`,
          async () => {
            const response = await fetch(`/api/cities?regionId=${form.regionId}`, {
              cache: "force-cache",
            });
            return ((await response.json().catch(() => null)) as { cities?: CityOption[] } | null) ?? {};
          },
          60 * 60_000,
        );
        const nextCities = payload.cities ?? [];

        setCities(nextCities);
        setForm((current) => {
          const nextCityId =
            nextCities.find((city) => city.id === current.cityId)?.id ?? nextCities[0]?.id ?? "";

          if (managerMode) {
            return {
              ...current,
              cityId: nextCityId,
            };
          }

          return {
            ...resetAddressFields(current),
            cityId: nextCityId,
          };
        });
      } catch {
        setCities([]);
      }
    }

    void loadCities();
  }, [form.regionId, managerMode]);

  useEffect(() => {
    const query = form.address.trim();

    if (managerMode || !form.cityId || query.length < 3 || form.addressSuggestionUri) {
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setAddressLoading(true);
      setAddressError(null);

      try {
        const sessionToken = crypto.randomUUID();
        const response = await fetchWithTelegramAuth(
          `/api/address-suggestions?cityId=${encodeURIComponent(form.cityId)}&q=${encodeURIComponent(query)}&sessionToken=${encodeURIComponent(sessionToken)}`,
          {
            cache: "no-store",
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | { suggestions?: AddressSuggestionOption[]; error?: string }
          | null;

        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          setAddressSuggestions([]);
          setAddressError(payload?.error ?? "Не удалось загрузить подсказки адреса.");
          return;
        }

        setAddressSuggestions(payload?.suggestions ?? []);
      } catch {
        if (!isCancelled) {
          setAddressSuggestions([]);
          setAddressError("Не удалось загрузить подсказки адреса.");
        }
      } finally {
        if (!isCancelled) {
          setAddressLoading(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [form.address, form.addressSuggestionUri, form.cityId, managerMode]);

  const isPaymentValid = useMemo(() => {
    if (!form.paymentAmountRub.trim()) {
      return false;
    }

    return Number(form.paymentAmountRub) > 0;
  }, [form.paymentAmountRub]);

  const isReady = useMemo(() => {
    if (managerMode) {
      return Boolean(form.pickupPointId && form.marketplaceId && form.cityId && form.regionId);
    }

    return Boolean(form.regionId && form.cityId && form.marketplaceId && form.addressSuggestionUri);
  }, [form, managerMode]);

  async function handleSelectSuggestion(suggestion: AddressSuggestionOption) {
    setVerifyingAddress(true);
    setAddressLoading(false);
    setAddressError(null);

    try {
      const response = await fetchWithTelegramAuth("/api/address-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cityId: form.cityId,
          query: suggestion.formattedAddress,
          uri: suggestion.uri,
        }),
      });

      const payload = (await response.json().catch(() => null)) as AddressVerifyPayload | null;

      if (!response.ok || !payload?.verified) {
        setAddressError(payload?.error ?? "Не удалось подтвердить адрес.");
        return;
      }

      setForm((current) => ({
        ...current,
        address: payload.verified?.formattedAddress ?? suggestion.formattedAddress,
        district: payload.verified?.district ?? "",
        addressSuggestionUri: suggestion.uri ?? suggestion.formattedAddress,
      }));
      setAddressSuggestions([]);
    } catch {
      setAddressError("Не удалось подтвердить адрес.");
    } finally {
      setVerifyingAddress(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!managerMode && !form.addressSuggestionUri) {
      setMessage(
        "Выберите адрес из подсказок, чтобы сохранить существующий район и улицу.",
      );
      return;
    }

    if (managerMode && !form.pickupPointId) {
      setMessage("Выберите доступный ПВЗ.");
      return;
    }

    if (!form.paymentAmountRub.trim()) {
      setMessage("Укажите оплату в рублях.");
      return;
    }

    if (Number(form.paymentAmountRub) <= 0) {
      setMessage("Оплата должна быть больше 0 ₽.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetchWithTelegramAuth("/api/shift-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          paymentAmountRub: form.paymentAmountRub,
          description: form.description.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "Не удалось создать объявление.");
        return;
      }

      setMessage("Объявление сохранено. Для не срочных постов возможна ручная модерация.");
      setForm((current) => {
        const nextState = {
          ...initialForm,
          regionId: current.regionId,
          cityId: current.cityId,
          marketplaceId: current.marketplaceId,
          pickupPointId: current.pickupPointId,
        };

        return managerMode && selectedPickupPoint
          ? applyPickupPointToForm(nextState, selectedPickupPoint)
          : nextState;
      });
      setAddressSuggestions([]);
      setAddressError(null);
    } catch {
      setMessage("Сеть недоступна. Проверьте локальный запуск API.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[32px] bg-white p-5 shadow-[0_12px_28px_rgba(20,27,33,0.08)]"
    >
      {loadingRefs ? (
        <div className="flex items-center gap-2 rounded-[22px] bg-[#f8fbfd] px-4 py-3 text-[14px] text-[#7f8791]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Загружаем регионы, города, маркетплейсы и ПВЗ...
        </div>
      ) : null}

      {managerMode && !loadingRefs && pickupPoints.length === 0 ? (
        <div className="rounded-[22px] border border-[#f1d8b5] bg-[#fff7ea] px-4 py-3 text-[14px] text-[#8a6420]">
          Пока нет доступных ПВЗ. Владелец должен назначить вас управляющим хотя бы для одной точки.
        </div>
      ) : null}

      <div className="grid gap-4">
        {pickupPoints.length > 0 ? (
          <label className="grid min-w-0 gap-2 text-[14px] font-medium text-[#101214]">
            <span>{managerMode ? "Доступный ПВЗ" : "ПВЗ для смены"}</span>
            <select
              value={form.pickupPointId}
              onChange={(event) => {
                const pickupPoint = pickupPoints.find((item) => item.id === event.target.value);

                if (!pickupPoint) {
                  setForm((current) => ({
                    ...current,
                    pickupPointId: "",
                    district: "",
                    address: "",
                    addressSuggestionUri: "",
                    landmark: "",
                  }));
                  return;
                }

                setAddressError(null);
                setAddressSuggestions([]);
                setForm((current) => applyPickupPointToForm(current, pickupPoint));
              }}
              className={fieldClassName}
            >
              {!managerMode ? <option value="">Без привязки к ПВЗ</option> : null}
              {pickupPoints.map((pickupPoint) => (
                <option key={pickupPoint.id} value={pickupPoint.id}>
                  {pickupPoint.title} · {pickupPoint.city.name} · {pickupPoint.marketplace.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
          <span>Заголовок</span>
          <input
            required
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            className={fieldClassName}
            placeholder="Например: срочно нужен сотрудник на вечер"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-[14px] font-medium text-[#101214]">
            <span>Тип объявления</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,
                  type: event.target.value,
                  isUrgent: event.target.value === "URGENT_REPLACEMENT",
                })
              }
              className={fieldClassName}
            >
              {SHIFT_POST_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-2 text-[14px] font-medium text-[#101214]">
            <span>Маркетплейс</span>
            <select
              value={form.marketplaceId}
              onChange={(event) => setForm({ ...form, marketplaceId: event.target.value })}
              className={fieldClassName}
              disabled={Boolean(selectedPickupPoint)}
            >
              {marketplaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-[14px] font-medium text-[#101214]">
            <span>Регион</span>
            <select
              value={form.regionId}
              onChange={(event) => {
                if (managerMode) {
                  return;
                }

                setAddressError(null);
                setAddressSuggestions([]);
                setForm((current) => ({
                  ...resetAddressFields(current),
                  regionId: event.target.value,
                  cityId: "",
                  pickupPointId: "",
                }));
              }}
              className={fieldClassName}
              disabled={managerMode || Boolean(selectedPickupPoint)}
            >
              {regions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-2 text-[14px] font-medium text-[#101214]">
            <span>Город</span>
            <select
              value={form.cityId}
              onChange={(event) => {
                if (managerMode) {
                  return;
                }

                setAddressError(null);
                setAddressSuggestions([]);
                setForm((current) => ({
                  ...resetAddressFields(current),
                  cityId: event.target.value,
                  pickupPointId: "",
                }));
              }}
              className={fieldClassName}
              disabled={managerMode || Boolean(selectedPickupPoint)}
            >
              {cities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
          <span>Район</span>
          <input
            readOnly
            value={form.district}
            className={fieldClassName}
            placeholder="Определится автоматически после выбора адреса"
          />
          <span className="text-xs leading-5 text-[#7f8791]">
            Район подтянется из геокодера после выбора существующего адреса.
          </span>
        </label>

        <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
          <span>Адрес</span>
          <div className="relative">
            <input
              required
              autoComplete="off"
              value={form.address}
              readOnly={managerMode || Boolean(selectedPickupPoint)}
              onChange={(event) => {
                setAddressError(null);
                setAddressSuggestions([]);
                setForm((current) => ({
                  ...current,
                  pickupPointId: "",
                  address: event.target.value,
                  district: "",
                  addressSuggestionUri: "",
                }));
              }}
              className={fieldClassName}
              placeholder="Начните вводить улицу или дом"
            />

            {addressLoading || verifyingAddress ? (
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7f8791]">
                <LoaderCircle className="h-4 w-4 animate-spin" />
              </div>
            ) : null}

            {!managerMode && !selectedPickupPoint && addressSuggestions.length ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[28px] border border-[#e1e6eb] bg-white shadow-[0_20px_60px_rgba(20,27,33,0.18)]">
                {addressSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.uri ?? suggestion.formattedAddress}-${suggestion.title}`}
                    type="button"
                    onClick={() => void handleSelectSuggestion(suggestion)}
                    className="flex w-full items-start gap-3 border-b border-[#eef3f7] px-4 py-3 text-left last:border-b-0"
                  >
                    <span className="mt-0.5 rounded-full bg-[#f2f5f8] p-2 text-[#3387d1]">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium text-[#101214]">
                        {suggestion.title}
                      </span>
                      <span className="block text-[12px] text-[#7f8791]">
                        {suggestion.formattedAddress}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {selectedPickupPoint ? (
            <span className="text-xs leading-5 text-[#7f8791]">
              Адрес взят из выбранного ПВЗ и используется для ограничения доступа управляющего.
            </span>
          ) : (
            <span className="text-xs leading-5 text-[#7f8791]">
              Можно выбрать только существующий адрес из подсказок.
            </span>
          )}
          {!managerMode &&
          !selectedPickupPoint &&
          !addressLoading &&
          !verifyingAddress &&
          form.address.trim().length >= 3 &&
          !form.addressSuggestionUri &&
          !addressSuggestions.length &&
          !addressError ? (
            <span className="text-xs leading-5 text-[#7f8791]">
              По этому запросу ничего не найдено. Попробуйте уточнить улицу или номер дома.
            </span>
          ) : null}
          {addressError ? (
            <span className="text-xs leading-5 text-[#b8752b]">{addressError}</span>
          ) : null}
        </label>

        <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 min-[440px]:items-start">
          <label className="grid min-w-0 gap-2 self-start text-[14px] font-medium text-[#101214]">
            <span>Дата смены</span>
            <input
              type="date"
              required
              min={todayDate}
              value={form.shiftDate}
              onChange={(event) => setForm({ ...form, shiftDate: event.target.value })}
              className={fieldClassName}
            />
          </label>

          <label className="grid min-w-0 gap-2 self-start text-[14px] font-medium text-[#101214]">
            <span>Оплата, ₽</span>
            <input
              type="number"
              required
              min={1}
              inputMode="numeric"
              value={form.paymentAmountRub}
              onChange={(event) => setForm({ ...form, paymentAmountRub: event.target.value })}
              className={fieldClassName}
              placeholder="4500"
            />
            <span className="text-xs leading-5 text-[#7f8791]">
              Поле нельзя оставлять пустым, сумма должна быть больше 0 ₽.
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-[14px] font-medium text-[#101214]">
            <span>Начало смены</span>
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(event) => setForm({ ...form, startAt: event.target.value })}
              className={fieldClassName}
            />
          </label>

          <label className="grid min-w-0 gap-2 text-[14px] font-medium text-[#101214]">
            <span>Конец смены</span>
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(event) => setForm({ ...form, endAt: event.target.value })}
              className={fieldClassName}
            />
          </label>
        </div>

        <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
          <span>Ориентир</span>
          <input
            value={form.landmark}
            readOnly={managerMode || Boolean(selectedPickupPoint)}
            onChange={(event) => setForm({ ...form, landmark: event.target.value })}
            className={fieldClassName}
            placeholder="Например: рядом с метро, ТЦ, ЖК"
          />
        </label>

        <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
          <span>Опыт</span>
          <select
            value={form.experienceLevelRequired}
            onChange={(event) => setForm({ ...form, experienceLevelRequired: event.target.value })}
            className={fieldClassName}
          >
            {EXPERIENCE_LEVELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
          <span>Комментарий</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className={fieldClassName}
            placeholder="Необязательно. Можно указать важные детали по смене."
          />
          <span className="text-xs leading-5 text-[#7f8791]">Поле необязательное.</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={
          submitting ||
          verifyingAddress ||
          !isReady ||
          !isPaymentValid ||
          (managerMode && pickupPoints.length === 0)
        }
        className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-[#3387d1] px-5 py-4 text-[14px] font-semibold text-white disabled:opacity-60"
      >
        {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        Опубликовать объявление
      </button>

      {message ? <p className="text-[14px] text-[#7f8791]">{message}</p> : null}
    </form>
  );
}
