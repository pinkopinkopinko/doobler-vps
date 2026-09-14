"use client";

import { useEffect } from "react";

export function CursorSpotlight({ selector }: { selector: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;

    const handler = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const card = target.closest<HTMLElement>(selector);
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };

    document.addEventListener("pointermove", handler, { passive: true });
    return () => document.removeEventListener("pointermove", handler);
  }, [selector]);

  return null;
}
