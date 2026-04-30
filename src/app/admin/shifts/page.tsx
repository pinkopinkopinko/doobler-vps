import { ShiftsList } from "@/components/admin/shifts-list";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

export default async function AdminShiftsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Смены</h2>
        <p className="mt-1 text-sm text-slate-500">
          Все публикации. Модератор может закрыть смену с указанием причины.
        </p>
      </header>

      <ShiftsList initialStatus={params.status} initialQuery={params.q} />
    </div>
  );
}
