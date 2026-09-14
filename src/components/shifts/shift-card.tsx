import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { withPlatformPrefix } from "@/lib/routing/platform";
import type { ShiftCard as ShiftCardType } from "@/lib/types";
import {
  formatDate,
  formatMoney,
  formatShiftLocation,
  formatShiftTimeRange,
  getExperienceLabel,
  getMarketplaceLabel,
} from "@/lib/utils";

type ShiftCardProps = {
  shift: ShiftCardType;
  hrefPrefix?: string;
};

export function ShiftCard({ shift, hrefPrefix = "" }: ShiftCardProps) {
  const timeRange = formatShiftTimeRange(shift.startAt, shift.endAt);
  const location = formatShiftLocation(shift.cityName, shift.district, shift.address);

  return (
    <Link
      href={withPlatformPrefix(`/shifts/${shift.id}`, hrefPrefix)}
      className="block rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[20px] font-semibold leading-tight tracking-[-0.04em] text-[#101214]">
            {shift.title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge variant="neutral">{getMarketplaceLabel(shift.marketplace)}</StatusBadge>
            {shift.isUrgent ? <StatusBadge variant="urgent">Срочно</StatusBadge> : null}
          </div>
        </div>
      </div>

      <div className="space-y-1 text-[14px] font-medium leading-6 text-[#7f8791]">
        <p>
          Дата: <span className="text-[#101214]">{formatDate(shift.shiftDate)}</span>
        </p>
        <p>
          Время: <span className="text-[#101214]">{timeRange || "По договоренности"}</span>
        </p>
        <p>
          Локация:{" "}
          <span className="break-words text-[#101214] [overflow-wrap:anywhere]">{location}</span>
        </p>
        <p>
          Заработная плата: <span className="text-[#101214]">{formatMoney(shift.paymentAmountRub)}</span>
        </p>
        <p>
          Требования:{" "}
          <span className="text-[#101214]">{getExperienceLabel(shift.experienceLevelRequired)}</span>
        </p>
        <p>
          Количество откликов: <span className="text-[#101214]">{shift.applicationsCount}</span>
        </p>
      </div>

      <div className="mt-4">
        <div className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#3387d1] px-5 text-[15px] font-medium text-white">
          Открыть объявление
        </div>
      </div>
    </Link>
  );
}
