import { ApplicationCard } from "@/components/applications/application-card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionPayload } from "@/lib/auth/session";
import { getRequestPlatformPrefix } from "@/lib/routing/platform-server";
import { listMyApplications } from "@/server/services/application-service";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const session = await getSessionPayload();
  const hrefPrefix = await getRequestPlatformPrefix();
  const applications = session ? await listMyApplications(session.userId) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Мои отклики"
        subtitle="Следите за статусами, подтверждениями и историями назначений."
      />
      <div className="space-y-4">
        {applications.length ? (
          applications.map((application) => (
            <ApplicationCard key={application.id} application={application} hrefPrefix={hrefPrefix} />
          ))
        ) : (
          <EmptyState
            title="Пока нет откликов"
            description="Откликнитесь на первую смену в ленте, и здесь появится история ваших откликов."
          />
        )}
      </div>
    </div>
  );
}
