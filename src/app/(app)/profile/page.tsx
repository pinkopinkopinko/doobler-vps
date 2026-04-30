import { ProfileEditorPanel } from "@/components/profile/profile-editor-panel";
import { ProfileReviews } from "@/components/profile/profile-reviews";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { getSessionPayload } from "@/lib/auth/session";
import { getProfile } from "@/server/services/profile-service";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSessionPayload();
  // НЕ подставляем demoProfile: пользователь должен видеть СВОИ данные либо
  // явное состояние «профиль не найден», но никак не чужие.
  const profile = session ? await getProfile(session.userId) : null;

  if (!profile) {
    return (
      <div
        className="space-y-4 rounded-[36px] bg-[#eef3f7] p-4 text-[#101214]"
        style={{ fontFamily: '"Wix Madefor Display", var(--font-plex-sans), sans-serif' }}
      >
        <header className="px-1 pt-1">
          <h1 className="text-[28px] font-semibold leading-none tracking-[-0.04em]">Профиль</h1>
        </header>
        <div className="rounded-[28px] bg-white p-5 text-[14px] text-[#7f8791] shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
          <p className="font-semibold text-[#101214]">Не удалось загрузить профиль.</p>
          <p className="mt-2">
            Закройте Mini App и откройте его заново через свежее сообщение бота. Если проблема
            остаётся — попробуйте позже.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-4 rounded-[36px] bg-[#eef3f7] p-4 text-[#101214]"
      style={{ fontFamily: '"Wix Madefor Display", var(--font-plex-sans), sans-serif' }}
    >
      <header className="px-1 pt-1">
        <h1 className="text-[28px] font-semibold leading-none tracking-[-0.04em]">Профиль</h1>
      </header>

      <ProfileSummary profile={profile} />
      <ProfileReviews profile={profile} />
      <ProfileEditorPanel />
    </div>
  );
}
