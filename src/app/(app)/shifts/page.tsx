import { PageHeader } from "@/components/layout/page-header";
import { BalanceTopUpMenu } from "@/components/balance/balance-top-up-menu";
import { ShiftFeed } from "@/components/shifts/shift-feed";
import { getSessionPayload } from "@/lib/auth/session";
import { getRequestPlatformPrefix } from "@/lib/routing/platform-server";
import { getTodayDateValue } from "@/lib/utils";
import { getProfileShell } from "@/server/services/profile-service";
import { listAvailableShiftDistricts, listShiftPosts } from "@/server/services/shift-post-service";

export const dynamic = "force-dynamic";

type ShiftsPageProps = {
  searchParams?: Promise<{
    cityId?: string | string[];
    district?: string | string[];
    marketplace?: string | string[];
    search?: string | string[];
    urgentOnly?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
    paymentMin?: string | string[];
    paymentMax?: string | string[];
  }>;
};

function getSingleParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.trim()) ?? value[0] ?? "";
  }

  return value ?? "";
}

function parseMoneyFilter(value?: string | string[]) {
  const singleValue = getSingleParam(value);

  if (!singleValue.trim()) {
    return null;
  }

  const amount = Number(singleValue);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export default async function ShiftsPage({ searchParams }: ShiftsPageProps) {
  const session = await getSessionPayload();
  const hrefPrefix = await getRequestPlatformPrefix();
  const profile = session ? await getProfileShell(session.userId) : null;
  const params = (await searchParams) ?? {};
  const activeCityId = getSingleParam(params.cityId) || profile?.cityId || null;
  const activeCityName = activeCityId === profile?.cityId ? profile.cityName : null;
  const urgentOnly = getSingleParam(params.urgentOnly) === "true";
  const paymentMin = parseMoneyFilter(params.paymentMin);
  const paymentMax = parseMoneyFilter(params.paymentMax);
  const dateFrom = getSingleParam(params.dateFrom).trim() || getTodayDateValue();
  const dateTo = getSingleParam(params.dateTo).trim() || null;
  const marketplace = getSingleParam(params.marketplace).trim() || null;
  const district = getSingleParam(params.district).trim() || null;
  const searchQuery = getSingleParam(params.search).trim() || null;

  const [shifts, districtOptions] = await Promise.all([
    listShiftPosts({
      cityId: activeCityId,
      district,
      marketplaceCode: marketplace,
      search: searchQuery,
      urgentOnly,
      dateFrom,
      dateTo,
      paymentMin,
      paymentMax,
    }),
    listAvailableShiftDistricts({
      cityId: activeCityId,
      marketplaceCode: marketplace,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Смены и вакансии"
        titleSize="compact"
        action={<BalanceTopUpMenu initialBalanceRub={profile?.balanceRub ?? 0} />}
      />
      <ShiftFeed
        shifts={shifts}
        activeCityId={activeCityId}
        activeCityName={activeCityName ?? profile?.cityName ?? undefined}
        activeDistrict={district ?? ""}
        districtOptions={districtOptions}
        marketplaceCode={marketplace ?? ""}
        urgentOnly={urgentOnly}
        searchQuery={searchQuery ?? ""}
        dateFrom={dateFrom}
        dateTo={dateTo ?? ""}
        paymentMin={paymentMin?.toString() ?? ""}
        paymentMax={paymentMax?.toString() ?? ""}
        hrefPrefix={hrefPrefix}
      />
    </div>
  );
}
