import { PageHeader } from "@/components/layout/page-header";
import { ProfileReviews } from "@/components/profile/profile-reviews";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionPayload } from "@/lib/auth/session";
import { withPlatformPrefix } from "@/lib/routing/platform";
import { getRequestPlatformPrefix } from "@/lib/routing/platform-server";
import { getProfile } from "@/server/services/profile-service";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const session = await getSessionPayload();
  const hrefPrefix = await getRequestPlatformPrefix();
  const profile = session ? await getProfile(session.userId) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Рейтинг и отзывы"
        subtitle="После завершённой смены обе стороны могут оставить отзыв и поднять доверие на платформе."
      />

      {profile ? (
        <ProfileReviews profile={profile} />
      ) : (
        <EmptyState
          title="Профиль не найден"
          description="Отзывы появятся здесь после загрузки вашего профиля и завершённых смен."
          actionHref={withPlatformPrefix("/profile", hrefPrefix)}
          actionLabel="Открыть профиль"
        />
      )}
    </div>
  );
}
