"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, ChevronDown, LoaderCircle, Upload } from "lucide-react";

import type { ProfileUpdatedEventDetail } from "@/components/layout/app-session-context";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { getCachedResource } from "@/lib/client/reference-cache";
import { demoCities, demoRegions } from "@/lib/demo-data";
import { CONSENT_TEXT, type ConsentPurpose } from "@/lib/legal-consents";
import {
  TELEGRAM_PLATFORM_PREFIX,
  getPlatformPrefixFromPathname,
  withPlatformPrefix,
} from "@/lib/routing/platform";
import type { AppRole, MarketplaceCode, VerificationStatus } from "@/lib/types";
import { isValidExperienceYears, normalizeExperienceYearsInput } from "@/lib/utils";

const MARKETPLACE_OPTIONS: Array<{ code: MarketplaceCode; label: string }> = [
  { code: "OZON", label: "Ozon" },
  { code: "WB", label: "Wildberries" },
  { code: "YANDEX", label: "Яндекс Маркет" },
];

type RegistrationMode = "onboarding" | "profile";
type UserRoleChoice = "OWNER" | "EMPLOYEE";
type LegalDocument = "privacy" | "offer";

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
    employerVerificationStatus?: VerificationStatus | null;
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

type ConsentState = Record<ConsentPurpose, boolean>;

const EMPTY_CONSENTS: ConsentState = {
  PERSONAL_DATA_PROCESSING: false,
  PHONE_PROCESSING: false,
  EMPLOYER_DOCUMENT_PROCESSING: false,
  PUBLIC_PROFILE_DISTRIBUTION: false,
};

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

function getEmployerVerificationLabel(status: VerificationStatus | null) {
  switch (status) {
    case "APPROVED":
      return "Документ работодателя подтвержден";
    case "PENDING":
      return "Документ работодателя на проверке";
    case "REJECTED":
      return "Документ работодателя отклонен";
    case "EXPIRED":
      return "Нужен новый документ работодателя";
    default:
      return "Документ работодателя не отправлен";
  }
}

