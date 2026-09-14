import { ShieldCheck, Wallet } from "lucide-react";
import { notFound } from "next/navigation";

import { ApplicationsList } from "@/components/applications/applications-list";
import { PageHeader } from "@/components/layout/page-header";
import { ShiftActions } from "@/components/shifts/shift-actions";
import { ShiftDeleteButton } from "@/components/shifts/shift-delete-button";
import { ShiftEmployerCard } from "@/components/shifts/shift-employer-card";
import { ShiftLocationMap } from "@/components/shifts/shift-location-map";
import { ShiftReportButton } from "@/components/shifts/shift-report-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUserRecord } from "@/lib/auth/app-access";
import { getSessionPayload } from "@/lib/auth/session";
import { withPlatformPrefix } from "@/lib/routing/platform";
import { getRequestPlatformPrefix } from "@/lib/routing/platform-server";
import {
  formatDate,
  formatMoney,
  getExperienceLabel,
  getMarketplaceLabel,
  getShiftTypeLabel,
} from "@/lib/utils";
import {
  getUserApplicationStatusForShift,
  listApplicationsForShift,
} from "@/server/services/application-service";
import { getShiftPostById } from "@/server/services/shift-post-service";

export const dynamic = "force-dynamic";

type ShiftDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShiftDetailsPage({ params }: ShiftDetailsPageProps) {
  const { id } = await params;
  const session = await getSessionPayload();
  const hrefPrefix = await getRequestPlatformPrefix();
  const [shift, currentUserRecord] = await Promise.all([
    getShiftPostById(id),
    getCurrentUserRecord(),
  ]);

  if (!shift) {
    notFound();
  }

  const canManage = Boolean(session?.userId && shift.createdByUserId === session.userId);
  const viewerRoles = currentUserRecord?.user.roles.map((role) => role.role) ?? [];
  const ownerCannotApply = viewerRoles.includes("OWNER");
  // Owners видят список откликов, work-роли — статус собственного отклика.
  // Эти ветки взаимоисключающие, поэтому Promise.all не нужен.
  const applications = canManage ? await listApplicationsForShift(id) : [];
  const existingApplicationStatus =
    !canManage && !ownerCannotApply && session?.userId
      ? await getUserApplicationStatusForShift(id, session.userId)
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Карточка смены"
        subtitle="Контакты откроются только после подтверждения исполнителя."
      />

      <ShiftLocationMap
        cityName={shift.cityName}
        district={shift.district}
        address={shift.address}
        lat={shift.lat}
        lng={shift.lng}
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
            <p className="text-[12px] font-medium text-[#a6abb2]">Город</p>
            <p className="mt-1 text-[16px] font-semibold text-[#101214]">{shift.cityName}</p>
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

        <div className="mt-5 space-y-4">
          {!canManage ? (
            <ShiftEmployerCard
              employerUserId={shift.createdByUserId}
              employerName={shift.createdByName}
              marketplace={shift.marketplace}
              cityName={shift.cityName}
              hrefPrefix={hrefPrefix}
            />
          ) : null}
        </div>

        <ShiftActions
          shiftId={shift.id}
          canApply={!canManage && !ownerCannotApply}
          applyDisabledLabel={
            ownerCannotApply
              ? "Владельцы ПВЗ не могут откликаться"
              : "Вы владелец этой смены"
          }
          existingApplicationStatus={existingApplicationStatus}
        />

        <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-[#7f8791]">
          <span className="flex items-center gap-2 rounded-full bg-[#f2f5f8] px-3 py-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Контакты скрыты до подтверждения
          </span>
          {!canManage ? <ShiftReportButton shiftId={shift.id} /> : null}
        </div>
      </section>

      {canManage ? (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-[#101214]">
                Кандидаты на эту смену
              </h2>
            </div>
            <ApplicationsList applications={applications} canConfirm hrefPrefix={hrefPrefix} />
          </section>

          <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
            <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-[#101214]">
              Опасная зона
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-[#7f8791]">
              Удаляет объявление и все отклики на него. Если уже подтверждён
              исполнитель — сначала отмените смену, потом удаляйте.
            </p>
            <div className="mt-4">
              <ShiftDeleteButton
                shiftId={shift.id}
                redirectTo={withPlatformPrefix("/posts", hrefPrefix)}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
