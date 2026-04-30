import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  urgent: "bg-[#f9e7e5] text-[#df6d64]",
  success: "bg-[#e9f6ef] text-[#42a16d]",
  neutral: "bg-[#f2f5f8] text-[#4e5d6c]",
  danger: "bg-[#df4f5f] text-white",
};

type StatusBadgeProps = {
  children: ReactNode;
  variant?: keyof typeof variants;
};

export function StatusBadge({ children, variant = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium",
        variants[variant],
      )}
    >
      {children}
    </span>
  );
}
