import Link from "next/link";

import { OwnerManagerPanel } from "@/components/profile/owner-manager-panel";
import {
  hasEmployerCapabilities,
  isEmployeeRole,
  isManagerRole,
  isOwnerRole,
} from "@/lib/profile-completion";
import type { ProfileView } from "@/lib/types";
import { formatExperienceYears, getMarketplaceLabel } from "@/lib/utils";

type ProfileSummaryProps = {
  profile: ProfileView;
  /**
   * "self"   — рендеримся в /profile, показываем приватные данные владельца
   *            (код ПВЗ, панель управляющих и т.п.).
   * "public" — рендеримся в /profiles/[userId]; для владельцев скрываем все
   *            упоминания их ПВЗ — только репутация и завершённые смены.
   */
  viewMode?: "self" | "public";
};

function getInitials(profile: ProfileView) {
  const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.trim();
  return initials || "PV";
}

function getRoleLabel(profile: ProfileView) {
  if (profile.roles.includes("MANAGER")) {
    return "Управляющий";
  }

  if (profile.roles.includes("OWNER")) {
    return "Владелец";
  }

  if (profile.roles.includes("TEMP_WORKER")) {
    return "Подменный сотрудник";
  }

  return "Сотрудник";
}

function getVerificationLabel(profile: ProfileView) {
  return profile.verificationStatus === "APPROVED" ? "Проверенный" : "Без верификации";
}

