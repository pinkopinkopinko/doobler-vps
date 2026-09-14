import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { withPlatformPrefix } from "@/lib/routing/platform";
import { getMarketplaceLabel } from "@/lib/utils";
import type { MarketplaceCode } from "@/lib/types";

type ShiftEmployerCardProps = {
  employerUserId?: string | null;
  employerName: string;
  marketplace: MarketplaceCode;
  cityName: string;
  hrefPrefix?: string;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` || "PV";
}

export function ShiftEmployerCard({
  employerUserId,
  employerName,
  marketplace,
  cityName,
  hrefPrefix = "",
}: ShiftEmployerCardProps) {
  const content = (
    <>
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#a6abb2]">
        Профиль работодателя
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[20px] bg-[#3387d1] text-[17px] font-semibold tracking-[-0.04em] text-white shadow-[0_10px_22px_rgba(51,135,209,0.22)]">
          {getInitials(employerName)}
        </div>
        <div className="min-w-0">
          <h3 className="break-words text-[20px] font-semibold leading-tight tracking-[-0.04em] text-[#101214] [overflow-wrap:anywhere]">
            {employerName}
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-[#7f8791]">
            Владелец · {getMarketplaceLabel(marketplace)} · {cityName}
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-[22px] bg-[#e9f6ef] px-4 py-3 text-[13px] font-semibold text-[#2f8a59]">
        <ShieldCheck className="mr-2 inline h-4 w-4 align-[-3px]" />
        Контакты открываются после подтверждения исполнителя
      </div>
    </>
  );

  if (!employerUserId) {
    return (
      <section className="rounded-[32px] bg-white p-5 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
        {content}
      </section>
    );
  }

  return (
    <Link
      href={withPlatformPrefix(`/profiles/${employerUserId}`, hrefPrefix)}
      className="block rounded-[32px] bg-white p-5 shadow-[0_12px_28px_rgba(20,27,33,0.08)]"
    >
      {content}
    </Link>
  );
}
