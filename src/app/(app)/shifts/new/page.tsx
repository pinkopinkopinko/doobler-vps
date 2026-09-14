import { CreateShiftForm } from "@/components/shifts/create-shift-form";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionPayload } from "@/lib/auth/session";
import { canCreateShiftPosts } from "@/lib/profile-completion";
import { withPlatformPrefix } from "@/lib/routing/platform";
import { getRequestPlatformPrefix } from "@/lib/routing/platform-server";
import { getProfileShell } from "@/server/services/profile-service";

export const dynamic = "force-dynamic";

export default async function NewShiftPage() {
  const session = await getSessionPayload();
  const hrefPrefix = await getRequestPlatformPrefix();
  const profile = session ? await getProfileShell(session.userId) : null;
  const canCreate = canCreateShiftPosts(
    profile?.roles ?? [],
    profile?.employerVerificationStatus ?? null,
  );

  return (
    <div className="space-y-5">
      {canCreate ? (
        <CreateShiftForm />
      ) : (
        <EmptyState
          title="Нужна проверка работодателя"
          description="Создавать смены могут только владельцы или управляющие ПВЗ с подтвержденным документом: договором аренды, скриншотом из приложения управления ПВЗ или другим подтверждением. Загрузите документ в профиле и дождитесь одобрения."
          actionHref={withPlatformPrefix("/profile", hrefPrefix)}
          actionLabel="Открыть профиль"
        />
      )}
    </div>
  );
}
