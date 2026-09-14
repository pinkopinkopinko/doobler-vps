"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CircleUserRound,
  FileText,
  MessageCircle,
  PlusSquare,
  Search,
} from "lucide-react";

import { useUnreadChats } from "@/components/chat/use-unread-chats";
import { useAppSession } from "@/components/layout/app-session-context";
import {
  canCreateShiftPosts,
  isEmployeeRole,
} from "@/lib/profile-completion";
import {
  getPlatformPrefixFromPathname,
  stripPlatformPrefix,
  withPlatformPrefix,
} from "@/lib/routing/platform";
import { cn } from "@/lib/utils";

const items = [
  { href: "/shifts", label: "Смены", icon: Search, roles: "ALL" as const },
  { href: "/shifts/new", label: "Создать", icon: PlusSquare, roles: "OWNER_ONLY" as const },
  { href: "/posts", label: "Мои смены", icon: BriefcaseBusiness, roles: "OWNER_ONLY" as const },
  { href: "/applications", label: "Отклики", icon: FileText, roles: "EMPLOYEE_ONLY" as const },
  { href: "/chats", label: "Чаты", icon: MessageCircle, roles: "ALL" as const },
  { href: "/profile", label: "Профиль", icon: CircleUserRound, roles: "ALL" as const },
];

export function BottomNav() {
  const pathname = usePathname();
  const platformPrefix = getPlatformPrefixFromPathname(pathname);
  const logicalPathname = stripPlatformPrefix(pathname);
  const { roles, employerVerificationStatus } = useAppSession();
  const unread = useUnreadChats(!logicalPathname.startsWith("/chats"));

  const visibleItems = items.filter((item) => {
    if (item.roles === "OWNER_ONLY") {
      return canCreateShiftPosts(roles, employerVerificationStatus);
    }

    if (item.roles === "EMPLOYEE_ONLY") {
      return isEmployeeRole(roles);
    }

    return true;
  });

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-[calc(100vw-20px)] max-w-[430px] -translate-x-1/2 px-1 pb-[calc(10px+env(safe-area-inset-bottom,0px))]">
      <div
        className="grid h-[var(--nav-height)] gap-2 rounded-[26px] border border-[rgba(16,18,20,0.06)] bg-[#ffffff] p-2 shadow-[0_12px_28px_rgba(20,27,33,0.1)]"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item) => {
          const active =
            item.href === "/shifts"
              ? logicalPathname === "/shifts" ||
                (logicalPathname.startsWith("/shifts/") && logicalPathname !== "/shifts/new")
              : item.href === "/posts"
                ? logicalPathname === "/posts" || logicalPathname.startsWith("/posts/")
                : logicalPathname === item.href ||
                  logicalPathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const badge = item.href === "/chats" && unread > 0 ? unread : 0;

          return (
            <Link
              key={item.href}
              href={withPlatformPrefix(item.href, platformPrefix)}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[20px] px-1 text-[10px] font-medium transition",
                active ? "bg-[#3387d1]" : "hover:bg-[#f2f5f8]",
              )}
            >
              <Icon
                className={cn("h-5 w-5 shrink-0", active ? "text-white" : "text-[#7d8895]")}
              />
              <span className={cn("truncate", active ? "text-white" : "text-[#5f6975]")}>
                {item.label}
              </span>
              {badge > 0 ? (
                <span className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
