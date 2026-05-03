"use client";

import { useEffect } from "react";

import { prepareTelegramWebApp } from "@/lib/telegram/webapp";

export function TelegramThemeProvider() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let isMounted = true;

    prepareTelegramWebApp().then((nextCleanup) => {
      if (!isMounted) {
        nextCleanup?.();
        return;
      }

      cleanup = nextCleanup;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, []);

  return null;
}
