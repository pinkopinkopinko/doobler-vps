import { ReportsList } from "@/components/admin/reports-list";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    riskLevel?: string;
    targetType?: string;
  }>;
};

export default async function AdminReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Жалобы</h2>
        <p className="mt-1 text-sm text-slate-500">
          Отсортированы по уровню риска и дате. Кликайте действия прямо в строке.
        </p>
      </header>

      <ReportsList
        initialStatus={params.status}
        initialRiskLevel={params.riskLevel}
        initialTargetType={params.targetType}
      />
    </div>
  );
}
