import Link from "next/link";
import { AlertTriangle, CalendarClock, Flag, ShieldCheck, UserX, Users } from "lucide-react";

import { getAdminStats } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone: "neutral" | "warning" | "danger" | "success";
  href?: string;
}) {
  const toneClass = {
    neutral: "bg-slate-100 text-slate-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    success: "bg-emerald-100 text-emerald-700",
  }[tone];

  const content = (
    <div className="flex h-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:border-slate-300">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
      </div>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export default async function AdminDashboardPage() {
  let stats: Awaited<ReturnType<typeof getAdminStats>> | null = null;
  let error: string | null = null;

  try {
    stats = await getAdminStats();
  } catch (err) {
    console.error("[admin] dashboard stats", err);
    error = "Не удалось загрузить статистику. Проверьте подключение к БД.";
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Обзор</h2>
        <p className="mt-1 text-sm text-slate-500">
          Сводка по пользователям, сменам, жалобам и модерации за всё время.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {stats ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Пользователи"
              value={stats.totalUsers}
              icon={Users}
              tone="neutral"
              href="/admin/users"
            />
            <StatCard
              label="Заблокировано"
              value={stats.bannedUsers}
              icon={UserX}
              tone="danger"
              href="/admin/users"
            />
            <StatCard
              label="Модераторов"
              value={stats.moderatorCount}
              icon={ShieldCheck}
              tone="success"
            />
            <StatCard
              label="Опубликовано смен"
              value={stats.activeShifts}
              icon={CalendarClock}
              tone="neutral"
              href="/admin/shifts"
            />
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Срочные смены"
              value={stats.urgentShifts}
              icon={AlertTriangle}
              tone="warning"
              href="/admin/shifts"
            />
            <StatCard
              label="Открытых жалоб"
              value={stats.openReports}
              icon={Flag}
              tone="warning"
              href="/admin/reports"
            />
            <StatCard
              label="Открытых HIGH-жалоб"
              value={stats.highRiskOpenReports}
              icon={Flag}
              tone="danger"
              href="/admin/reports?riskLevel=HIGH"
            />
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Шорткаты</h3>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <li>
            <Link
              href="/admin/users"
              className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">Найти пользователя</span>
              <span className="block text-xs text-slate-500">
                Поиск по @username, Telegram ID, телефону или имени
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/admin/reports?status=OPEN"
              className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">Открытые жалобы</span>
              <span className="block text-xs text-slate-500">
                Отсортированы по риску, затем по дате
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/admin/shifts?status=PUBLISHED"
              className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">Активные смены</span>
              <span className="block text-xs text-slate-500">Фильтр: только PUBLISHED</span>
            </Link>
          </li>
          <li>
            <Link
              href="/admin/audit"
              className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">Журнал действий</span>
              <span className="block text-xs text-slate-500">
                Все модераторские мутации со ссылкой на сущность
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
