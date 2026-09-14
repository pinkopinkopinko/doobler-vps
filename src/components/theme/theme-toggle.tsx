"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "doobler-theme";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.tgScheme = mode;
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return document.documentElement.dataset.tgScheme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const nextMode = getInitialTheme();
      setMode(nextMode);
      applyTheme(nextMode);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  function handleToggle() {
    const nextMode = mode === "dark" ? "light" : "dark";
    setMode(nextMode);
    applyTheme(nextMode);
  }

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Включить светлую тему" : "Включить темную тему"}
      aria-pressed={isDark}
      onClick={handleToggle}
      className="relative inline-flex h-10 w-[78px] shrink-0 rounded-full bg-white p-1 shadow-[0_12px_28px_rgba(20,27,33,0.08)] transition-colors"
    >
      {/* Полукапсула: прямоугольник 50% + overflow-hidden у родителя — без «летающего» круга */}
      <span className="relative isolate h-8 w-full overflow-hidden rounded-full">
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-0 w-1/2 bg-[#3387d1] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-transform duration-200 ease-out",
            isDark ? "translate-x-full" : "translate-x-0",
          )}
        />
        <span className="pointer-events-none relative z-10 grid h-8 w-full grid-cols-2 items-stretch">
          <span className="flex items-center justify-center leading-none">
            <Sun className="size-[18px] shrink-0 text-[#f0a928]" strokeWidth={2} aria-hidden />
          </span>
          <span className="flex items-center justify-center leading-none">
            <Moon className="size-[18px] shrink-0 text-[#7d8895]" strokeWidth={2} aria-hidden />
          </span>
        </span>
      </span>
    </button>
  );
}
