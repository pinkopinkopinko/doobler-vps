import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div className="rounded-[28px] bg-white px-5 py-8 text-center shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
      <h3 className="text-[20px] font-semibold tracking-[-0.03em] text-[#101214]">{title}</h3>
      <p className="mt-3 text-[14px] leading-6 text-[#7f8791]">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#3387d1] px-5 text-[14px] font-semibold text-white"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
