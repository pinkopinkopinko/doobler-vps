import { EmployerVerificationsList } from "@/components/admin/employer-verifications-list";
import { listEmployerVerifications } from "@/server/services/employer-verification-service";

export const dynamic = "force-dynamic";

export default async function AdminVerificationsPage() {
  const employerVerifications = await listEmployerVerifications();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Верификации</h2>
        <p className="mt-1 text-sm text-slate-500">
          Проверка документов, подтверждающих право владельца или управляющего работать с ПВЗ.
        </p>
      </header>

      <EmployerVerificationsList initialItems={employerVerifications} />
    </div>
  );
}
