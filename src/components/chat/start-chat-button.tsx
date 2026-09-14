"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, LoaderCircle, MessageCircle } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import {
  getPlatformPrefixFromPathname,
  withPlatformPrefix,
} from "@/lib/routing/platform";

type Props = {
  peerUserId: string;
  disabled?: boolean;
  className?: string;
};

export function StartChatButton({ peerUserId, disabled, className }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const platformPrefix = getPlatformPrefixFromPathname(pathname);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithTelegramAuth("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerUserId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось открыть чат.");
        return;
      }
      const payload = (await response.json()) as { conversation: { id: string } };
      router.push(withPlatformPrefix(`/chats/${payload.conversation.id}`, platformPrefix));
    } catch (err) {
      console.error("[start-chat]", err);
      setError("Сеть недоступна.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[20px] bg-[#3387d1] px-4 text-[14px] font-medium text-white disabled:bg-[#dfe8f1] disabled:text-[#667381]"
      >
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        Написать в чат
      </button>
      {error ? (
        <p className="mt-2 flex items-start gap-2 rounded-[16px] border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
