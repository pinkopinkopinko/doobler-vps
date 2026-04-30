import { ApplicationsList } from "@/components/applications/applications-list";
import { PageHeader } from "@/components/layout/page-header";
import { ShiftCard } from "@/components/shifts/shift-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionPayload } from "@/lib/auth/session";
import { demoShiftPosts } from "@/lib/demo-data";
import { listApplicationsForEmployer } from "@/server/services/application-service";
import { listMyShiftPosts } from "@/server/services/shift-post-service";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const session = await getSessionPayload();
  const [shifts, applications] = session
    ? await Promise.all([
        listMyShiftPosts(session.userId),
        listApplicationsForEmployer(session.userId),
      ])
    : [demoShiftPosts.slice(0, 2), []];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Мои объявления"
        subtitle="Управляйте активными постами, смотрите кандидатов и закрывайте смены."
      />

      <section className="space-y-4">
        {shifts.length ? (
          shifts.map((shift) => <ShiftCard key={shift.id} shift={shift} />)
        ) : (
          <EmptyState
            title="У вас пока нет объявлений"
            description="Создайте первую смену, чтобы начать получать отклики от сотрудников и подменных работников."
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-[#101214]">
          Кандидаты по вашим объявлениям
        </h2>
        {applications.length ? (
          <ApplicationsList applications={applications} canConfirm />
        ) : (
          <EmptyState
            title="Кандидатов пока нет"
            description="Как только на ваши объявления начнут откликаться сотрудники, они появятся здесь."
          />
        )}
      </section>
    </div>
  );
}
