"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

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
      className="relative inline-flex h-10 w-[78px] shrink-0 items-center rounded-full bg-white p-1 shadow-[0_12px_28px_rgba(20,27,33,0.08)] transition-colors"
    >
      <span className="pointer-events-none relative z-10 flex h-8 w-full items-center justify-between px-1.5">
        <Sun className="h-4 w-4 text-[#f0a928]" />
        <Moon className="h-4 w-4 text-[#7d8895]" />
      </span>
      <span
        className={`absolute top-1 z-0 h-8 w-8 rounded-full bg-[#3387d1] shadow-[0_6px_14px_rgba(20,27,33,0.18)] transition-transform ${
          isDark ? "translate-x-[38px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}
