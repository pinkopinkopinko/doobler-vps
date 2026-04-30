import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { BannedUserScreen } from "@/components/layout/banned-user-screen";
import { TelegramThemeProvider } from "@/components/layout/telegram-theme-provider";
import { getAppAccessState } from "@/lib/auth/app-access";

export default async function MiniAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const access = await getAppAccessState();

  return (
    <>
      <TelegramThemeProvider />
      {access.kind === "banned" ? (
        <BannedUserScreen user={access.user} />
      ) : (
        <AppShell>{children}</AppShell>
      )}
    </>
  );
}
