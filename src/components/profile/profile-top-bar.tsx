import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type ProfileTopBarProps = {
  backHref: string;
  title?: string;
};

export function ProfileTopBar({ backHref, title = "Профиль" }: ProfileTopBarProps) {
  return (
    <header className="rounded-[24px] border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex min-h-10 items-center gap-3">
        <Link
          href={backHref}
          aria-label="Назад"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-card-foreground transition hover:bg-accent-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="min-w-0 truncate text-[20px] font-semibold leading-none tracking-[-0.03em] text-card-foreground">
          {title}
        </h1>
      </div>
    </header>
  );
}
