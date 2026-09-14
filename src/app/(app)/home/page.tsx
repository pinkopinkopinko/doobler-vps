import Link from "next/link";
import {
  BellDot,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MapPin,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { BrandMark } from "@/components/layout/splash-frame";
import { ShiftCard } from "@/components/shifts/shift-card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getSessionPayload } from "@/lib/auth/session";
import { canCreateShiftPosts, hasEmployerCapabilities } from "@/lib/profile-completion";
import { withPlatformPrefix } from "@/lib/routing/platform";
import { getRequestPlatformPrefix } from "@/lib/routing/platform-server";
import {
  getUpcomingAssignmentForWorker,
  type UpcomingAssignmentSummary,
} from "@/server/services/application-service";
import { getProfileShell } from "@/server/services/profile-service";
import { listShiftPosts } from "@/server/services/shift-post-service";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function buildShiftWhen(assignment: UpcomingAssignmentSummary) {
  const date = dateFormatter.format(assignment.shiftPost.shiftDate);
  if (assignment.shiftPost.startAt && assignment.shiftPost.endAt) {
    return `${date}, ${timeFormatter.format(assignment.shiftPost.startAt)}–${timeFormatter.format(assignment.shiftPost.endAt)}`;
  }
  if (assignment.shiftPost.startAt) {
    return `${date}, с ${timeFormatter.format(assignment.shiftPost.startAt)}`;
  }
  return date;
}

function buildEmployerName(employer: UpcomingAssignmentSummary["employer"]) {
  const full = `${employer.firstName} ${employer.lastName ?? ""}`.trim();
  return full || (employer.username ? `@${employer.username}` : "работодатель");
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSessionPayload();
  const hrefPrefix = await getRequestPlatformPrefix();
  const profile = session ? await getProfileShell(session.userId) : null;

  if (!profile) {
    return (
      <div className="space-y-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white py-2 pl-2 pr-3.5 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
            <BrandMark size={24} opacity={1} />
            <span className="text-[13px] font-semibold tracking-[-0.02em] text-[#101214]">
              Дублер
            </span>
          </div>
          <ThemeToggle />
        </div>
        <PageHeader
          title="Подмена для ПВЗ"
          subtitle="Профиль ещё не загрузился. Откройте приложение через свежее сообщение бота или обновите страницу."
        />
        <EmptyState
          title="Профиль не найден"
          description="Мы не подставляем демо-профиль вместо вашего аккаунта, чтобы в приложении не появлялись чужие имя и фамилия."
          actionHref={withPlatformPrefix("/profile", hrefPrefix)}
          actionLabel="Открыть профиль"
        />
      </div>
    );
  }

  const roles = profile.roles ?? [];
  const isEmployer = hasEmployerCapabilities(roles);

  // Два независимых запроса — крутим параллельно, чтобы главная грузилась
  // за время одного roundtrip к БД, а не двух.
  const [urgentPosts, upcomingAssignment] = await Promise.all([
    listShiftPosts({
      cityId: profile.cityId ?? null,
      urgentOnly: true,
      limit: 2,
    }),
    session && !isEmployer
      ? getUpcomingAssignmentForWorker(session.userId)
      : Promise.resolve(null),
  ]);

  const primaryStatus = isEmployer ? "Управляет сменами" : "Готов к сменам";

  const heroCards = isEmployer
    ? [
        {
          href: "/posts",
          title: "Мои смены",
          description: "Управление объявлениями, откликами и назначениями",
          className:
            "rounded-[24px] bg-white px-4 py-4 text-[#101214] shadow-[0_12px_28px_rgba(20,27,33,0.08)]",
          titleClassName: "text-[#101214]",
          descriptionClassName: "mt-2 text-[13px] text-[#7f8791]",
        },
        {
          href: "/shifts/new",
          title: "Создать смену",
          description: "Быстро опубликовать срочную замену или вакансию",
          className: "rounded-[24px] bg-[#3387d1] px-4 py-4 text-white",
          titleClassName: "text-white",
          descriptionClassName: "mt-2 text-[13px] text-white/80",
        },
      ]
    : [
        {
          href: "/shifts",
          title: "Найти смену",
          description: "Лента по вашему городу, району и маркетплейсу",
          className:
            "rounded-[24px] bg-white px-4 py-4 text-[#101214] shadow-[0_12px_28px_rgba(20,27,33,0.08)]",
          titleClassName: "text-[#101214]",
          descriptionClassName: "mt-2 text-[13px] text-[#7f8791]",
        },
        {
          href: "/applications",
          title: "Мои отклики",
          description: "Следить за подтверждением и историей смен",
          className: "rounded-[24px] bg-[#3387d1] px-4 py-4 text-white",
          titleClassName: "text-white",
          descriptionClassName: "mt-2 text-[13px] text-white/80",
        },
      ];

  const quickActions = isEmployer
    ? [
        { icon: Zap, title: "Опубликовать срочную смену", href: "/shifts/new" },
        { icon: ClipboardList, title: "Открыть мои объявления", href: "/posts" },
        { icon: ShieldCheck, title: "Рейтинг и отзывы", href: "/reviews" },
        { icon: MapPin, title: "Настроить город и район", href: "/profile" },
      ]
    : [
        { icon: Zap, title: "Открыть ленту смен", href: "/shifts" },
        { icon: Building2, title: "Мои отклики и назначения", href: "/applications" },
        { icon: ShieldCheck, title: "Рейтинг и отзывы", href: "/reviews" },
        { icon: MapPin, title: "Настроить город и район", href: "/profile" },
      ];

  const sectionTitle = isEmployer ? "Срочные смены в вашем городе" : "Срочные смены рядом";
  const canCreatePosts = canCreateShiftPosts(roles, profile.employerVerificationStatus);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{
          top: 80,
          right: -30,
          fontSize: 160,
          fontWeight: 600,
          letterSpacing: "-0.08em",
          color: "rgba(51,135,209,0.06)",
          lineHeight: 1,
        }}
      >
        Дублер
      </div>

      <div className="relative z-[1] space-y-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white py-2 pl-2 pr-3.5 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
            <BrandMark size={24} opacity={1} />
            <span className="text-[13px] font-semibold tracking-[-0.02em] text-[#101214]">
              Дублер
            </span>
            <span className="h-3.5 w-px bg-black/10" />
            <span className="truncate text-[12px] text-[#a6abb2]">
              {profile.cityName ?? "Город не выбран"}
            </span>
          </div>
          <ThemeToggle />
        </div>

        <PageHeader
          title="Подмена для ПВЗ"
          subtitle="Единая лента смен, подработки и вакансий для Ozon, WB, Яндекс Маркета и других точек."
        >
        <div className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)] sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#a6abb2]">
                Ваш профиль
              </p>
              <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-[#101214]">
                {profile.firstName} {profile.lastName}
              </h2>
            </div>
            <StatusBadge variant="success">{primaryStatus}</StatusBadge>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            {heroCards.map((card) => (
              <Link
                key={card.href}
                href={withPlatformPrefix(card.href, hrefPrefix)}
                className={card.className}
              >
                <p
                  className={`text-[16px] font-semibold tracking-[-0.03em] ${card.titleClassName}`}
                >
                  {card.title}
                </p>
                <p className={card.descriptionClassName}>{card.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </PageHeader>

      <section className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)] sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#a6abb2]">
              Быстрые действия
            </p>
            <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-[#101214]">
              Что делаем сегодня?
            </h2>
          </div>
          <BellDot className="h-5 w-5 text-[#3387d1]" />
        </div>

        <div className="grid gap-3">
          {quickActions
            .filter((item) => (item.href === "/shifts/new" ? canCreatePosts : true))
            .map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  href={withPlatformPrefix(item.href, hrefPrefix)}
                  className="flex items-center justify-between rounded-[22px] bg-[#f8fbfd] px-4 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-2xl bg-white p-2 shadow-[0_4px_10px_rgba(20,27,33,0.06)]">
                      <Icon className="h-4 w-4 text-[#3387d1]" />
                    </span>
                    <span className="text-[14px] font-medium text-[#101214]">{item.title}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#a6abb2]" />
                </Link>
              );
            })}
        </div>
      </section>

      {upcomingAssignment ? (
        <section className="rounded-[28px] bg-gradient-to-br from-[#3387d1] to-[#56a3e0] p-5 text-white shadow-[0_18px_36px_rgba(51,135,209,0.32)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/80">
                Спасибо за отклик
              </p>
              <h2 className="mt-1 text-[20px] font-semibold leading-snug tracking-[-0.03em]">
                {buildEmployerName(upcomingAssignment.employer)} ждёт вас{" "}
                {buildShiftWhen(upcomingAssignment).toLowerCase()}
              </h2>
              <p className="mt-2 text-[14px] leading-6 text-white/90">
                {upcomingAssignment.shiftPost.address}
                {upcomingAssignment.shiftPost.district
                  ? ` · ${upcomingAssignment.shiftPost.district}`
                  : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={withPlatformPrefix(`/shifts/${upcomingAssignment.shiftPost.id}`, hrefPrefix)}
                  className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#1c4f8a]"
                >
                  Открыть смену
                </Link>
                <Link
                  href={withPlatformPrefix(`/profiles/${upcomingAssignment.employer.id}`, hrefPrefix)}
                  className="inline-flex items-center rounded-full border border-white/40 bg-white/10 px-4 py-2 text-[13px] font-semibold text-white"
                >
                  Профиль работодателя
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-[#101214]">{sectionTitle}</h2>
          <Link
            href={withPlatformPrefix("/shifts", hrefPrefix)}
            className="shrink-0 text-[14px] text-[#7f8791]"
          >
            Смотреть все
          </Link>
        </div>
        <div className="space-y-4">
          {urgentPosts.length ? (
            urgentPosts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} hrefPrefix={hrefPrefix} />
            ))
          ) : (
            <EmptyState
              title={isEmployer ? "Срочных смен пока нет" : "Рядом пока нет срочных смен"}
              description={
                isEmployer
                  ? "Когда появится срочная потребность в замене, она сразу отобразится здесь. Пока можно открыть все объявления или создать новую смену."
                  : "Сейчас в вашей зоне нет срочных заявок. Откройте полную ленту смен — там могут быть обычные дневные смены и вакансии."
              }
              actionHref={withPlatformPrefix(isEmployer ? "/shifts/new" : "/shifts", hrefPrefix)}
              actionLabel={isEmployer ? "Создать смену" : "Открыть все смены"}
            />
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
