"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Search, ShieldAlert, ShieldCheck } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type UserHit = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  photoUrl: string | null;
  cityName: string | null;
  isBanned: boolean;
  isActive: boolean;
  banReason: string | null;
  bannedAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedAssignmentsCount: number;
  roles: string[];
  lastActiveAt: string;
};

export function UserSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [results, setResults] = useState<UserHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setError(null);
    setResults(null);

    if (!trimmed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithTelegramAuth(
        `/api/admin/users/search?q=${encodeURIComponent(trimmed)}&limit=30`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось выполнить поиск.");
        return;
      }

      const payload = (await response.json()) as { users: UserHit[] };
      setResults(payload.users);
    } catch (err) {
      console.error("[admin] user search", err);
      setError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!submitted) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void runSearch(submitted);
    });
    return () => {
      cancelled = true;
    };
  }, [submitted, runSearch]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = query.trim();
    setSubmitted(next);

    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    router.replace(`/admin/users${params.size ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-slate-400"
      >
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="@username, Telegram ID, телефон, UUID"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          autoFocus
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Ищем…" : "Найти"}
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Ищем пользователей…
        </div>
      ) : null}

      {!loading && results && results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          По запросу «{submitted}» ничего не найдено.
        </div>
      ) : null}

      {!loading && results && results.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {results.map((user) => (
            <li key={user.id}>
              <Link
                href={`/admin/users/${user.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar user={user} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">
                        {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                      </span>
                      {user.isBanned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                          <ShieldAlert className="h-3 w-3" /> забанен
                        </span>
                      ) : null}
                      {user.roles.includes("MODERATOR") ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <ShieldCheck className="h-3 w-3" /> moderator
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                      {user.username ? <span>@{user.username}</span> : null}
                      <span>tg:{user.telegramId}</span>
                      {user.cityName ? <span>{user.cityName}</span> : null}
                      <span>
                        ★ {user.ratingAvg.toFixed(1)} · {user.completedAssignmentsCount} смен
                      </span>
                    </div>
                    {user.isBanned && user.banReason ? (
                      <p className="mt-1 truncate text-xs text-rose-700">
                        Причина: {user.banReason}
                      </p>
                    ) : null}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-xs",
                    user.isActive ? "text-emerald-600" : "text-slate-400",
                  )}
                >
                  {user.isActive ? "active" : "inactive"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Avatar({ user }: { user: UserHit }) {
  const initials =
    [user.firstName?.[0], user.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?";

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-700">
      {initials}
    </span>
  );
}
