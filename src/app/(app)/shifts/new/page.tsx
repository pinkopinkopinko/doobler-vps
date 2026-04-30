import { CreateShiftForm } from "@/components/shifts/create-shift-form";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionPayload } from "@/lib/auth/session";
import { demoProfile } from "@/lib/demo-data";
import { canCreateShiftPosts } from "@/lib/profile-completion";
import { getProfileShell } from "@/server/services/profile-service";

export const dynamic = "force-dynamic";

export default async function NewShiftPage() {
  const session = await getSessionPayload();
  const profile = session ? ((await getProfileShell(session.userId)) ?? demoProfile) : demoProfile;
  const canCreate = canCreateShiftPosts(profile.roles ?? []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Создать объявление"
        subtitle="Минимум полей, чтобы работодатель мог закрыть смену за 30–60 секунд."
      />

      {canCreate ? (
        <CreateShiftForm />
      ) : (
        <EmptyState
          title="Создание смен доступно только владельцу или управляющему ПВЗ"
          description="Сотрудник и подменный работник здесь ищут смены и откликаются на объявления. Для поиска используйте раздел «Смены»."
        />
      )}
    </div>
  );
}
