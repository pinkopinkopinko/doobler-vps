import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminSessionPayload, hasConfiguredAdminCredentials } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getAdminSessionPayload();

  if (session) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        {hasConfiguredAdminCredentials() ? (
          <AdminLoginForm />
        ) : (
          <div className="w-full rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <h1 className="text-2xl font-semibold tracking-tight">Админ-вход не настроен</h1>
            <p className="mt-3 text-sm leading-6 text-amber-800">
              Добавьте `ADMIN_LOGIN` и `ADMIN_PASSWORD` в `.env.local`, затем перезапустите сервер.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
