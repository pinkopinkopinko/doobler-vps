"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, MessageSquarePlus } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { ChatAvatar } from "@/components/chat/chat-avatar";

type ConversationRow = {
  id: string;
  lastMessageAt: string;
  peer: {
    id: string;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    isBanned: boolean;
  };
  lastMessage: {
    body: string;
    createdAt: string;
    hasAttachments: boolean;
  } | null;
  unreadCount: number;
};

const formatShort = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});

function formatTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return formatShort.format(date);
}

export function ChatsIndex() {
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithTelegramAuth("/api/chats", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось получить чаты.");
        return;
      }
      const payload = (await response.json()) as { conversations: ConversationRow[] };
      setRows(payload.conversations);
    } catch (err) {
      console.error("[chats-index] reload", err);
      setError("Сеть недоступна.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  if (loading && !rows) {
    return (
      <div className="space-y-3 rounded-[28px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-[24px] bg-[#f8fbfd] px-3 py-3"
          >
            <div className="h-12 w-12 animate-pulse rounded-full bg-[#e7edf3]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-full bg-[#e7edf3]" />
              <div className="h-3 w-48 animate-pulse rounded-full bg-[#eef3f7]" />
            </div>
            <LoaderCircle className="h-4 w-4 animate-spin text-[#9aa5b1]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] bg-[#fff3ef] px-5 py-4 text-sm text-[#c25a4f] shadow-[0_12px_28px_rgba(20,27,33,0.06)]">
        {error}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
        <MessageSquarePlus className="mx-auto h-8 w-8 text-[#a6abb2]" />
        <h3 className="mt-3 text-[16px] font-semibold text-[#101214]">Пока нет чатов</h3>
        <p className="mt-1 text-[13px] text-[#7f8791]">
          Откройте профиль работодателя или кандидата и нажмите «Написать», чтобы начать чат.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/applications"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#3387d1] px-5 text-[14px] font-medium text-white"
          >
            Перейти к откликам
          </Link>
          <Link
            href="/shifts"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#eef3f7] px-5 text-[14px] font-medium text-[#101214]"
          >
            Открыть смены
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="chat-list-card overflow-hidden rounded-[28px] bg-white shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
      {rows.map((row) => {
        const peerName =
          [row.peer.firstName, row.peer.lastName].filter(Boolean).join(" ") ||
          "Пользователь";
        const previewBody = row.lastMessage?.body?.trim() ?? "";
        const preview =
          !previewBody && row.lastMessage?.hasAttachments
            ? "📷 Изображение"
            : row.lastMessage?.hasAttachments && previewBody
              ? `📷 ${previewBody}`
              : previewBody || "Начните диалог";

        return (
          <li key={row.id}>
            <Link
              href={`/chats/${row.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#f8fbfd]"
            >
              <ChatAvatar
                firstName={row.peer.firstName}
                lastName={row.peer.lastName}
                photoUrl={row.peer.photoUrl}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[15px] font-medium text-[#101214]">
                    {peerName}
                    {row.peer.isBanned ? (
                      <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">
                        забанен
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[11px] text-[#a6abb2]">
                    {row.lastMessage
                      ? formatTimestamp(row.lastMessage.createdAt)
                      : formatTimestamp(row.lastMessageAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[13px] text-[#7f8791]">{preview}</p>
              </div>
              {row.unreadCount > 0 ? (
                <span className="ml-2 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#3387d1] px-2 text-[11px] font-semibold text-white">
                  {row.unreadCount > 99 ? "99+" : row.unreadCount}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
