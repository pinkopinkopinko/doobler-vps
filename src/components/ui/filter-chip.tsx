import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FilterChipProps = {
  active?: boolean;
  children: ReactNode;
};

export function FilterChip({ active = false, children }: FilterChipProps) {
  return (
    <div
      className={cn(
        "rounded-full px-3.5 py-2 text-[13px] font-medium",
        active ? "bg-[#3387d1] text-white" : "bg-white text-[#7f8791]",
      )}
    >
      {children}
    </div>
  );
}
