"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import {
  clearManualThemeOverride,
  getCurrentTheme,
  setManualThemeOverride,
  type ThemeMode,
} from "@/lib/telegram/webapp";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [source, setSource] = useState("device");

  useEffect(() => {
    function syncFromDocument() {
      setMode(getCurrentTheme());
      setSource(document.documentElement.dataset.themeSource ?? "device");
    }

    syncFromDocument();
    window.addEventListener("doobler-theme-applied", syncFromDocument);

    return () => {
      window.removeEventListener("doobler-theme-applied", syncFromDocument);
    };
  }, []);

  function handleToggle() {
    setManualThemeOverride(mode === "dark" ? "light" : "dark");
  }

  function handleResetToDevice() {
    clearManualThemeOverride();
  }

  const isDark = mode === "dark";
  const isAuto = source === "device";

  return (
    <button
      type="button"
      aria-label={
        isDark
          ? "Переключить на светлую тему. Двойное нажатие вернет авто-тему устройства."
          : "Переключить на темную тему. Двойное нажатие вернет авто-тему устройства."
      }
      aria-pressed={isDark}
      onClick={handleToggle}
      onDoubleClick={handleResetToDevice}
      title={isAuto ? "Тема следует устройству" : "Двойной клик: снова следовать теме устройства"}
      className="relative inline-flex h-10 w-[78px] shrink-0 items-center rounded-full bg-white p-1 shadow-[0_12px_28px_rgba(20,27,33,0.08)] transition-colors"
    >
      <span className="pointer-events-none relative z-10 flex h-8 w-full items-center justify-between px-1.5">
        <Sun className="h-4 w-4 text-[#f0a928]" />
        <Moon className="h-4 w-4 text-[#7d8895]" />
      </span>
      {isAuto ? (
        <span className="pointer-events-none absolute left-1/2 top-1 z-20 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#42a16d] shadow-[0_0_0_2px_rgba(66,161,109,0.16)]" />
      ) : null}
      <span
        className={`absolute top-1 z-0 h-8 w-8 rounded-full bg-[#3387d1] shadow-[0_6px_14px_rgba(20,27,33,0.18)] transition-transform ${
          isDark ? "translate-x-[38px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}
