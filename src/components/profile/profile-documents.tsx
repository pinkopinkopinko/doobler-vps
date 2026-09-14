import Link from "next/link";
import { ChevronRight, FileText, Mail, ShieldCheck } from "lucide-react";

import { withPlatformPrefix } from "@/lib/routing/platform";

const documentLinks = [
  {
    href: "/offer",
    title: "Публичная оферта",
    description: "Условия сервиса, публикации смен и платных функций.",
    icon: FileText,
  },
  {
    href: "/privacy",
    title: "Политика конфиденциальности",
    description: "Как Дублер обрабатывает и защищает данные.",
    icon: ShieldCheck,
  },
] as const;

export function ProfileDocuments({ hrefPrefix = "" }: { hrefPrefix?: string }) {
  return (
    <section className="rounded-[32px] border border-border bg-card p-4 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="mb-3">
        <h2 className="text-[19px] font-semibold text-foreground">Документы</h2>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          Оферта, правила обработки данных и контакт для юридических вопросов.
        </p>
      </div>

      <div className="grid gap-2">
        {documentLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={withPlatformPrefix(item.href, hrefPrefix)}
              className="flex min-h-16 items-center gap-3 rounded-[24px] border border-border bg-background px-3 py-3 transition active:scale-[0.99]"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-5 text-foreground">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[12px] leading-4 text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      <a
        href="mailto:dooblertech@mail.ru"
        className="mt-2 flex min-h-12 items-center gap-3 rounded-[22px] border border-border bg-muted px-3 py-2 text-[13px] font-semibold text-foreground transition active:scale-[0.99]"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-accent">
          <Mail className="h-4 w-4" />
        </span>
        dooblertech@mail.ru
      </a>
    </section>
  );
}
