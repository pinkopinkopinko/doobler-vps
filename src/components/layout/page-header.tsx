import type { PropsWithChildren, ReactNode } from "react";

type PageHeaderProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
}>;

export function PageHeader({ title, subtitle, action, children }: PageHeaderProps) {
  return (
    <header className="mb-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold leading-none tracking-[-0.05em] text-[#101214] sm:text-[32px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 max-w-[34rem] text-[14px] leading-6 text-[#7f8791]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}
