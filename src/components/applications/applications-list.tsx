import Link from "next/link";

import { AssignmentActions } from "@/components/applications/assignment-actions";
import { ConfirmApplicationButton } from "@/components/applications/confirm-application-button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ApplicationCard as ApplicationCardType } from "@/lib/types";
import { formatExperienceYears, getApplicationStatusLabel } from "@/lib/utils";

type ApplicationsListProps = {
  applications: ApplicationCardType[];
  canConfirm?: boolean;
};

export function ApplicationsList({ applications, canConfirm = false }: ApplicationsListProps) {
  return (
    <div className="space-y-4">
      {applications.map((application) => (
        <article
          key={application.id}
          className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[#e7edf3] text-sm font-semibold text-[#4e5d6c]">
                {application.applicant.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={application.applicant.photoUrl}
                    alt={`${application.applicant.firstName} ${application.applicant.lastName ?? ""}`.trim()}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  `${application.applicant.firstName[0] ?? ""}${application.applicant.lastName?.[0] ?? ""}`
                )}
              </div>

              <div>
                <p className="text-[13px] font-medium text-[#667381]">
                  {application.applicant.firstName} {application.applicant.lastName ?? ""}
                </p>
                <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#101214]">
                  {application.shiftTitle}
                </h3>
              </div>
            </div>
            <StatusBadge variant={application.status === "CONFIRMED" ? "success" : "neutral"}>
              {getApplicationStatusLabel(application.status)}
            </StatusBadge>
          </div>

          <div className="grid gap-1 text-[14px] font-medium leading-6 text-[#667381]">
            <p>
              Город: {application.applicant.cityName}
              {application.applicant.district ? `, ${application.applicant.district}` : ""}
            </p>
            <p>
              Рейтинг: {application.applicant.ratingAvg.toFixed(1)} • завершённых смен:{" "}
              {application.applicant.completedAssignmentsCount}
            </p>
            {formatExperienceYears(application.applicant.experienceSummary) ? (
              <p>Опыт: {formatExperienceYears(application.applicant.experienceSummary)}</p>
            ) : null}
            <p>Скоринг: {application.score} / 100</p>
            {application.message ? <p>Комментарий: {application.message}</p> : null}
          </div>

          <div className="mt-4">
            <Link
              href={`/profiles/${application.applicant.id}`}
              className="inline-flex rounded-full bg-[#dfe8f1] px-4 py-3 text-[14px] font-semibold text-[#1f3a52]"
            >
              Смотреть профиль сотрудника
            </Link>
          </div>

          {canConfirm ? (
            <div className="mt-4 space-y-3">
              {application.assignment ? (
                <AssignmentActions
                  assignmentId={application.assignment.id}
                  assignmentStatus={application.assignment.status}
                  reviewSubmitted={application.assignment.employerReviewSubmitted}
                  canComplete
                  reviewTargetLabel="сотруднике"
                  reviewPlaceholder="Как сотрудник отработал смену?"
                />
              ) : (
                <ConfirmApplicationButton applicationId={application.id} />
              )}

              {application.assignment ? (
                <p className="text-[13px] text-[#7f8791]">
                  {application.assignment.status === "COMPLETED"
                    ? "Смена завершена. Теперь можно оставить отзыв."
                    : "Кандидат подтверждён. После окончания смены закройте её здесь."}
                </p>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
