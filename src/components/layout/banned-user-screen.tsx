import { BrandMark, SplashGradient } from "@/components/layout/splash-frame";

type BannedUserScreenProps = {
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    cityName: string | null;
    district: string | null;
    banReason: string | null;
    bannedAt: string | null;
  };
};

function formatBannedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(firstName: string, lastName: string | null) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.trim();
  return initials || "DB";
}

export function BannedUserScreen({ user }: BannedUserScreenProps) {
  const profileShortId = user.id.slice(-8).toUpperCase();
  const bannedAtLabel = formatBannedAt(user.bannedAt);

  return (
    <SplashGradient>
      <div className="flex flex-1 flex-col px-4 pb-10 pt-10">
        <header className="mb-6 flex flex-col items-center gap-3">
          <BrandMark size={56} opacity={0.65} />
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            Дублер
          </div>
        </header>

        <section className="rounded-[32px] bg-white/95 p-5 shadow-[0_18px_48px_rgba(25,61,109,0.12)] backdrop-blur-sm">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5d9d6] text-lg font-semibold text-[#c44747]">
              {user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoUrl}
                  alt={`${user.firstName} ${user.lastName ?? ""}`.trim()}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(user.firstName, user.lastName)
              )}
            </div>

            <div className="min-w-0">
              <p className="inline-flex rounded-full bg-[#fde7e5] px-3 py-1 text-xs font-semibold text-[#cf534a]">
                Аккаунт заблокирован
              </p>
              <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[#101214]">
                {user.firstName} {user.lastName ?? ""}
              </h1>
              <p className="mt-1 text-[14px] text-[#7f8791]">
                {user.cityName ?? "Город не указан"}
                {user.district ? `, ${user.district}` : ""}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] bg-[#f8fbfd] px-4 py-4 text-[14px] leading-6 text-[#5f6975]">
            <p className="font-semibold text-[#101214]">Доступ к Mini App ограничен</p>
            {user.banReason ? (
              <div className="mt-3 rounded-[18px] bg-[#fde7e5] px-3 py-2">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#cf534a]">
                  Причина блокировки
                </p>
                <p className="mt-1 text-[14px] leading-6 text-[#5f3a37]">{user.banReason}</p>
              </div>
            ) : (
              <p className="mt-2">
                Остальной интерфейс, смены, чаты и действия внутри приложения не загружаются, пока
                блокировка не будет снята в админ-панели.
              </p>
            )}
            {bannedAtLabel ? (
              <p className="mt-3 text-[13px] text-[#7f8791]">Заблокирован: {bannedAtLabel}</p>
            ) : null}
            <p className="mt-3 text-[13px] text-[#7f8791]">ID профиля: #{profileShortId}</p>
          </div>
        </section>
      </div>
    </SplashGradient>
  );
}
