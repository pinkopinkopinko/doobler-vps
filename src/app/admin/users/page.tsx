import { UserSearch } from "@/components/admin/user-search";

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Пользователи</h2>
        <p className="mt-1 text-sm text-slate-500">
          Поиск по <code className="rounded bg-slate-100 px-1">@username</code>,
          Telegram ID, телефону, имени или UUID.
        </p>
      </header>

      <UserSearch />
    </div>
  );
}