export function ProfileSummary({ profile, viewMode = "self" }: ProfileSummaryProps) {
  const isPublic = viewMode === "public";
  const isOwner = isOwnerRole(profile.roles);
  const canManageShifts = hasEmployerCapabilities(profile.roles);
  const managerOnly = isManagerRole(profile.roles) && !isOwner;
  const initials = getInitials(profile);
  const roleLabel = getRoleLabel(profile);
  const verificationLabel = getVerificationLabel(profile);
  const profileShortId = profile.id.slice(-8).toUpperCase();
  const experienceLabel = formatExperienceYears(profile.experienceSummary);
  const marketplaceLabel =
    profile.marketplaces.length > 0 ? profile.marketplaces.join(" • ") : "Не указан";

  // В публичном просмотре владельца показываем только его репутацию
  // и завершённые смены — без блока «Мой пункт», панели управляющих и т.п.
  const showOwnerWorkspace = canManageShifts && !isPublic;
  const showWorkerPanel = !canManageShifts || isPublic;
  // Блок маркетплейсов — для всех, у кого есть рабочая роль или роль владельца.
  // Для OWNER заголовок «Мои ПВЗ», для остальных «Где могу работать».
  const showMarketplacesBlock = isOwner || isEmployeeRole(profile.roles);
  const marketplacesBlockTitle = isOwner ? "Мои ПВЗ" : "Где могу работать";
  const marketplacesEmptySelf = isOwner
    ? "Откройте «Редактировать» и отметьте маркетплейсы, ПВЗ которых вы держите."
    : "Откройте «Редактировать» и отметьте маркетплейсы, в ПВЗ которых вы готовы выходить.";
  const marketplacesEmptyPublic = isOwner
    ? "Владелец пока не указал маркетплейсы."
    : "Сотрудник пока не выбрал маркетплейсы.";

  return (
    <section
      className="space-y-4 rounded-[32px] bg-[#eef3f7] p-4 text-[#101214] shadow-[0_12px_28px_rgba(20,27,33,0.08)]"
      style={{ fontFamily: '"Wix Madefor Display", var(--font-plex-sans), sans-serif' }}
    >
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex h-8 items-center rounded-full bg-[#3387d1] px-4 text-sm font-medium text-white">
          {roleLabel}
        </span>
        <span className="inline-flex h-8 items-center rounded-full bg-white px-4 text-sm font-medium text-[#101214] shadow-[inset_0_0_0_1px_rgba(16,18,20,0.04)]">
          {verificationLabel}
        </span>
      </div>

      <article className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
        <div className="flex gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#dce6f0] text-lg font-semibold text-[#4b5d6f]">
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoUrl}
                alt={`${profile.firstName} ${profile.lastName ?? ""}`.trim()}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.03em]">
              {profile.firstName} {profile.lastName ?? ""}
            </h2>
            <p className="mt-1.5 text-[14px] font-medium text-[#7f8791]">
              {profile.cityName}
              {profile.district ? ` • ${profile.district}` : ""}
            </p>
            <p className="mt-1 text-[14px] font-medium text-[#7f8791]">
              ID профиля: #{profileShortId}
            </p>
            {experienceLabel ? (
              <p className="mt-1 text-[14px] font-medium text-[#7f8791]">
                Опыт работы: {experienceLabel}
              </p>
            ) : null}
          </div>
        </div>
      </article>

      <div className="grid grid-cols-3 gap-3">
        <article className="rounded-[24px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
          <p className="text-[13px] font-medium text-[#a6abb2]">Рейтинг</p>
          <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em]">
            {profile.ratingAvg.toFixed(1)}
          </p>
        </article>
        <article className="rounded-[24px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
          <p className="text-[13px] font-medium text-[#a6abb2]">Отзывы</p>
          <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em]">
            {profile.ratingCount}
          </p>
        </article>
        <article className="rounded-[24px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
          <p className="text-[13px] font-medium text-[#a6abb2]">Смены</p>
          <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em]">
            {profile.completedAssignmentsCount}
          </p>
        </article>
      </div>

      {showMarketplacesBlock ? (
        <div>
          <h3 className="mb-2 text-[19px] font-semibold tracking-[-0.03em]">
            {marketplacesBlockTitle}
          </h3>
          {profile.marketplaces.length === 0 ? (
            <article className="rounded-[28px] bg-white p-4 text-[14px] text-[#7f8791] shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
              {isPublic ? marketplacesEmptyPublic : marketplacesEmptySelf}
            </article>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {profile.marketplaces.map((code) => (
                <li
                  key={code}
                  className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[14px] font-medium text-[#1c4f7a] shadow-[inset_0_0_0_1px_rgba(28,79,122,0.18),0_8px_18px_rgba(20,27,33,0.06)]"
                >
                  {getMarketplaceLabel(code)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {showOwnerWorkspace ? (
        <>
          <div>
            <h3 className="mb-2 text-[19px] font-semibold tracking-[-0.03em]">
              {managerOnly ? "Рабочая зона управляющего" : "Мой пункт"}
            </h3>
            <article className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-[18px] font-semibold leading-tight tracking-[-0.02em]">
                  {isOwner ? "Карточка владельца" : "Доступ к назначенным ПВЗ"}
                </h4>
                <span className="inline-flex h-7 items-center rounded-full bg-[#f9e7e5] px-3 text-xs font-medium text-[#df6d64]">
                  Активен
                </span>
              </div>

              <div className="mt-4 space-y-1.5 text-[14px] font-medium text-[#7f8791]">
                <p>
                  Локация:{" "}
                  <span className="text-[#101214]">
                    {profile.cityName}
                    {profile.district ? `, ${profile.district}` : ""}
                  </span>
                </p>
                <p>
                  Роль: <span className="text-[#101214]">{roleLabel}</span>
                </p>
                <p>
                  Маркетплейсы: <span className="text-[#101214]">{marketplaceLabel}</span>
                </p>
              </div>
            </article>
          </div>

          <div>
            <h3 className="mb-2 text-[19px] font-semibold tracking-[-0.03em]">Быстрые действия</h3>
            <div className="space-y-3">
              <article className="flex items-center justify-between gap-3 rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
                <div className="min-w-0">
                  <h4 className="text-[17px] font-semibold tracking-[-0.03em]">Создать смену</h4>
                  <p className="mt-1 text-[14px] font-medium text-[#7f8791]">
                    Опубликовать срочную замену за 30-60 секунд
                  </p>
                </div>
                <Link
                  href="/shifts/new"
                  className="inline-flex h-10 shrink-0 items-center rounded-full bg-[#3387d1] px-5 text-[14px] font-medium text-white"
                >
                  Открыть
                </Link>
              </article>

              <article className="flex items-center justify-between gap-3 rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
                <div className="min-w-0">
                  <h4 className="text-[17px] font-semibold tracking-[-0.03em]">Мои смены</h4>
                  <p className="mt-1 text-[14px] font-medium text-[#7f8791]">
                    Кандидаты, подтверждения, закрытие и отзывы
                  </p>
                </div>
                <Link
                  href="/posts"
                  className="inline-flex h-10 shrink-0 items-center rounded-full bg-[#e7edf3] px-5 text-[14px] font-medium !text-[#1c232b]"
                >
                  Смотреть
                </Link>
              </article>

              {managerOnly ? (
                <article className="flex items-center justify-between gap-3 rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
                  <div className="min-w-0">
                    <h4 className="text-[17px] font-semibold tracking-[-0.03em]">Мои отклики</h4>
                    <p className="mt-1 text-[14px] font-medium text-[#7f8791]">
                      Управляющий тоже может откликаться на смены как сотрудник
                    </p>
                  </div>
                  <Link
                    href="/applications"
                    className="inline-flex h-10 shrink-0 items-center rounded-full bg-[#e7edf3] px-5 text-[14px] font-medium !text-[#1c232b]"
                  >
                    Смотреть
                  </Link>
                </article>
              ) : null}
            </div>
          </div>

          {isOwner ? <OwnerManagerPanel /> : null}
        </>
      ) : null}

      {showWorkerPanel ? (
        <>
          <div>
            <h3 className="mb-2 text-[19px] font-semibold tracking-[-0.03em]">Рабочий профиль</h3>
            <article className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
              <div className="space-y-1.5 text-[14px] font-medium text-[#7f8791]">
                <p>
                  Возраст: <span className="text-[#101214]">{profile.age ?? "Не указан"}</span>
                </p>
                <p>
                  Опыт работы:{" "}
                  <span className="text-[#101214]">{experienceLabel ?? "Не указан"}</span>
                </p>
                {profile.bio ? (
                  <p>
                    О себе: <span className="text-[#101214]">{profile.bio}</span>
                  </p>
                ) : null}
              </div>
            </article>
          </div>

          {/* Быстрые действия — только для своего профиля; в публичном просмотре скрываем. */}
          {!isPublic && !canManageShifts ? (
            <div>
              <h3 className="mb-2 text-[19px] font-semibold tracking-[-0.03em]">
                Быстрые действия
              </h3>
              <div className="space-y-3">
                <article className="flex items-center justify-between gap-3 rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
                  <div className="min-w-0">
                    <h4 className="text-[17px] font-semibold tracking-[-0.03em]">Найти смену</h4>
                    <p className="mt-1 text-[14px] font-medium text-[#7f8791]">
                      Смотреть новые заявки по городу и откликаться
                    </p>
                  </div>
                  <Link
                    href="/shifts"
                    className="inline-flex h-10 shrink-0 items-center rounded-full bg-[#3387d1] px-5 text-[14px] font-medium text-white"
                  >
                    Открыть
                  </Link>
                </article>

                <article className="flex items-center justify-between gap-3 rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
                  <div className="min-w-0">
                    <h4 className="text-[17px] font-semibold tracking-[-0.03em]">Мои отклики</h4>
                    <p className="mt-1 text-[14px] font-medium text-[#7f8791]">
                      Следить за подтверждениями и завершёнными сменами
                    </p>
                  </div>
                  <Link
                    href="/applications"
                    className="inline-flex h-10 shrink-0 items-center rounded-full bg-[#e7edf3] px-5 text-[14px] font-medium !text-[#1c232b]"
                  >
                    Смотреть
                  </Link>
                </article>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
