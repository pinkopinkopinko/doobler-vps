import { notFound } from "next/navigation";

import { StartChatButton } from "@/components/chat/start-chat-button";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileReviews } from "@/components/profile/profile-reviews";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getProfile, redactProfileForViewer } from "@/server/services/profile-service";

export const dynamic = "force-dynamic";

type PublicProfilePageProps = {
  params: Promise<{ userId: string }>;
};

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { userId } = await params;
  const [profile, current] = await Promise.all([getProfile(userId), getCurrentUser()]);

  if (!profile) {
    notFound();
  }

  const isSelf = current?.id === profile.id;
  // Defense in depth: даже если UI не рендерит phone, не отдаём его в SSR HTML
  // при просмотре чужого профиля, чтобы view-source не светил PII.
  const visibleProfile = redactProfileForViewer(profile, current?.id ?? null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Профиль сотрудника"
        subtitle="Посмотрите опыт, рейтинг, завершённые смены и отзывы перед подтверждением."
      />
      <ProfileSummary profile={visibleProfile} viewMode={isSelf ? "self" : "public"} />
      {!isSelf && current ? <StartChatButton peerUserId={visibleProfile.id} /> : null}
      <ProfileReviews profile={visibleProfile} />
    </div>
  );
}
