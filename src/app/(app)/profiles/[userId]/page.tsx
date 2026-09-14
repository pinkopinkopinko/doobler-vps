import { notFound } from "next/navigation";

import { StartChatButton } from "@/components/chat/start-chat-button";
import { ProfileReviews } from "@/components/profile/profile-reviews";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { ProfileTopBar } from "@/components/profile/profile-top-bar";
import { getCurrentUserRecord } from "@/lib/auth/app-access";
import { getRequestPlatformPrefix } from "@/lib/routing/platform-server";
import { getProfile, redactProfileForViewer } from "@/server/services/profile-service";
import { hasActiveConsent } from "@/server/services/legal-consent-service";

export const dynamic = "force-dynamic";

type PublicProfilePageProps = {
  params: Promise<{ userId: string }>;
};

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { userId } = await params;
  const hrefPrefix = await getRequestPlatformPrefix();
  const backHref = hrefPrefix ? `${hrefPrefix}/shifts` : "/shifts";
  // Переиспользуем cached fetch из (app)/layout → getAppAccessState,
  // чтобы не делать второй SELECT на User для «кто смотрит».
  const record = await getCurrentUserRecord();
  const isSelf = record?.user.id === userId;
  const profileIsShared =
    isSelf || (await hasActiveConsent(userId, "PUBLIC_PROFILE_DISTRIBUTION"));

  if (!profileIsShared) {
    return (
      <div className="space-y-5">
        <ProfileTopBar backHref={backHref} />
        <article className="rounded-[8px] border border-border bg-card p-5 text-[14px] leading-6 text-muted-foreground shadow-[var(--shadow-card)]">
          Для просмотра имени, опыта, рейтинга и отзывов требуется отдельное согласие владельца
          профиля на показ этих сведений.
        </article>
      </div>
    );
  }

  const profile = await getProfile(userId);

  if (!profile) {
    notFound();
  }

  const currentUserId = record?.user.id ?? null;
  // Defense in depth: даже если UI не рендерит phone, не отдаём его в SSR HTML
  // при просмотре чужого профиля, чтобы view-source не светил PII.
  const visibleProfile = redactProfileForViewer(profile, currentUserId);

  // Работник не должен иметь возможности писать владельцу первым (см.
  // ensureConversation в chat-service.ts). Поэтому скрываем кнопку, если
  // peer — владелец, а текущий пользователь — нет. Если у владельца уже
  // открыт чат с работником, работник попадёт в него из списка чатов.
  const viewerRoles = record?.user.roles.map((row) => row.role) ?? [];
  const peerIsOwner = visibleProfile.roles.includes("OWNER");
  const viewerIsOwner = viewerRoles.includes("OWNER");
  const canStartChat = !isSelf && Boolean(record) && !(peerIsOwner && !viewerIsOwner);

  return (
    <div className="space-y-5">
      <ProfileTopBar backHref={backHref} />
      <ProfileSummary profile={visibleProfile} viewMode={isSelf ? "self" : "public"} />
      {canStartChat ? <StartChatButton peerUserId={visibleProfile.id} /> : null}
      <ProfileReviews profile={visibleProfile} />
    </div>
  );
}
