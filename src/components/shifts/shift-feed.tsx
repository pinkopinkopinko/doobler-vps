import dynamic from "next/dynamic";

import { ShiftCard } from "@/components/shifts/shift-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ShiftCard as ShiftCardType } from "@/lib/types";

const ShiftFilters = dynamic(
  () => import("@/components/shifts/shift-filters").then((mod) => mod.ShiftFilters),
  {
    loading: () => (
      <div className="mb-4 rounded-[32px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
        <div className="h-11 w-full rounded-[22px] bg-[#f3f6f9]" />
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="h-10 w-24 rounded-full bg-[#f3f6f9]" />
          <div className="h-10 w-28 rounded-full bg-[#f3f6f9]" />
          <div className="h-10 w-24 rounded-full bg-[#f3f6f9]" />
        </div>
      </div>
    ),
  },
);

type DistrictOption = {
  label: string;
  count: number;
};

type ShiftFeedProps = {
  shifts: ShiftCardType[];
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
};

export function ShiftFeed({
  shifts,
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
}: ShiftFeedProps) {
  return (
    <div>
      <ShiftFilters
        key={[
          activeCityId ?? "",
          activeDistrict,
          marketplaceCode,
          urgentOnly ? "1" : "0",
          searchQuery,
          dateFrom,
          dateTo,
          paymentMin,
          paymentMax,
        ].join("|")}
        activeCityId={activeCityId}
        activeCityName={activeCityName}
        activeDistrict={activeDistrict}
        districtOptions={districtOptions}
        marketplaceCode={marketplaceCode}
        urgentOnly={urgentOnly}
        searchQuery={searchQuery}
        dateFrom={dateFrom}
        dateTo={dateTo}
        paymentMin={paymentMin}
        paymentMax={paymentMax}
        totalCount={shifts.length}
      />

      {shifts.length === 0 ? (
        <EmptyState
          title="По этим фильтрам ничего не найдено"
          description="Попробуйте расширить диапазон дат, убрать ограничение по району или поменять компанию."
        />
      ) : (
        <div className="space-y-4">
          {shifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} />
          ))}
        </div>
      )}
    </div>
  );
}
