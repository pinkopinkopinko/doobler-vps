"use client";

import { useEffect } from "react";

const TELEGRAM_WEBAPP_SCRIPT_ID = "telegram-webapp-sdk";
const TELEGRAM_WEBAPP_SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js?57";

export function TelegramWebAppScript() {
  useEffect(() => {
    const existingScript = document.getElementById(TELEGRAM_WEBAPP_SCRIPT_ID);
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.id = TELEGRAM_WEBAPP_SCRIPT_ID;
    script.src = TELEGRAM_WEBAPP_SCRIPT_SRC;
    script.async = false;

    document.head.appendChild(script);
  }, []);

  return null;
}
