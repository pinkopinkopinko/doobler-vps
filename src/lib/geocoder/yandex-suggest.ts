import { demoCities, demoRegions } from "@/lib/demo-data";
import { isDevFallbackEnabled, logDevFallbackUsed } from "@/lib/dev-fallback";
import { prisma } from "@/lib/prisma";

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

export type AddressSuggestion = {
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

type CityContext = {
  cityId: string;
  cityName: string;
  regionName: string | null;
};

type FetchAddressSuggestionsInput = {
  cityId: string;
  query: string;
  sessionToken?: string | null;
  limit?: number;
  referer?: string | null;
  origin?: string | null;
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

    logDevFallbackUsed({ kind: "data", source: "resolveCityContext.suggest", reason: error, meta: { cityId } });
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

function belongsToCity(suggestion: DaDataSuggestion, city: CityContext) {
  const data = suggestion.data;
  const cityName = normalizeCompareValue(city.cityName);
  const exactCity = normalizeCompareValue(data?.city ?? data?.settlement ?? null);
  const cityWithType = normalizeCompareValue(
    data?.city_with_type ?? data?.settlement_with_type ?? null,
  );
  const formattedAddress = normalizeCompareValue(
    suggestion.unrestricted_value ?? suggestion.value ?? null,
  );

  return (
    exactCity === cityName ||
    cityWithType.includes(cityName) ||
    formattedAddress.includes(cityName)
  );
}

function mapSuggestion(suggestion: DaDataSuggestion, city: CityContext): AddressSuggestion | null {
  const data = suggestion.data;
  const formattedAddress =
    stripPostalCode(suggestion.unrestricted_value) ||
    stripPostalCode(suggestion.value) ||
    null;

  if (!formattedAddress) {
    return null;
  }

  const cityLabel =
    data?.city_with_type?.trim() ??
    data?.settlement_with_type?.trim() ??
    data?.city?.trim() ??
    data?.settlement?.trim() ??
    null;

  const streetLabel =
    data?.street_with_type?.trim() ??
    data?.street?.trim() ??
    null;

  const houseLabel = data?.house?.trim() ?? null;
  const district = extractMeaningfulDistrict(suggestion, city);
  const titleParts = [streetLabel, houseLabel].filter(Boolean);
  const title = titleParts.join(", ") || stripPostalCode(suggestion.value) || formattedAddress;
  const subtitleParts = [cityLabel, district].filter(Boolean);

  return {
    title,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(", ") : null,
    formattedAddress,
    district,
    city: cityLabel,
    street: streetLabel,
    house: houseLabel,
    uri: data?.fias_id?.trim() || formattedAddress,
    tags: ["dadata", data?.qc_geo ? `qc_geo:${data.qc_geo}` : ""].filter(Boolean),
  };
}

export async function fetchAddressSuggestions(input: FetchAddressSuggestionsInput) {
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
    return [];
  }

  const requestBody = {
    query: `${city.cityName} ${query}`.trim(),
    count: Math.min(input.limit ?? 6, 10),
    locations_boost: [
      {
        city: city.cityName,
      },
    ],
  };

  const response = await fetch(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    console.error("[dadata-suggest] upstream error", {
      status: response.status,
      statusText: response.statusText,
      cityId: input.cityId,
      queryLength: query.length,
      apiKey: maskApiKey(apiKey),
      responseText: responseText.slice(0, 1000),
    });
    throw new Error(`DADATA_${response.status}`);
  }

  const payload = (await response.json()) as DaDataSuggestResponse;

  console.log("[dadata-suggest] upstream success", {
    cityId: input.cityId,
    queryLength: query.length,
    resultsCount: payload.suggestions?.length ?? 0,
  });

  return (payload.suggestions ?? [])
    .filter((suggestion) => belongsToCity(suggestion, city))
    .map((suggestion) => mapSuggestion(suggestion, city))
    .filter((suggestion): suggestion is AddressSuggestion => Boolean(suggestion));
}
