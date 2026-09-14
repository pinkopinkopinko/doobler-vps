import { demoCities, demoRegions } from "@/lib/demo-data";
import { isDevFallbackEnabled, logDevFallbackUsed } from "@/lib/dev-fallback";
import { fetchDaData } from "@/lib/geocoder/dadata-fetch";
import { prisma } from "@/lib/prisma";
import { formatCompactShiftAddress } from "@/lib/utils";

type CityContext = {
  cityId: string;
  cityName: string;
  regionName: string | null;
};

type DaDataSuggestionData = {
  fias_id?: string | null;
  unrestricted_value?: string | null;
  region_with_type?: string | null;
  region?: string | null;
  city_with_type?: string | null;
  city?: string | null;
  settlement_with_type?: string | null;
  settlement?: string | null;
  city_district_with_type?: string | null;
  city_district?: string | null;
  area_with_type?: string | null;
  area?: string | null;
  street_with_type?: string | null;
  street?: string | null;
  house?: string | null;
  qc_geo?: string | null;
  geo_lat?: string | null;
  geo_lon?: string | null;
};

type DaDataSuggestion = {
  value?: string;
  unrestricted_value?: string;
  data?: DaDataSuggestionData;
};

type DaDataSuggestResponse = {
  suggestions?: DaDataSuggestion[];
};

export type VerifiedAddress = {
  formattedAddress: string;
  district: string | null;
  city: string | null;
  street: string | null;
  house: string | null;
  precision: string | null;
  lat: number | null;
  lng: number | null;
};

type VerifyAddressSelectionInput = {
  cityId: string;
  query: string;
  expectedUri?: string | null;
};

function getDaDataApiKey() {
  return process.env.DADATA_API_KEY ?? null;
}

function normalizeCompareValue(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPostalCode(value: string | null | undefined) {
  return (value ?? "").replace(/^\s*\d{6},?\s*/u, "").trim();
}

function normalizeDistrictLabel(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/\b(?:р-?н|район)\b/giu, "")
    .replace(/\b(?:г\.?|городской округ)\b/giu, "")
    .replace(/\s+/g, " ")
    .replace(/^[,\s-]+|[,\s-]+$/g, "")
    .trim();

  return normalized || null;
}

