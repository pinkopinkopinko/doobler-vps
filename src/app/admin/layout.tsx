import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminAccess } from "@/lib/auth/require-admin-access";

export const dynamic = "force-dynamic";

type Props = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: Props) {
  const guard = await requireAdminAccess();

  if (!guard.ok) {
    redirect("/admin-login");
  }

  return <AdminShell user={guard.user} source={guard.source}>{children}</AdminShell>;
}