export function RegistrationForm({ mode = "onboarding" }: RegistrationFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const platformPrefix = getPlatformPrefixFromPathname(pathname);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [allCities, setAllCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [employerDocument, setEmployerDocument] = useState<File | null>(null);
  const [employerVerificationStatus, setEmployerVerificationStatus] =
    useState<VerificationStatus | null>(null);
  const [consents, setConsents] = useState<ConsentState>(EMPTY_CONSENTS);
  const [profileConsentChecked, setProfileConsentChecked] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [documentConsentChecked, setDocumentConsentChecked] = useState(false);
  const [shareProfileChecked, setShareProfileChecked] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
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
              const response = await fetchWithTelegramAuth("/api/regions", { cache: "force-cache" });
              return ((await response.json().catch(() => null)) as { regions?: RegionOption[] } | null) ?? {};
            },
            60 * 60_000,
          ),
          getCachedResource(
            "refs:cities:all",
            async () => {
              const response = await fetchWithTelegramAuth("/api/cities", { cache: "force-cache" });
              return ((await response.json().catch(() => null)) as { cities?: CityOption[] } | null) ?? {};
            },
            60 * 60_000,
          ),
        ]);

        const nextRegions = regionsPayload?.regions?.length
          ? regionsPayload.regions
          : getSafeRegions();
        const nextCities = citiesPayload?.cities?.length ? citiesPayload.cities : getSafeCities();

        const [profileRes, legalRes] = await Promise.all([
          fetchWithTelegramAuth("/api/profile?view=editor", { cache: "no-store" }),
          fetchWithTelegramAuth("/api/legal-events", { cache: "no-store" }),
        ]);
        const profilePayload = profileRes?.ok
          ? (((await profileRes.json().catch(() => null)) as ProfilePayload | null) ?? null)
          : null;
        const profile = profilePayload?.profile;
        const legalPayload = legalRes.ok
          ? (((await legalRes.json().catch(() => null)) as { consents?: ConsentState } | null) ??
            null)
          : null;

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
        setEmployerVerificationStatus(profile?.employerVerificationStatus ?? null);
        const loadedConsents = legalPayload?.consents ?? EMPTY_CONSENTS;
        setConsents(loadedConsents);
        setShareProfileChecked(loadedConsents.PUBLIC_PROFILE_DISTRIBUTION);

        if (!profileRes.ok) {
          setFeedback({
            tone: "neutral",
            text: "Не удалось подтянуть текущий профиль — заполните регистрацию заново.",
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
          text: "Не удалось загрузить полный список регионов — показал базовый набор.",
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
    const hasCommonFields =
      form.firstName.trim().length >= 2 &&
      form.lastName.trim().length >= 2 &&
      Number(form.age) >= MIN_PROFILE_AGE &&
      Number(form.age) <= MAX_PROFILE_AGE &&
      Boolean(form.regionId);

    if (!hasCommonFields) {
      return false;
    }

    if (!consents.PERSONAL_DATA_PROCESSING && !profileConsentChecked) {
      return false;
    }

    if (mode === "onboarding" && !offerAccepted) {
      return false;
    }

    if (mode === "onboarding" && !shareProfileChecked) {
      return false;
    }

    if (
      form.role === "OWNER" &&
      employerDocument &&
      !consents.EMPLOYER_DOCUMENT_PROCESSING &&
      !documentConsentChecked
    ) {
      return false;
    }

    if (form.role === "OWNER") {
      return Boolean(selectedCityId) && form.marketplaces.length > 0;
    }

    return Boolean(selectedCityId) && isValidExperienceYears(form.experienceSummary);
  }, [
    consents.EMPLOYER_DOCUMENT_PROCESSING,
    consents.PERSONAL_DATA_PROCESSING,
    documentConsentChecked,
    employerDocument,
    form,
    mode,
    offerAccepted,
    profileConsentChecked,
    selectedCityId,
    shareProfileChecked,
  ]);

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

  function handleEmployerDocumentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      setEmployerDocument(null);
      return;
    }

    const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setFeedback({
        tone: "error",
        text: "Для проверки ПВЗ подойдут PDF, JPEG, PNG или WebP.",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFeedback({
        tone: "error",
        text: "Документ для проверки должен быть меньше 10 МБ.",
      });
      return;
    }

    setEmployerDocument(file);
    setDocumentConsentChecked(false);
    setFeedback(null);
  }

  async function submitConsent(purpose: ConsentPurpose, granted: boolean) {
    const response = await fetchWithTelegramAuth("/api/legal-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, granted, source: `profile-form:${mode}` }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { consents?: ConsentState; error?: string }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "Не удалось сохранить согласие.");
    }

    if (payload?.consents) {
      setConsents(payload.consents);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    setFeedback(null);

    try {
      if (!consents.PERSONAL_DATA_PROCESSING) {
        await submitConsent("PERSONAL_DATA_PROCESSING", true);
      }

      if (mode === "onboarding") {
        const offerResponse = await fetchWithTelegramAuth("/api/legal-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purpose: "OFFER_ACCEPTANCE",
            accepted: true,
            source: "profile-form:onboarding",
          }),
        });
        if (!offerResponse.ok) {
          throw new Error("Не удалось зафиксировать принятие оферты.");
        }

        if (!consents.PUBLIC_PROFILE_DISTRIBUTION) {
          await submitConsent("PUBLIC_PROFILE_DISTRIBUTION", true);
        }
      }

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
              ? "Не удалось автоматически подтвердить Telegram-сессию. Откройте приложение из бота ещё раз."
              : (result?.error ?? result?.message ?? "Не удалось сохранить профиль."),
        });
        return;
      }

      let nextEmployerVerificationStatus = employerVerificationStatus;

      if (form.role === "OWNER" && employerDocument) {
        if (!consents.EMPLOYER_DOCUMENT_PROCESSING) {
          await submitConsent("EMPLOYER_DOCUMENT_PROCESSING", true);
        }
        const documentFormData = new FormData();
        documentFormData.append("file", employerDocument);

        const verificationResponse = await fetchWithTelegramAuth(
          "/api/profile/employer-verification",
          {
            method: "POST",
            body: documentFormData,
          },
        );
        const verificationPayload = (await verificationResponse.json().catch(() => null)) as
          | {
              verification?: { status?: VerificationStatus };
              error?: string;
            }
          | null;

        if (!verificationResponse.ok) {
          setFeedback({
            tone: "error",
            text:
              verificationPayload?.error ??
              "Профиль сохранен, но документ для проверки ПВЗ не удалось отправить.",
          });
          return;
        }

        nextEmployerVerificationStatus = verificationPayload?.verification?.status ?? "PENDING";
        setEmployerVerificationStatus(nextEmployerVerificationStatus);
        setEmployerDocument(null);
        setDocumentConsentChecked(false);
      }

      if (mode !== "onboarding" && shareProfileChecked !== consents.PUBLIC_PROFILE_DISTRIBUTION) {
        await submitConsent("PUBLIC_PROFILE_DISTRIBUTION", shareProfileChecked);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent<ProfileUpdatedEventDetail>("profile:updated", {
            detail: {
              onboardingCompleted: true,
              roles,
              employerVerificationStatus: nextEmployerVerificationStatus,
            },
          }),
        );
      }

      if (mode === "onboarding") {
        router.refresh();
        router.replace(withPlatformPrefix("/shifts", platformPrefix));
        return;
      }

      setFeedback({ tone: "success", text: "Профиль сохранён." });
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Сервис профиля временно недоступен. Попробуйте ещё раз.",
      });
    } finally {
      setSaving(false);
    }
  }

  const openDocumentsInline =
    mode === "onboarding" && platformPrefix === TELEGRAM_PLATFORM_PREFIX;

  function renderLegalDocumentLink(
    document: LegalDocument,
    label: string,
    className: string,
  ) {
    if (openDocumentsInline) {
      return (
        <button
          type="button"
          onClick={() => setLegalDocument(document)}
          className={className}
        >
          {label}
        </button>
      );
    }

    return (
      <Link href={withPlatformPrefix(`/${document}`, platformPrefix)} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <>
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
            <div className="relative grid grid-cols-2 overflow-hidden rounded-[22px] border border-[#d7e2ec] bg-[#f8fbfd] p-1">
              <span
                aria-hidden
                className={`absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-[18px] bg-[#3387d1] shadow-[0_6px_14px_rgba(51,135,209,0.24)] transition-transform duration-200 ease-out ${
                  form.role === "OWNER" ? "translate-x-0" : "translate-x-full"
                }`}
              />
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, role: "OWNER" }))}
                className={`relative z-10 rounded-[18px] px-3 py-3 text-center text-[14px] font-semibold transition-colors duration-200 ${
                  form.role === "OWNER" ? "text-white" : "text-[#52606c]"
                }`}
              >
                Владелец
              </button>

              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, role: "EMPLOYEE" }))}
                className={`relative z-10 rounded-[18px] px-3 py-3 text-center text-[14px] font-semibold transition-colors duration-200 ${
                  form.role === "EMPLOYEE" ? "text-white" : "text-[#52606c]"
                }`}
              >
                Сотрудник
              </button>
            </div>
            <span className={hintClassName}>
              {form.role === "OWNER"
                ? "Владелец публикует смены и выбирает исполнителей."
                : "Сотрудник откликается на смены и подработку."}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
              <span>Регион</span>
              <SearchableSelect
                options={regions.map((region) => ({ id: region.id, name: region.name }))}
                value={form.regionId}
                onChange={(nextRegionId) =>
                  setForm((current) => ({
                    ...current,
                    regionId: nextRegionId,
                    cityId: "",
                  }))
                }
                placeholder="Выберите регион"
                searchPlaceholder="Поиск региона"
                ariaLabel="Регион"
              />
            </label>

            <label className="grid gap-2 text-[14px] font-medium text-[#101214]">
              <span>{form.role === "OWNER" ? "Основной город ПВЗ" : "Город"}</span>
              <SearchableSelect
                options={cities.map((city) => ({ id: city.id, name: city.name }))}
                value={selectedCityId}
                onChange={(nextCityId) =>
                  setForm((current) => ({ ...current, cityId: nextCityId }))
                }
                placeholder="Выберите город"
                searchPlaceholder="Поиск города"
                ariaLabel="Город"
                disabled={!form.regionId || cities.length === 0}
              />
              {form.role === "OWNER" ? (
                <span className={hintClassName}>
                  Этот город будет подставляться при создании смены, его можно изменить в самой
                  смене.
                </span>
              ) : null}
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
            <div className="grid gap-2">
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
                    className={`flex min-h-12 items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left text-[14px] font-semibold transition ${
                      active
                        ? "border-[#3387d1] bg-[#3387d1] text-white"
                        : "border-[#e1e6eb] bg-[#f8fbfd] text-[#101214]"
                    }`}
                  >
                    <span>{option.label}</span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                        active
                          ? "border-white bg-white text-[#3387d1]"
                          : "border-[#cbd6df] bg-white text-transparent"
                      }`}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
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

          {mode === "onboarding" && form.role === "OWNER" ? (
            <div className="grid gap-3 rounded-[24px] border border-dashed border-[#d7dfe7] bg-[#f8fbfd] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] font-medium text-[#101214]">
                  Документ для проверки ПВЗ
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#7f8791]">
                  {getEmployerVerificationLabel(employerVerificationStatus)}
                </span>
              </div>
              <p className="text-xs leading-5 text-[#7f8791]">
                Необязательно для завершения регистрации. Подойдет договор аренды,
                скриншот из приложения управления ПВЗ или другой документ, который
                подтверждает, что вы владеете или управляете пунктом выдачи. Без
                одобрения этого документа создавать смены нельзя. Документ удаляется
                не позднее чем через 30 дней после загрузки.
              </p>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[20px] bg-white px-4 py-3 text-[14px] font-medium text-[#101214] shadow-[0_4px_10px_rgba(20,27,33,0.06)]">
                <span className="min-w-0 truncate">
                  {employerDocument ? employerDocument.name : "Загрузить PDF или изображение"}
                </span>
                <Upload className="h-4 w-4 shrink-0 text-[#3387d1]" />
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleEmployerDocumentChange}
                />
              </label>
            </div>
          ) : null}

          <div className="grid gap-3">
            <span className="text-[14px] font-medium text-[#101214]">Аватарка профиля</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-[22px] border border-dashed border-[#d7dfe7] bg-[#f8fbfd] p-3 transition hover:border-[#3387d1]">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#e7edf3]">
                {form.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.photoUrl}
                    alt="Аватар профиля"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-5 w-5 text-[#7f8791]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[14px] font-medium text-[#101214]">
                  <Upload className="h-4 w-4" />
                  {form.photoUrl ? "Заменить фото" : "Добавить фото"}
                </div>
                <p className="mt-1 text-xs leading-4 text-[#7f8791]">
                  Фото будет видно в профиле. Лучше живой портрет без лишнего фона.
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

          <div className="grid gap-3 rounded-[8px] border border-border bg-muted p-4">
            <h3 className="text-[15px] font-semibold text-foreground">Согласия и видимость</h3>
            {!consents.PERSONAL_DATA_PROCESSING ? (
              <div className="rounded-[8px] border border-border bg-card p-3">
                <label className="flex items-start gap-3 text-[13px] leading-5 text-foreground">
                  <input
                    type="checkbox"
                    checked={profileConsentChecked}
                    onChange={(event) => setProfileConsentChecked(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="font-medium">Даю согласие на обработку данных профиля</span>
                </label>
                <details className="group mt-2 pl-7 text-[12px] leading-5 text-muted-foreground">
                  <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-accent">
                    Подробнее
                    <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-2">{CONSENT_TEXT.PERSONAL_DATA_PROCESSING}</p>
                  {renderLegalDocumentLink(
                    "privacy",
                    "Политика обработки персональных данных",
                    "mt-2 inline-flex font-semibold text-accent underline decoration-accent/40 underline-offset-2",
                  )}
                </details>
              </div>
            ) : (
              <p className="rounded-[8px] bg-success-soft p-3 text-[13px] leading-5 text-success-soft-foreground">
                Согласие на обработку данных профиля уже зафиксировано.
              </p>
            )}

            {mode === "onboarding" ? (
              <div className="rounded-[8px] border border-border bg-card p-3">
                <label className="flex items-start gap-3 text-[13px] leading-5 text-foreground">
                  <input
                    type="checkbox"
                    checked={offerAccepted}
                    onChange={(event) => setOfferAccepted(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="font-medium">Принимаю публичную оферту</span>
                </label>
                <details className="group mt-2 pl-7 text-[12px] leading-5 text-muted-foreground">
                  <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-accent">
                    Подробнее
                    <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-2">
                    Оферта регулирует использование сервиса. Это отдельное действие и оно
                    не заменяет согласие на обработку персональных данных.
                  </p>
                  {renderLegalDocumentLink(
                    "offer",
                    "Открыть публичную оферту",
                    "mt-2 inline-flex font-semibold text-accent underline decoration-accent/40 underline-offset-2",
                  )}
                </details>
              </div>
            ) : null}

            <div className="rounded-[8px] border border-border bg-card p-3">
              <label className="flex items-start gap-3 text-[13px] leading-5 text-foreground">
                <input
                  type="checkbox"
                  checked={shareProfileChecked}
                  onChange={(event) => setShareProfileChecked(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                />
                <span className="font-medium">Показывать мой профиль участникам сервиса</span>
              </label>
              <details className="group mt-2 pl-7 text-[12px] leading-5 text-muted-foreground">
                <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-accent">
                  Подробнее
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2">{CONSENT_TEXT.PUBLIC_PROFILE_DISTRIBUTION}</p>
                {mode === "onboarding" ? (
                  <p className="mt-2">
                    Обязательно для регистрации: без согласия создать профиль нельзя.
                  </p>
                ) : (
                  <p className="mt-2">
                    После отзыва публичный просмотр профиля будет закрыт.
                  </p>
                )}
              </details>
            </div>
            {consents.PUBLIC_PROFILE_DISTRIBUTION && !shareProfileChecked ? (
              <p className="text-[12px] leading-5 text-danger-soft-foreground">
                После сохранения публичный просмотр вашего профиля будет закрыт.
              </p>
            ) : null}
          </div>

          <p className="text-center text-[12px] leading-5 text-muted-foreground">
            Полные условия доступны в{" "}
            {renderLegalDocumentLink(
              "privacy",
              "Политике обработки персональных данных",
              "font-semibold text-accent underline decoration-accent/40 underline-offset-2",
            )}
            {mode === "onboarding" ? (
              <>
                {" "}и{" "}
                {renderLegalDocumentLink(
                  "offer",
                  "публичной оферте",
                  "font-semibold text-accent underline decoration-accent/40 underline-offset-2",
                )}
                .
              </>
            ) : (
              "."
            )}
          </p>

          {mode === "onboarding" && form.role === "OWNER" && employerDocument ? (
            <label className="flex items-start gap-3 rounded-[8px] border border-border bg-muted p-4 text-[12px] leading-5 text-muted-foreground">
              <input
                type="checkbox"
                checked={documentConsentChecked}
                onChange={(event) => setDocumentConsentChecked(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
              />
              <span>{CONSENT_TEXT.EMPLOYER_DOCUMENT_PROCESSING}</span>
            </label>
          ) : null}

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

      {legalDocument ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
          <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-[820px] items-center px-4">
              <button
                type="button"
                onClick={() => setLegalDocument(null)}
                aria-label="Вернуться к регистрации"
                className="-ml-2 flex min-w-0 items-center gap-2 rounded-full px-2 py-2 text-[16px] font-semibold text-foreground"
              >
                <ArrowLeft className="h-5 w-5 shrink-0" />
                <span className="truncate">
                  {legalDocument === "privacy"
                    ? "Политика конфиденциальности"
                    : "Публичная оферта"}
                </span>
              </button>
            </div>
          </div>
          <iframe
            title={legalDocument === "privacy" ? "Политика конфиденциальности" : "Публичная оферта"}
            src={withPlatformPrefix(`/${legalDocument}?embedded=1`, platformPrefix)}
            className="min-h-0 w-full flex-1 border-0 bg-background"
          />
        </div>
      ) : null}
    </>
  );
}
