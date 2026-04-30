import type { ProfileView } from "@/lib/types";

type ProfileReviewsProps = {
  profile: ProfileView;
};

export function ProfileReviews({ profile }: ProfileReviewsProps) {
  return (
    <section
      className="space-y-3 rounded-[32px] bg-[#eef3f7] p-4 text-[#101214] shadow-[0_12px_28px_rgba(20,27,33,0.08)]"
      style={{ fontFamily: '"Wix Madefor Display", var(--font-plex-sans), sans-serif' }}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[#a6abb2]">Отзывы</p>
          <h3 className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em]">
            Последние оценки
          </h3>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[#7f8791] shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
          {profile.ratingCount} отзывов
        </div>
      </div>

      {profile.recentReviews.length ? (
        <div className="space-y-3">
          {profile.recentReviews.map((review) => (
            <article
              key={review.id}
              className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[16px] font-semibold tracking-[-0.03em]">{review.authorName}</p>
                <span className="rounded-full bg-[#f9e7e5] px-3 py-1 text-xs font-medium text-[#df6d64]">
                  {review.rating}/5
                </span>
              </div>
              <p className="mt-3 text-[14px] font-medium leading-6 text-[#7f8791]">{review.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <article className="rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
          <p className="text-[14px] font-medium leading-6 text-[#7f8791]">
            Пока нет отзывов по завершённым сменам.
          </p>
        </article>
      )}
    </section>
  );
}
