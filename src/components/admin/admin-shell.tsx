"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import {
  ClipboardList,
  Flag,
  Gauge,
  IdCard,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: string | null;
  telegramId: string | null;
  firstName: string;
  lastName: string | null;
  username: string | null;
};

const NAV = [
  { href: "/admin", label: "Дашборд", icon: Gauge, exact: true },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/verifications", label: "Верификации", icon: IdCard },
  { href: "/admin/reports", label: "Жалобы", icon: Flag },
  { href: "/admin/shifts", label: "Смены", icon: ClipboardList },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  user,
  source,
  children,
}: PropsWithChildren<{ user: AdminUser; source: "password" | "telegram" }>) {
  const pathname = usePathname();
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.telegramId ||
    "Администратор";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Админ-панель · Дублер</h1>
              <p className="text-xs text-slate-500">
                Вы вошли как <span className="font-medium text-slate-700">{displayName}</span>
                {source === "password" ? (
                  <>
                    {" · "}
                    <span className="text-slate-400">логин/пароль</span>
                  </>
                ) : user.username ? (
                  <>
                    {" · "}
                    <span className="text-slate-400">@{user.username}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/shifts"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Вернуться в приложение
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition",
                  active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