function maskApiKey(value: string) {
  if (value.length <= 8) {
    return "***";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function resolveCityContext(cityId: string): Promise<CityContext | null> {
  try {
    const city = await prisma.city.findUnique({
      where: { id: cityId },
      select: {
        id: true,
        name: true,
        region: {
          select: {
            name: true,
          },
        },
      },
    });

    if (city) {
      return {
        cityId: city.id,
        cityName: city.name,
        regionName: city.region?.name ?? null,
      };
    }
  } catch (error) {
    if (!isDevFallbackEnabled("data")) {
      throw error;
    }

    logDevFallbackUsed({
      kind: "data",
      source: "resolveCityContext.verify",
      reason: error,
      meta: { cityId },
    });
  }

  const city = demoCities.find((item) => item.id === cityId);

  if (!city) {
    return null;
  }

  return {
    cityId: city.id,
    cityName: city.name,
    regionName: demoRegions.find((region) => region.id === city.regionId)?.name ?? null,
  };
}

function isGenericDistrictCandidate(candidate: string | null, city: CityContext) {
  const normalizedCandidate = normalizeCompareValue(candidate);

  if (!normalizedCandidate) {
    return true;
  }

  const normalizedCity = normalizeCompareValue(city.cityName);
  const normalizedRegion = normalizeCompareValue(city.regionName);
  const genericMatches = new Set([
    normalizedCity,
    normalizedRegion,
    `городской округ ${normalizedCity}`,
    `муниципальное образование ${normalizedCity}`,
    `город ${normalizedCity}`,
    `г ${normalizedCity}`,
    `г. ${normalizedCity}`,
  ]);

  return genericMatches.has(normalizedCandidate);
}

function extractMeaningfulDistrict(suggestion: DaDataSuggestion, city: CityContext) {
  const data = suggestion.data;
  const candidates = [
    data?.city_district_with_type,
    data?.city_district,
    data?.area_with_type,
    data?.area,
  ].filter((value): value is string => Boolean(value?.trim()));

  const district =
    candidates.find((candidate) => !isGenericDistrictCandidate(candidate, city)) ?? null;

  return normalizeDistrictLabel(district);
}

function matchesExpectedCity(suggestion: DaDataSuggestion, city: CityContext) {
  const data = suggestion.data;
  const expectedCity = normalizeCompareValue(city.cityName);
  const actualCity = normalizeCompareValue(data?.city ?? data?.settlement ?? null);
  const formattedAddress = normalizeCompareValue(
    suggestion.unrestricted_value ?? suggestion.value ?? null,
  );

  return actualCity === expectedCity || formattedAddress.includes(expectedCity);
}

function mapPrecision(data: DaDataSuggestionData | undefined) {
  const qcGeo = Number(data?.qc_geo ?? "");

  if (!Number.isFinite(qcGeo)) {
    return null;
  }

  if (qcGeo === 0) {
    return "exact";
  }

  if (qcGeo === 1) {
    return "near";
  }

  if (qcGeo === 2) {
    return "street";
  }

  return "other";
}

function parseCoordinate(value: string | null | undefined) {
  const coordinate = Number(value);

  return Number.isFinite(coordinate) ? coordinate : null;
}

async function requestDaDataSuggest(params: {
  apiKey: string;
  city: CityContext;
  query: string;
  count: number;
  timeoutMs?: number;
}) {
  const response = await fetchDaData(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Token ${params.apiKey}`,
      },
      body: JSON.stringify({
        query: params.query,
        count: params.count,
        locations_boost: [
          {
            city: params.city.cityName,
          },
        ],
      }),
      cache: "no-store",
    },
    params.timeoutMs,
  );

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    console.error("[dadata-verify] upstream suggest error", {
      status: response.status,
      statusText: response.statusText,
      cityId: params.city.cityId,
      queryLength: params.query.length,
      apiKey: maskApiKey(params.apiKey),
      responseText: responseText.slice(0, 1000),
    });
    throw new Error(`DADATA_${response.status}`);
  }

  return (await response.json()) as DaDataSuggestResponse;
}

async function requestDaDataFindById(
  apiKey: string,
  city: CityContext,
  fiasId: string,
  timeoutMs?: number,
) {
  const response = await fetchDaData(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/address",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({
        query: fiasId,
        count: 1,
      }),
      cache: "no-store",
    },
    timeoutMs,
  );

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    console.error("[dadata-verify] upstream findById error", {
      status: response.status,
      statusText: response.statusText,
      cityId: city.cityId,
      apiKey: maskApiKey(apiKey),
      responseText: responseText.slice(0, 1000),
    });
    throw new Error(`DADATA_${response.status}`);
  }

  return (await response.json()) as DaDataSuggestResponse;
}

function mapVerifiedSuggestion(
  suggestion: DaDataSuggestion | undefined,
  city: CityContext,
): VerifiedAddress | null {
  if (!suggestion) {
    return null;
  }

  const data = suggestion.data;
  const rawFormattedAddress =
    stripPostalCode(suggestion.unrestricted_value) ||
    stripPostalCode(suggestion.value) ||
    null;
  const district = extractMeaningfulDistrict(suggestion, city);

  if (!rawFormattedAddress) {
    return null;
  }

  const formattedAddress =
    formatCompactShiftAddress(city.cityName, district, rawFormattedAddress) || rawFormattedAddress;

  return {
    formattedAddress,
    district,
    city:
      data?.city_with_type?.trim() ??
      data?.settlement_with_type?.trim() ??
      data?.city?.trim() ??
      data?.settlement?.trim() ??
      null,
    street: data?.street_with_type?.trim() ?? data?.street?.trim() ?? null,
    house: data?.house?.trim() ?? null,
    precision: mapPrecision(data),
    lat: parseCoordinate(data?.geo_lat),
    lng: parseCoordinate(data?.geo_lon),
  };
}

function looksLikeFiasId(value: string | null | undefined) {
  return /^[0-9a-fA-F-]{36}$/.test((value ?? "").trim());
}

export async function verifyAddressSelection(input: VerifyAddressSelectionInput) {
  const apiKey = getDaDataApiKey();

  if (!apiKey) {
    throw new Error("DADATA_NOT_CONFIGURED");
  }

  const city = await resolveCityContext(input.cityId);

  if (!city) {
    throw new Error("CITY_NOT_FOUND");
  }

  const query = input.query.trim();

  if (query.length < 3) {
    throw new Error("ADDRESS_NOT_FOUND");
  }

  // Anti-tamper re-verify при создании смены — это разовый POST, юзер уже
  // выбрал адрес из подсказки и ждёт submit. Тут можно потерпеть до 8 секунд
  // ради того, чтобы координаты гарантированно записались в ShiftPost.lat/lng.
  // Без них статическая карта на странице смены показывает CSS-плейсхолдер
  // вместо реального превью Яндекс.Карты.
  const VERIFY_TIMEOUT_MS = 8_000;

  const payload =
    looksLikeFiasId(input.expectedUri)
      ? await requestDaDataFindById(apiKey, city, input.expectedUri!.trim(), VERIFY_TIMEOUT_MS)
      : await requestDaDataSuggest({
          apiKey,
          city,
          query,
          count: 1,
          timeoutMs: VERIFY_TIMEOUT_MS,
        });

  const suggestion = payload.suggestions?.[0];

  if (!suggestion) {
    throw new Error("ADDRESS_NOT_FOUND");
  }

  if (!matchesExpectedCity(suggestion, city)) {
    throw new Error("ADDRESS_CITY_MISMATCH");
  }

  const verified = mapVerifiedSuggestion(suggestion, city);

  if (!verified) {
    throw new Error("ADDRESS_NOT_VERIFIED");
  }

  console.log("[dadata-verify] upstream success", {
    cityId: input.cityId,
    queryLength: query.length,
    hasFiasId: looksLikeFiasId(input.expectedUri),
    formattedAddress: verified.formattedAddress,
    district: verified.district,
    precision: verified.precision,
    hasCoords: typeof verified.lat === "number" && typeof verified.lng === "number",
  });

  return verified;
}
