import { AuditLogView } from "@/components/admin/audit-log-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ entityType?: string; entityId?: string }>;
};

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Журнал действий</h2>
        <p className="mt-1 text-sm text-slate-500">
          Все модераторские мутации: ban/unban, назначение ролей, отмена смен, разбор жалоб.
        </p>
      </header>

      <AuditLogView
        initialEntityType={params.entityType}
        initialEntityId={params.entityId}
      />
    </div>
  );
}
