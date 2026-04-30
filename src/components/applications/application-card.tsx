import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { AssignmentActions } from "@/components/applications/assignment-actions";
import { StartChatButton } from "@/components/chat/start-chat-button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ApplicationCard as ApplicationCardType } from "@/lib/types";
import {
  formatDate,
  formatExperienceYears,
  getApplicationStatusLabel,
  getMarketplaceLabel,
} from "@/lib/utils";

type ApplicationCardProps = {
  application: ApplicationCardType;
  /**
   * "worker"   — список «Мои отклики», работник смотрит свои отклики и блок
   *              работодателя с действиями (написать / открыть профиль).
   * "employer" — список откликов на смену работодателя, текущая карточка про
   *              работника-кандидата, блок работодателя скрываем.
   */
  perspective?: "worker" | "employer";
};

function buildEmployerName(employer: ApplicationCardType["employer"]) {
  const full = [employer.firstName, employer.lastName].filter(Boolean).join(" ").trim();
  return full || employer.username || "Работодатель";
}

export function ApplicationCard({ application, perspective = "worker" }: ApplicationCardProps) {
  const showEmployerBlock = perspective === "worker";
  const employer = application.employer;
  const employerName = buildEmployerName(employer);
  const employerInitials =
    `${employer.firstName?.[0] ?? ""}${employer.lastName?.[0] ?? ""}`.trim() || "PV";

  return (
    <article className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-[#a6abb2]">
            {getMarketplaceLabel(application.applicant.marketplaces[0] ?? "OTHER")}
          </p>
          <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#101214]">
            {application.shiftTitle}
          </h3>
        </div>
        <StatusBadge variant={application.status === "CONFIRMED" ? "success" : "neutral"}>
          {getApplicationStatusLabel(application.status)}
        </StatusBadge>
      </div>

      <div className="space-y-1 text-[14px] font-medium leading-6 text-[#7f8791]">
        <p>
          {application.applicant.firstName} {application.applicant.lastName ?? ""}
        </p>
        <p>
          Рейтинг {application.applicant.ratingAvg.toFixed(1)} • завершённых смен:{" "}
          {application.applicant.completedAssignmentsCount}
        </p>
        {formatExperienceYears(application.applicant.experienceSummary) ? (
          <p>Опыт: {formatExperienceYears(application.applicant.experienceSummary)}</p>
        ) : null}
        <p>Скоринг кандидата: {application.score} / 100</p>
        <p>Отклик от {formatDate(application.createdAt)}</p>
        {application.assignment ? (
          <p>
            Статус назначения:{" "}
            {application.assignment.status === "COMPLETED"
              ? "смена завершена"
              : "исполнитель подтверждён"}
          </p>
        ) : null}
      </div>

      {application.message ? (
        <p className="mt-4 rounded-[20px] bg-[#f2f5f8] px-3 py-3 text-[14px] leading-6 text-[#4e5d6c]">
          {application.message}
        </p>
      ) : null}

      {showEmployerBlock ? (
        <div className="mt-4 rounded-[24px] bg-[#f8fbfd] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#dce6f0] text-sm font-semibold text-[#4b5d6f]">
              {employer.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={employer.photoUrl}
                  alt={employerName}
                  className="h-full w-full object-cover"
                />
              ) : (
                employerInitials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-[#a6abb2]">Работодатель</p>
              <p className="truncate text-[15px] font-semibold text-[#101214]">{employerName}</p>
            </div>
            <Link
              href={`/profiles/${employer.id}`}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-medium text-[#1c4f7a] shadow-[inset_0_0_0_1px_rgba(28,79,122,0.18)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Профиль
            </Link>
          </div>
          <StartChatButton peerUserId={employer.id} className="mt-3" />
        </div>
      ) : null}

      {application.assignment ? (
        <div className="mt-4 space-y-3">
          <AssignmentActions
            assignmentId={application.assignment.id}
            assignmentStatus={application.assignment.status}
            reviewSubmitted={application.assignment.workerReviewSubmitted}
            canComplete={false}
            reviewTargetLabel="работодателе"
            reviewPlaceholder="Как прошла смена, всё ли было честно по оплате и условиям?"
          />
          {application.assignment.status === "COMPLETED" ? (
            <p className="text-[13px] text-[#667381]">
              Смена завершена. Можно оставить отзыв о работодателе.
            </p>
          ) : (
            <p className="text-[13px] text-[#667381]">
              После завершения смены здесь появится возможность оставить отзыв о работодателе.
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}
