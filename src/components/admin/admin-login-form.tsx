"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login,
        password,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Не удалось войти.");
      return;
    }

    startTransition(() => {
      router.replace("/admin");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8"
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Вход в админку</h1>
        <p className="text-sm leading-6 text-slate-500">
          Введите логин и пароль администратора. Telegram-вход для админки больше не обязателен.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Логин</span>
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white"
            placeholder="Введите логин"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white"
            placeholder="Введите пароль"
          />
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-sky-500 px-4 text-base font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Входим..." : "Войти в админку"}
      </button>
    </form>
  );
}
