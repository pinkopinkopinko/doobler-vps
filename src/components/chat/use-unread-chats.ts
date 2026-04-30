"use client";

import { useEffect, useRef, useState } from "react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";

const POLL_INTERVAL_MS = 30_000;

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useUnreadChats(enabled = true) {
  const [unread, setUnread] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let initialTimeoutRef: ReturnType<typeof setTimeout> | null = null;
    let idleCallbackId: number | null = null;

    if (!enabled) {
      return;
    }

    const load = async () => {
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;

      try {
        const response = await fetchWithTelegramAuth("/api/chats/unread", {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { unread?: number };
        if (!cancelled && typeof payload.unread === "number") {
          setUnread(payload.unread);
        }
      } catch {
        // swallow
      } finally {
        loadingRef.current = false;
      }
    };

    const idleWindow = typeof window !== "undefined" ? (window as IdleWindow) : null;

    if (idleWindow?.requestIdleCallback) {
      idleCallbackId = idleWindow.requestIdleCallback(
        () => {
          if (!cancelled) {
            void load();
          }
        },
        { timeout: 1_200 },
      );
    } else {
      initialTimeoutRef = setTimeout(() => {
        if (!cancelled) {
          void load();
        }
      }, 350);
    }

    timerRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (initialTimeoutRef) {
        clearTimeout(initialTimeoutRef);
      }
      if (idleCallbackId !== null && idleWindow?.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleCallbackId);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled]);

  return enabled ? unread : 0;
}
