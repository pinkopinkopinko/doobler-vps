import { PageHeader } from "@/components/layout/page-header";
import { ProfileReviews } from "@/components/profile/profile-reviews";
import { getSessionPayload } from "@/lib/auth/session";
import { demoProfile } from "@/lib/demo-data";
import { getProfile } from "@/server/services/profile-service";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const session = await getSessionPayload();
  const profile = session ? ((await getProfile(session.userId)) ?? demoProfile) : demoProfile;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Рейтинг и отзывы"
        subtitle="После завершённой смены обе стороны могут оставить отзыв и поднять доверие на платформе."
      />

      <ProfileReviews profile={profile} />
    </div>
  );
}
