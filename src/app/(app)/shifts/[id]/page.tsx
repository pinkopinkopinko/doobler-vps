import Link from "next/link";
import { Flag, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { notFound } from "next/navigation";

import { ApplicationsList } from "@/components/applications/applications-list";
import { PageHeader } from "@/components/layout/page-header";
import { ShiftActions } from "@/components/shifts/shift-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { getSessionPayload } from "@/lib/auth/session";
import {
  formatDate,
  formatMoney,
  formatShiftLocation,
  getExperienceLabel,
  getMarketplaceLabel,
  getShiftTypeLabel,
} from "@/lib/utils";
import { listApplicationsForShift } from "@/server/services/application-service";
import { getShiftPostById } from "@/server/services/shift-post-service";

export const dynamic = "force-dynamic";

type ShiftDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShiftDetailsPage({ params }: ShiftDetailsPageProps) {
  const { id } = await params;
  const shift = await getShiftPostById(id);
  const session = await getSessionPayload();

  if (!shift) {
    notFound();
  }

  const canManage = Boolean(session?.userId && shift.createdByUserId === session.userId);
  const applications = canManage ? await listApplicationsForShift(id) : [];
  const location = formatShiftLocation(shift.cityName, shift.district, shift.address);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Карточка смены"
        subtitle="Контакты откроются только после подтверждения исполнителя."
      />

      <section className="rounded-[32px] bg-white p-5 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
        <div className="mb-4 flex flex-wrap gap-2">
          {shift.isUrgent ? <StatusBadge variant="urgent">Срочно</StatusBadge> : null}
          <StatusBadge variant="neutral">{getShiftTypeLabel(shift.type)}</StatusBadge>
          <StatusBadge variant="success">{getMarketplaceLabel(shift.marketplace)}</StatusBadge>
        </div>

        <h2 className="text-[26px] font-semibold tracking-[-0.04em] text-[#101214]">{shift.title}</h2>
        <p className="mt-3 text-[14px] leading-6 text-[#7f8791]">
          {shift.description || "Комментарий не указан."}
        </p>

        <div className="mt-5 grid gap-3">
          <div className="rounded-[24px] bg-[#f8fbfd] p-4">
            <p className="text-[12px] font-medium text-[#a6abb2]">Дата</p>
            <p className="mt-1 text-[16px] font-semibold text-[#101214]">{formatDate(shift.shiftDate)}</p>
          </div>
          <div className="rounded-[24px] bg-[#f8fbfd] p-4">
            <p className="text-[12px] font-medium text-[#a6abb2]">Район и адрес</p>
            <p className="mt-1 flex items-center gap-2 text-[16px] font-semibold text-[#101214]">
              <MapPin className="h-4 w-4 shrink-0 text-[#3387d1]" />
              <span>{location}</span>
            </p>
          </div>
          <div className="rounded-[24px] bg-[#f8fbfd] p-4">
            <p className="text-[12px] font-medium text-[#a6abb2]">Оплата</p>
            <p className="mt-1 flex items-center gap-2 text-[16px] font-semibold text-[#101214]">
              <Wallet className="h-4 w-4 text-[#3387d1]" />
              {formatMoney(shift.paymentAmountRub)}
            </p>
          </div>
          <div className="rounded-[24px] bg-[#f8fbfd] p-4">
            <p className="text-[12px] font-medium text-[#a6abb2]">Требования</p>
            <p className="mt-1 text-[16px] font-semibold text-[#101214]">
              {getExperienceLabel(shift.experienceLevelRequired)}
            </p>
          </div>
        </div>

        <ShiftActions shiftId={shift.id} initiallyFavorite={shift.favorite} canApply={!canManage} />

        <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-[#7f8791]">
          <span className="flex items-center gap-2 rounded-full bg-[#f2f5f8] px-3 py-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Контакты скрыты до подтверждения
          </span>
          <Link href="/moderation" className="flex items-center gap-2 rounded-full bg-[#f2f5f8] px-3 py-2">
            <Flag className="h-3.5 w-3.5" />
            Пожаловаться
          </Link>
        </div>
      </section>

      {canManage ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-[#101214]">
              Кандидаты на эту смену
            </h2>
            <p className="mt-1 text-[14px] text-[#7f8791]">
              Выберите исполнителя и подтвердите его прямо из Mini App.
            </p>
          </div>
          <ApplicationsList applications={applications} canConfirm />
        </section>
      ) : null}
    </div>
  );
}
