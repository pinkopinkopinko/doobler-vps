import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";

import { TelegramWebAppScript } from "@/components/layout/telegram-webapp-script";

import "./globals.css";

const wixMadeforDisplay = localFont({
  variable: "--font-wix-madefor-display",
  src: [
    {
      path: "./fonts/WixMadeforDisplay-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/WixMadeforDisplay-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Дублер",
  description: "Telegram Mini App для поиска смен, подмен и вакансий в ПВЗ маркетплейсов.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${wixMadeforDisplay.variable} h-full`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        <TelegramWebAppScript />
        {children}
      </body>
    </html>
  );
}
