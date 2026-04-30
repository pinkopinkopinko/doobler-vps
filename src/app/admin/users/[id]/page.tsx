import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { UserDetailActions } from "@/components/admin/user-detail-actions";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";
import { getUserDetails } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const guard = await requireAdminAccess();
  if (!guard.ok) {
    notFound();
  }

  const { id } = await params;
  const user = await getUserDetails(id);

  if (!user) {
    notFound();
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
  const isSelf = guard.user.id ? id === guard.user.id : false;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Назад к поиску
        </Link>
      </div>

      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{displayName}</h2>
            {user.isBanned ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                забанен
              </span>
            ) : null}
            {user.roles.includes("MODERATOR") ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                moderator
              </span>
            ) : null}
            {!user.isActive ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                inactive
              </span>
            ) : null}
          </div>
          {user.isBanned && (user.banReason || user.bannedAt) ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                Причина блокировки
              </p>
              <p className="mt-1 whitespace-pre-wrap">{user.banReason ?? "—"}</p>
              {user.bannedAt ? (
                <p className="mt-1 text-xs text-rose-700">
                  Забанен: {formatDateTime(user.bannedAt)}
                </p>
              ) : null}
            </div>
          ) : null}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
            <Field label="Telegram" value={user.username ? `@${user.username}` : "—"} />
            <Field label="Telegram ID" value={user.telegramId} mono />
            <Field label="UUID" value={user.id} mono />
            <Field label="Телефон" value={user.phone ?? "—"} />
            <Field label="Возраст" value={user.age ? String(user.age) : "—"} />
            <Field label="Город" value={user.cityName ?? "—"} />
            <Field label="Район" value={user.district ?? "—"} />
            <Field label="ПВЗ" value={user.pickupPointCode ?? "—"} />
            <Field
              label="Маркетплейсы"
              value={user.marketplaces.length ? user.marketplaces.join(", ") : "—"}
            />
            <Field label="Последняя активность" value={formatDateTime(user.lastActiveAt)} />
            <Field label="Зарегистрирован" value={formatDateTime(user.createdAt)} />
            <Field
              label="Онбординг"
              value={user.isOnboardingCompleted ? "завершён" : "в процессе"}
            />
            <Field
              label="Рейтинг"
              value={`${user.ratingAvg.toFixed(2)} · ${user.ratingCount} отзывов`}
            />
            <Field label="Завершённых смен" value={String(user.completedAssignmentsCount)} />
            <Field label="Роли" value={user.roles.length ? user.roles.join(", ") : "—"} />
            {user.experienceSummary ? <Field label="Опыт" value={user.experienceSummary} /> : null}
            {user.bio ? <Field label="Bio" value={user.bio} /> : null}
          </dl>
        </div>

        <UserDetailActions
          userId={user.id}
          isBanned={user.isBanned}
          isModerator={user.roles.includes("MODERATOR")}
          isSelf={isSelf}
        />
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Жалобы на этого пользователя ({user.reportsAgainst.length})
        </h3>
        {user.reportsAgainst.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Жалоб нет.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {user.reportsAgainst.map((report) => (
              <li key={report.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{report.reasonCode}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(report.createdAt)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                  <span>статус: {report.status}</span>
                  <span>risk: {report.riskLevel}</span>
                  {report.reporterName ? <span>от: {report.reporterName}</span> : null}
                </div>
                {report.description ? (
                  <p className="mt-1 text-sm text-slate-700">{report.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Жалобы, поданные пользователем ({user.reportsFiled.length})
        </h3>
        {user.reportsFiled.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Ничего не отправлял.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {user.reportsFiled.map((report) => (
              <li key={report.id} className="py-2">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-medium">{report.reasonCode}</span>
                  <span className="text-xs text-slate-500">
                    → {report.targetType}/{report.targetId}
                  </span>
                  <span className="text-xs text-slate-500">статус: {report.status}</span>
                  <span className="text-xs text-slate-400">{formatDateTime(report.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Отклики ({user.recentApplications.length})
        </h3>
        {user.recentApplications.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Пусто.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {user.recentApplications.map((application) => (
              <li key={application.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{application.shiftTitle}</span>
                  <span className="text-xs text-slate-500">{application.status}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {formatDateTime(application.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Смены ({user.recentAssignments.length})
        </h3>
        {user.recentAssignments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Пусто.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {user.recentAssignments.map((assignment) => (
              <li key={assignment.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {assignment.shiftTitle}{" "}
                    <span className="text-xs text-slate-400">({assignment.role})</span>
                  </span>
                  <span className="text-xs text-slate-500">{assignment.status}</span>
                </div>
                {assignment.completedAt ? (
                  <span className="text-xs text-slate-400">
                    завершена: {formatDateTime(assignment.completedAt)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={mono ? "font-mono text-sm text-slate-800" : "text-sm text-slate-800"}>
        {value}
      </dd>
    </div>
  );
}
