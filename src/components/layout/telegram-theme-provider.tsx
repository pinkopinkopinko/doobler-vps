"use client";

import { useEffect } from "react";

import { prepareTelegramWebApp } from "@/lib/telegram/webapp";

export function TelegramThemeProvider() {
  useEffect(() => {
    prepareTelegramWebApp();
  }, []);

  return null;
}
