"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Upload } from "lucide-react";

import type { ProfileUpdatedEventDetail } from "@/components/layout/app-session-context";
import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { getCachedResource } from "@/lib/client/reference-cache";
import { demoCities, demoRegions } from "@/lib/demo-data";
import type { AppRole, MarketplaceCode } from "@/lib/types";
import { isValidExperienceYears, normalizeExperienceYearsInput } from "@/lib/utils";

const MARKETPLACE_OPTIONS: Array<{ code: MarketplaceCode; label: string }> = [
  { code: "OZON", label: "Ozon" },
  { code: "WB", label: "Wildberries" },
  { code: "YANDEX", label: "Яндекс Маркет" },
];

type RegistrationMode = "onboarding" | "profile";
type UserRoleChoice = "OWNER" | "EMPLOYEE";

type RegionOption = {
  id: string;
  name: string;
};

type CityOption = {
  id: string;
  name: string;
  regionId: string;
};

type ProfilePayload = {
  profile?: {
    firstName: string;
    lastName: string | null;
    age?: number | null;
    photoUrl?: string | null;
    experienceSummary?: string | null;
    regionId?: string | null;
    cityId?: string | null;
    roles: string[];
    marketplaces: MarketplaceCode[];
  };
};

type RegistrationFormProps = {
  mode?: RegistrationMode;
};

type FormState = {
  firstName: string;
  lastName: string;
  age: string;
  regionId: string;
  cityId: string;
  role: UserRoleChoice;
  experienceSummary: string;
  photoUrl: string;
  marketplaces: MarketplaceCode[];
};

type FeedbackState =
  | { tone: "neutral" | "success" | "error"; text: string }
  | null;

const MIN_PROFILE_AGE = 16;
const MAX_PROFILE_AGE = 99;

const fieldClassName =
  "w-full rounded-[22px] border border-[#e1e6eb] bg-[#f8fbfd] px-4 py-3.5 text-[15px] text-[#101214] outline-none transition placeholder:text-[#a6abb2] focus:border-[#3387d1] focus:bg-white";

const hintClassName = "text-xs leading-5 text-[#7f8791]";

const fallbackRegions: RegionOption[] = [
  { id: "region_moscow", name: "Москва" },
  { id: "region_tatarstan", name: "Республика Татарстан" },
  { id: "region_spb", name: "Санкт-Петербург" },
];

const fallbackCities: CityOption[] = [
  { id: "city_moscow", name: "Москва", regionId: "region_moscow" },
  { id: "city_kazan", name: "Казань", regionId: "region_tatarstan" },
  { id: "city_spb", name: "Санкт-Петербург", regionId: "region_spb" },
];

function getInitialRole(roles: string[] | undefined): UserRoleChoice {
  if (roles?.includes("OWNER")) {
    return "OWNER";
  }

  return "EMPLOYEE";
}

function getSafeRegions() {
  return (demoRegions as RegionOption[])?.length ? (demoRegions as RegionOption[]) : fallbackRegions;
}

function getSafeCities() {
  return (demoCities as CityOption[])?.length ? (demoCities as CityOption[]) : fallbackCities;
}

