import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  titleSize?: "default" | "compact";
}>;

export function PageHeader({
  title,
  subtitle,
  action,
  titleSize = "default",
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-5">
      <div
        className={cn(
          "mb-4 flex gap-3",
          titleSize === "compact"
            ? "flex-row items-start justify-between"
            : "flex-col sm:flex-row sm:items-start sm:justify-between",
        )}
      >
        <div className="min-w-0">
          <h1
            className={cn(
              "font-semibold leading-none tracking-[-0.05em] text-foreground",
              titleSize === "compact" ? "text-[24px]" : "text-[30px] sm:text-[32px]",
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 max-w-[34rem] text-[14px] leading-6 text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className={cn("shrink-0", titleSize === "default" ? "w-full sm:w-auto" : "")}>
            {action}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