export function RegistrationForm({ mode = "onboarding" }: RegistrationFormProps) {
  const router = useRouter();
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [allCities, setAllCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    age: "",
    regionId: "",
    cityId: "",
    role: "EMPLOYEE",
    experienceSummary: "",
    photoUrl: "",
    marketplaces: [],
  });

  useEffect(() => {
    let ignore = false;

    async function loadBootstrap() {
      setLoading(true);
      setFeedback(null);

      try {
        const [regionsPayload, citiesPayload] = await Promise.all([
          getCachedResource(
            "refs:regions",
            async () => {
              const response = await fetch("/api/regions", { cache: "force-cache" });
              return ((await response.json().catch(() => null)) as { regions?: RegionOption[] } | null) ?? {};
            },
            60 * 60_000,
          ),
          getCachedResource(
            "refs:cities:all",
            async () => {
              const response = await fetch("/api/cities", { cache: "force-cache" });
              return ((await response.json().catch(() => null)) as { cities?: CityOption[] } | null) ?? {};
            },
            60 * 60_000,
          ),
        ]);

        const nextRegions = regionsPayload?.regions?.length
          ? regionsPayload.regions
          : getSafeRegions();
        const nextCities = citiesPayload?.cities?.length ? citiesPayload.cities : getSafeCities();

        const profileRes = await fetchWithTelegramAuth("/api/profile?view=editor", {
          cache: "no-store",
        });
        const profilePayload = profileRes?.ok
          ? (((await profileRes.json().catch(() => null)) as ProfilePayload | null) ?? null)
          : null;
        const profile = profilePayload?.profile;

        if (ignore) {
          return;
        }

        const cityFromProfile = nextCities.find((city) => city.id === profile?.cityId);
        const resolvedRegionId =
          nextRegions.some((region) => region.id === profile?.regionId)
            ? (profile?.regionId ?? "")
            : (cityFromProfile?.regionId ?? nextRegions[0]?.id ?? "");
        const citiesForResolvedRegion = nextCities.filter(
          (city) => city.regionId === resolvedRegionId,
        );
        const resolvedCityId =
          citiesForResolvedRegion.find((city) => city.id === profile?.cityId)?.id ??
          citiesForResolvedRegion[0]?.id ??
          nextCities[0]?.id ??
          "";

        setRegions(nextRegions);
        setAllCities(nextCities);
        setForm({
          firstName: profile?.firstName ?? "",
          lastName: profile?.lastName ?? "",
          age: profile?.age ? String(profile.age) : "",
          regionId: resolvedRegionId,
          cityId: resolvedCityId,
          role: getInitialRole(profile?.roles),
          experienceSummary: normalizeExperienceYearsInput(profile?.experienceSummary),
          photoUrl: profile?.photoUrl ?? "",
          marketplaces: profile?.marketplaces ?? [],
        });

        if (!profileRes.ok) {
          setFeedback({
            tone: "neutral",
            text: "Для регистрации сейчас доступны Москва, Казань и Санкт-Петербург.",
          });
        }
      } catch {
        if (ignore) {
          return;
        }

        const safeRegions = getSafeRegions();
        const safeCities = getSafeCities();
        setRegions(safeRegions);
        setAllCities(safeCities);
        setForm((current) => ({
          ...current,
          regionId: current.regionId || safeRegions[0]?.id || "",
          cityId: current.cityId || safeCities[0]?.id || "",
        }));
        setFeedback({
          tone: "neutral",
          text: "Показал базовые города для регистрации: Москва, Казань и Санкт-Петербург.",
        });
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadBootstrap();

    return () => {
      ignore = true;
    };
  }, []);

  const cities = useMemo(
    () => allCities.filter((city) => city.regionId === form.regionId),
    [allCities, form.regionId],
  );

  const selectedCityId = cities.find((city) => city.id === form.cityId)?.id ?? cities[0]?.id ?? "";

  const canSubmit = useMemo(() => {
    const hasBaseFields =
      form.firstName.trim().length >= 2 &&
      form.lastName.trim().length >= 2 &&
      Number(form.age) >= MIN_PROFILE_AGE &&
      Number(form.age) <= MAX_PROFILE_AGE &&
      Boolean(form.regionId) &&
      Boolean(selectedCityId);

    if (!hasBaseFields) {
      return false;
    }

    if (form.role === "OWNER") {
      // Для владельца обязательно отметить хотя бы один маркетплейс
      // («какие ПВЗ он имеет»).
      return form.marketplaces.length > 0;
    }

    return isValidExperienceYears(form.experienceSummary);
  }, [form, selectedCityId]);

  function handleExperienceChange(value: string) {
    const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");

    if (!normalized || /^(?:0|[1-9]\d*)(?:\.5?)?$/.test(normalized)) {
      setForm((current) => ({
        ...current,
        experienceSummary: normalized,
      }));
    }
  }

  function sanitizePersonName(value: string) {
    return value.replace(/\d+/g, "");
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Очищаем input сразу — иначе повторный выбор того же файла после ошибки
    // не вызывает onChange.
    event.target.value = "";

    if (!file) {
      return;
    }

    // Тип проверяем по реальному `file.type` от браузера — `accept`-атрибут
    // в input'е не гарантия, его легко обойти. JPEG / PNG / WebP — то же,
    // что принимает серверный profileSchema. SVG исключён намеренно.
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setFeedback({
        tone: "error",
        text: "Для аватарки подойдут только JPEG, PNG или WebP.",
      });
      return;
    }

    // 2 МБ финального бинаря; в base64 на ~33% больше, поэтому со стороны
    // строки лимит будет ~2.7 МБ — сходится с серверной проверкой 2_800_000.
    const MAX_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setFeedback({
        tone: "error",
        text: "Выберите фото меньше 2 МБ — это требование сервера.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((current) => ({ ...current, photoUrl: result }));
      setFeedback(null);
    };
    reader.onerror = () =>
      setFeedback({
        tone: "error",
        text: "Не удалось прочитать изображение.",
      });
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    setSaving(true);
    setFeedback(null);

    try {
        const roles: AppRole[] = form.role === "OWNER" ? ["OWNER"] : ["EMPLOYEE"];
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        age: Number(form.age),
        username: null,
        bio: null,
        district: null,
        regionId: form.regionId,
        cityId: selectedCityId,
        roles,
        // Для OWNER — список маркетплейсов, ПВЗ которых у него есть.
        // Для EMPLOYEE — где он готов работать. Структура одинаковая.
        marketplaces: form.marketplaces,
        photoUrl: form.photoUrl,
        // Поле остаётся в БД для будущей верификации, в форме его сейчас нет.
        pickupPointCode: null,
        experienceSummary: form.role === "EMPLOYEE" ? form.experienceSummary.trim() : null,
      };

      const safeResponse = await fetchWithTelegramAuth("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await safeResponse.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!safeResponse.ok) {
        setFeedback({
          tone: "error",
          text:
            safeResponse.status === 401
              ? "Не удалось автоматически подтвердить Telegram-сессию. Откройте Mini App из бота ещё раз."
              : (result?.error ?? result?.message ?? "Не удалось сохранить профиль."),
        });
        return;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent<ProfileUpdatedEventDetail>("profile:updated", {
            detail: { onboardingCompleted: true, roles },
          }),
        );
      }

      if (mode === "onboarding") {
        router.refresh();
        router.replace("/home");
        return;
      }

      setFeedback({ tone: "success", text: "Профиль сохранён." });
      router.refresh();
    } catch {
      setFeedback({
        tone: "error",
        text: "Сервис профиля временно недоступен. Попробуйте ещё раз.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="rounded-[30px] bg-white p-5"
      style={{ fontFamily: '"Wix Madefor Display", var(--font-plex-sans), sans-serif' }}
    >
      <div className="mb-5 space-y-2">
        <h2 className="text-[21px] font-semibold tracking-[-0.03em] text-[#101214]">
          {mode === "onboarding" ? "Регистрация" : "Данные профиля"}
        </h2>
        <p className="text-[14px] leading-6 text-[#7f8791]">
          {mode === "onboarding"
            ? "Заполним профиль за минуту: после этого сразу откроется лента смен."
            : "Эти данные увидят другие участники после подтверждения смены. Чем аккуратнее профиль, тем выше доверие."}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-[24px] bg-[#f8fbfd] px-4 py-4 text-sm text-[#7f8791]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Загружаем форму...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
              <span>Имя</span>
              <input
                value={form.firstName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    firstName: sanitizePersonName(event.target.value),
                  }))
                }
                className={fieldClassName}
                placeholder="Иван"
              />
            </label>

            <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
              <span>Фамилия</span>
              <input
                value={form.lastName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastName: sanitizePersonName(event.target.value),
                  }))
                }
                className={fieldClassName}
                placeholder="Иванов"
              />
            </label>
          </div>

          <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
            <span>Возраст</span>
            <input
              type="number"
              min={MIN_PROFILE_AGE}
              max={MAX_PROFILE_AGE}
              value={form.age}
              onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
              className={fieldClassName}
              placeholder="Например, 24"
            />
            <span className={hintClassName}>Возраст должен быть от 16 до 99 лет.</span>
          </label>

          <div className="grid gap-2 text-[14px] font-medium text-[#101214]">
            <span>Кто вы?</span>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, role: "OWNER" }))}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  form.role === "OWNER"
                    ? "border-[#3387d1] bg-[#3387d1] text-white"
                    : "border-[#e1e6eb] bg-[#f8fbfd] text-[#101214]"
                }`}
              >
                <div className="text-[14px] font-semibold">Я владелец</div>
                <p
                  className={`mt-1 text-xs leading-5 ${
                    form.role === "OWNER" ? "text-white/85" : "text-[#7f8791]"
                  }`}
                >
                  Публикую смены и выбираю исполнителей.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, role: "EMPLOYEE" }))}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  form.role === "EMPLOYEE"
                    ? "border-[#3387d1] bg-[#3387d1] text-white"
                    : "border-[#e1e6eb] bg-[#f8fbfd] text-[#101214]"
                }`}
              >
                <div className="text-[14px] font-semibold">Я сотрудник</div>
                <p
                  className={`mt-1 text-xs leading-5 ${
                    form.role === "EMPLOYEE" ? "text-white/85" : "text-[#7f8791]"
                  }`}
                >
                  Ищу смены, подработку и постоянную работу.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
              <span>Регион</span>
              <select
                value={form.regionId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    regionId: event.target.value,
                    cityId: "",
                  }))
                }
                className={fieldClassName}
              >
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
              <span>Город</span>
              <select
                value={selectedCityId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cityId: event.target.value }))
                }
                className={fieldClassName}
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {form.role === "EMPLOYEE" ? (
            <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
              <span>Опыт работы</span>
              <input
                inputMode="decimal"
                value={form.experienceSummary}
                onChange={(event) => handleExperienceChange(event.target.value)}
                className={fieldClassName}
                placeholder="Например: 1.5"
              />
              <span className={hintClassName}>
                Укажите опыт только в годах. Допустимы значения <b>0.5</b>, <b>1</b>, <b>1.5</b>,{" "}
                <b>2</b>, <b>2.5</b>.
              </span>
            </label>
          ) : null}

          <div className="grid gap-2 text-[14px] font-medium text-[#101214]">
            <span>{form.role === "OWNER" ? "Какие ПВЗ у вас есть" : "Где могу работать"}</span>
            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
              {MARKETPLACE_OPTIONS.map((option) => {
                const active = form.marketplaces.includes(option.code);
                return (
                  <button
                    key={option.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        marketplaces: active
                          ? current.marketplaces.filter((code) => code !== option.code)
                          : [...current.marketplaces, option.code],
                      }))
                    }
                    className={`rounded-[20px] border px-3 py-3 text-[14px] transition ${
                      active
                        ? "border-[#3387d1] bg-[#3387d1] text-white"
                        : "border-[#e1e6eb] bg-[#f8fbfd] text-[#101214]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <span className={hintClassName}>
              {form.role === "OWNER"
                ? "Отметьте маркетплейсы, ПВЗ которых вы держите."
                : "Отметьте маркетплейсы, в ПВЗ которых вы готовы выходить на смену."}
            </span>
          </div>

          <div className="grid gap-3">
            <span className="text-[14px] font-medium text-[#101214]">Аватарка профиля</span>
            <label className="flex cursor-pointer items-center gap-4 rounded-[26px] border border-dashed border-[#d7dfe7] bg-[#f8fbfd] p-4 transition hover:border-[#3387d1]">
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-[#e7edf3]">
                {form.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.photoUrl}
                    alt="Аватар профиля"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-6 w-6 text-[#7f8791]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[14px] font-medium text-[#101214]">
                  <Upload className="h-4 w-4" />
                  {form.photoUrl ? "Заменить фото" : "Добавить фото"}
                </div>
                <p className="mt-1 text-xs leading-5 text-[#7f8791]">
                  Фото будет видно в вашем профиле. Лучше использовать живой портрет без лишнего фона.
                </p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>
          </div>

          <button
            type="button"
            disabled={!canSubmit || saving}
            onClick={handleSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-[#3387d1] px-5 py-4 text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {mode === "onboarding" ? "Завершить регистрацию" : "Сохранить профиль"}
          </button>

          {feedback ? (
            <p
              className={`text-[14px] ${
                feedback.tone === "error"
                  ? "text-[#b35b54]"
                  : feedback.tone === "success"
                    ? "text-[#2f7a53]"
                    : "text-[#7f8791]"
              }`}
            >
              {feedback.text}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
