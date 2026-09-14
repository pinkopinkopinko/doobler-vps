"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  LoaderCircle,
  SendHorizonal,
  X,
} from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/chat/uploads";
import {
  getPlatformPrefixFromPathname,
  withPlatformPrefix,
} from "@/lib/routing/platform";
import { formatMoney, formatShiftLocation, formatShiftTimeRange, getMarketplaceLabel } from "@/lib/utils";

type Peer = {
  id: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  isBanned: boolean;
} | null;

type Attachment = {
  id: string;
  mediaId: string;
};

type Message = {
  id: string;
  body: string;
  authorUserId: string;
  createdAt: string;
  attachments: Attachment[];
};

type ActiveShift = {
  id: string;
  assignmentId: string;
  title: string;
  marketplace: string;
  status: "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW" | "CANCELLED" | "DISPUTED";
  cityName: string | null;
  district: string;
  address: string;
  shiftDate: string;
  startAt: string | null;
  endAt: string | null;
  paymentAmountRub: number;
  completedAt: string | null;
};

type PendingUpload = {
  clientId: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "ready" | "error";
  mediaId?: string;
  errorMessage?: string;
};

type Props = {
  conversationId: string;
  currentUserId: string;
  peer: Peer;
  activeShift: ActiveShift | null;
};

const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const shiftDateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

function groupByDay(messages: Message[]) {
  type Day = { key: string; label: string; messages: Message[] };
  const groups: Day[] = [];
  for (const message of messages) {
    const date = new Date(message.createdAt);
    const key = date.toISOString().slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.messages.push(message);
    } else {
      groups.push({ key, label: dateFormat.format(date), messages: [message] });
    }
  }
  return groups;
}

function areMessagesEqual(left: Message[], right: Message[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftMessage = left[index];
    const rightMessage = right[index];

    if (
      leftMessage.id !== rightMessage.id ||
      leftMessage.body !== rightMessage.body ||
      leftMessage.attachments.length !== rightMessage.attachments.length
    ) {
      return false;
    }

    for (let attachmentIndex = 0; attachmentIndex < leftMessage.attachments.length; attachmentIndex += 1) {
      const leftAttachment = leftMessage.attachments[attachmentIndex];
      const rightAttachment = rightMessage.attachments[attachmentIndex];

      if (
        leftAttachment.id !== rightAttachment.id ||
        leftAttachment.mediaId !== rightAttachment.mediaId
      ) {
        return false;
      }
    }
  }

  return true;
}

export function ChatConversation({
  conversationId,
  currentUserId,
  peer,
  activeShift,
}: Props) {
  const pathname = usePathname();
  const platformPrefix = getPlatformPrefixFromPathname(pathname);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const openLightbox = useCallback((src: string) => setLightboxSrc(src), []);
  const closeLightbox = useCallback(() => setLightboxSrc(null), []);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const peerName = useMemo(() => {
    if (!peer) return "Чат";
    return [peer.firstName, peer.lastName].filter(Boolean).join(" ") || "Чат";
  }, [peer]);

  // Полный ребилд истории (initial-load или ручной refresh). Заменяет
  // текущее состояние целиком и сохраняет id последнего сообщения, чтобы
  // дальше polling шёл инкрементально.
  const loadInitial = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    try {
      const response = await fetchWithTelegramAuth(
        `/api/chats/${conversationId}/messages?limit=80`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось получить сообщения.");
        return;
      }
      const payload = (await response.json()) as { messages: Message[] };
      setMessages((current) =>
        areMessagesEqual(current, payload.messages) ? current : payload.messages,
      );
      setError(null);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [conversationId]);

  // Инкрементальный poll: спрашиваем у сервера только сообщения новее
  // последнего известного нам id. В тихом чате это возвращает пустой
  // массив (ещё дешевле — после v82 это просто два index-scan по
  // (conversationId, createdAt, id)). Дозаписываем результат к
  // существующему хвосту с дедупом по id, чтобы не сломать порядок при
  // оптимистичной отправке (отправитель сам уже добавил своё сообщение
  // в state до того, как poll увидел его).
  const loadIncremental = useCallback(
    async (sinceId: string) => {
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;

      try {
        const response = await fetchWithTelegramAuth(
          `/api/chats/${conversationId}/messages?sinceId=${encodeURIComponent(sinceId)}&limit=80`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          // Не показываем ошибку в UI на тиках — пользователь и так
          // увидит «нет новых сообщений», а на следующем тике мы
          // попробуем снова. Только если что-то совсем сломается —
          // initial-load на возврате в фокус разрулит.
          return;
        }
        const payload = (await response.json()) as { messages: Message[] };
        if (payload.messages.length === 0) {
          return;
        }
        setMessages((current) => {
          const known = new Set(current.map((m) => m.id));
          const fresh = payload.messages.filter((m) => !known.has(m.id));
          if (fresh.length === 0) {
            return current;
          }
          return [...current, ...fresh];
        });
        setError(null);
      } finally {
        loadingRef.current = false;
      }
    },
    [conversationId],
  );

  const markRead = useCallback(() => {
    void fetchWithTelegramAuth(`/api/chats/${conversationId}/read`, {
      method: "POST",
    }).catch(() => undefined);
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const lastId = lastMessageIdRef.current;
      if (lastId) {
        await loadIncremental(lastId);
      } else {
        await loadInitial();
      }
    };

    queueMicrotask(() => {
      if (!cancelled) {
        void loadInitial();
      }
    });

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void tick();
    }, 8_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadInitial, loadIncremental]);

  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest && latest.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = latest.id;
      queueMicrotask(() => {
        const container = scrollRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
      markRead();
    }
  }, [messages, markRead]);

  useEffect(() => {
    markRead();
  }, [markRead]);

  useEffect(() => {
    // Чат держим в фиксированной области: блокируем вертикальный скролл страницы
    // и просим Telegram не закрывать Mini App по свайпу.
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousOverscroll = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    type TelegramWebApp = {
      expand?: () => void;
      disableVerticalSwipes?: () => void;
      enableVerticalSwipes?: () => void;
    };
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    tg?.expand?.();
    tg?.disableVerticalSwipes?.();

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousOverscroll;
      tg?.enableVerticalSwipes?.();
    };
  }, []);

  const uploadFile = useCallback(async (file: File, clientId: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("scope", "chat");

    try {
      const response = await fetchWithTelegramAuth("/api/uploads", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setPending((prev) =>
          prev.map((item) =>
            item.clientId === clientId
              ? { ...item, status: "error", errorMessage: payload?.error ?? "Ошибка загрузки." }
              : item,
          ),
        );
        return;
      }
      const payload = (await response.json()) as { media: { id: string } };
      setPending((prev) =>
        prev.map((item) =>
          item.clientId === clientId
            ? { ...item, status: "ready", mediaId: payload.media.id }
            : item,
        ),
      );
    } catch (err) {
      console.error("[chat] upload failed", err);
      setPending((prev) =>
        prev.map((item) =>
          item.clientId === clientId
            ? { ...item, status: "error", errorMessage: "Сеть недоступна." }
            : item,
        ),
      );
    }
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";

      if (files.length === 0) return;

      const newPendings: PendingUpload[] = [];
      for (const file of files) {
        if (pending.length + newPendings.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
          setError(`Можно прикрепить не больше ${MAX_ATTACHMENTS_PER_MESSAGE} файлов за раз.`);
          break;
        }
        const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        newPendings.push({
          clientId,
          file,
          previewUrl: URL.createObjectURL(file),
          status: "uploading",
        });
      }

      if (newPendings.length === 0) return;
      setPending((prev) => [...prev, ...newPendings]);

      for (const item of newPendings) {
        void uploadFile(item.file, item.clientId);
      }
    },
    [pending.length, uploadFile],
  );

  const removePending = useCallback((clientId: string) => {
    setPending((prev) => {
      const target = prev.find((item) => item.clientId === clientId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.clientId !== clientId);
    });
  }, []);

  const clearPendingUrls = useCallback((items: PendingUpload[]) => {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }, []);

  const canSend =
    !sending &&
    (body.trim().length > 0 || pending.some((item) => item.status === "ready")) &&
    !pending.some((item) => item.status === "uploading") &&
    !peer?.isBanned;

  const submit = useCallback(async () => {
    if (!canSend) return;
    const text = body.trim();
    const attachmentMediaIds = pending
      .filter((item): item is PendingUpload & { mediaId: string } => item.status === "ready" && Boolean(item.mediaId))
      .map((item) => item.mediaId);

    setSending(true);
    setError(null);
    try {
      const response = await fetchWithTelegramAuth(`/api/chats/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, attachmentMediaIds }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Не удалось отправить сообщение.");
        return;
      }
      const payload = (await response.json()) as { message: Message };
      setMessages((prev) => [...prev, payload.message]);
      setBody("");
      clearPendingUrls(pending);
      setPending([]);
    } catch (err) {
      console.error("[chat] send failed", err);
      setError("Сеть недоступна.");
    } finally {
      setSending(false);
    }
  }, [
    body,
    canSend,
    clearPendingUrls,
    conversationId,
    pending,
    setBody,
    setError,
    setMessages,
    setPending,
    setSending,
  ]);

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  return (
    <section className="flex h-[calc(100dvh_-_var(--nav-height)_-_118px_-_env(safe-area-inset-bottom,0px))] min-h-[520px] max-h-[760px] flex-col gap-3 pb-[86px]">
      <header className="chat-conversation-header shrink-0 rounded-[30px] bg-white px-4 py-3 shadow-[0_14px_34px_rgba(20,27,33,0.08)]">
        <div className="flex items-center gap-3">
        <Link
          href={withPlatformPrefix("/chats", platformPrefix)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c9d3dd] bg-[#e8edf2] text-[#101214] shadow-[0_2px_8px_rgba(16,18,20,0.08)]"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5 text-[#101214]" strokeWidth={3.2} />
        </Link>
        {peer ? (
          <Link
            href={withPlatformPrefix(`/profiles/${peer.id}`, platformPrefix)}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <ChatAvatar
              firstName={peer.firstName}
              lastName={peer.lastName}
              photoUrl={peer.photoUrl}
              size="md"
            />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium text-[#101214]">{peerName}</div>
              <div className="truncate text-[12px] text-[#667381]">
                Профиль собеседника
                {peer.isBanned ? (
                  <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">
                    забанен
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        ) : (
          <span className="truncate text-[15px] font-medium text-[#101214]">{peerName}</span>
        )}
        </div>
      </header>

      {activeShift ? <ActiveShiftCard shift={activeShift} hrefPrefix={platformPrefix} /> : null}

      <div
        ref={scrollRef}
        className="chat-messages-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-28 pt-4"
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#7f8791]">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Загружаем сообщения…
          </div>
        ) : grouped.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#7f8791]">
            Сообщений пока нет — напишите первым.
          </p>
        ) : (
          grouped.map((day) => (
            <div key={day.key} className="space-y-2">
              <DayLabel label={day.label} date={new Date(day.key)} />
              {day.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isMine={message.authorUserId === currentUserId}
                  onOpenAttachment={openLightbox}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {error ? (
        <div className="shrink-0 rounded-[20px] border border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="fixed bottom-[calc(var(--nav-height)+24px+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex w-[calc(100vw-40px)] max-w-[390px] -translate-x-1/2 gap-2 overflow-x-auto rounded-[24px] border border-[#eef1f4] bg-white px-4 py-2 shadow-[0_10px_26px_rgba(20,27,33,0.06)]">
          {pending.map((item) => (
            <div
              key={item.clientId}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#f2f5f8]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              {item.status === "uploading" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                </span>
              ) : null}
              {item.status === "error" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-rose-600/70 text-[10px] font-medium text-white">
                  ошибка
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => removePending(item.clientId)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[#101214]"
                aria-label="Удалить"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <form
        className="chat-composer fixed bottom-[calc(var(--nav-height)+12px+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex w-[calc(100vw-28px)] max-w-[402px] -translate-x-1/2 items-end gap-2 rounded-[30px] bg-white px-3 py-2 shadow-[0_16px_36px_rgba(20,27,33,0.14)]"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f2f5f8] text-[#3a4352]"
          aria-label="Прикрепить фото"
          disabled={pending.length >= MAX_ATTACHMENTS_PER_MESSAGE}
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={peer?.isBanned ? "Пользователь заблокирован" : "Написать сообщение…"}
          rows={1}
          disabled={peer?.isBanned}
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-[20px] border border-[#e3e8ed] bg-white px-4 py-2 text-[14px] text-[#101214] focus:border-[#3387d1] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3387d1] text-white disabled:bg-[#c9d3dc]"
          aria-label="Отправить"
        >
          {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
        </button>
      </form>

      <Lightbox src={lightboxSrc} onClose={closeLightbox} />
    </section>
  );
}

function ActiveShiftCard({ shift, hrefPrefix = "" }: { shift: ActiveShift; hrefPrefix?: string }) {
  const date = shiftDateFormat.format(new Date(shift.shiftDate));
  const time = formatShiftTimeRange(shift.startAt, shift.endAt);
  const location = formatShiftLocation(shift.cityName, shift.district, shift.address);
  const marketplace = getMarketplaceLabel(shift.marketplace);

  return (
    <Link
      href={withPlatformPrefix(`/shifts/${shift.id}`, hrefPrefix)}
      className="chat-shift-context block shrink-0 rounded-[24px] bg-[#dff4e9]/75 px-4 py-3 text-[#24634d]"
    >
      <p className="truncate text-[14px] font-semibold leading-5 text-[#163f31]">
        {marketplace} · {date}
        {time ? `, ${time}` : ""}
      </p>
      <p className="mt-1 truncate text-[12px] leading-4 text-[#2d755b]">
        {location ? `${location} · ` : ""}
        ставка {formatMoney(shift.paymentAmountRub)}
      </p>
    </Link>
  );
}

function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-[92vh] max-w-[92vw] rounded-[12px] object-contain"
        onClick={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+16px)] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
        aria-label="Закрыть"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

const DayLabel = memo(function DayLabel({ label }: { label: string; date: Date }) {
  return (
    <div className="flex justify-center">
      <span className="rounded-full bg-white px-3 py-0.5 text-[11px] text-[#7f8791] shadow-sm">
        {label}
      </span>
    </div>
  );
});

type BubbleProps = {
  message: Message;
  isMine: boolean;
  onOpenAttachment: (src: string) => void;
};

const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
  onOpenAttachment,
}: BubbleProps) {
  const time = timeFormat.format(new Date(message.createdAt));
  const bodyClasses = isMine
    ? "bg-[#3387d1] text-white"
    : "bg-white text-[#101214]";

  const hasAttachments = message.attachments.length > 0;

  return (
    <div className={isMine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`${
          hasAttachments ? "w-[min(72vw,260px)] p-1.5" : "min-w-[3rem] px-3.5 py-2"
        } max-w-[82%] rounded-2xl text-[14px] leading-snug shadow-[0_8px_20px_rgba(20,27,33,0.07)] ${bodyClasses}`}
      >
        {hasAttachments ? (
          <div
            className={`grid gap-0.5 ${
              message.attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"
            } overflow-hidden rounded-[12px]`}
          >
            {message.attachments.map((attachment) => (
              <ChatAttachmentImage
                key={attachment.id}
                attachment={attachment}
                isMulti={message.attachments.length > 1}
                onOpen={onOpenAttachment}
              />
            ))}
          </div>
        ) : null}
        <div className={hasAttachments ? "px-2 pb-0.5 pt-1.5" : ""}>
          {message.body ? (
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {message.body}
            </p>
          ) : null}
          <span
            className={`mt-1 block text-right text-[10px] ${
              isMine ? "text-white/75" : "text-[#a6abb2]"
            }`}
          >
            {time}
          </span>
        </div>
      </div>
    </div>
  );
});

function ChatAttachmentImage({
  attachment,
  isMulti,
  onOpen,
}: {
  attachment: Attachment;
  isMulti: boolean;
  onOpen: (src: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const src = `/api/uploads/${attachment.mediaId}`;

  // Резервируем место под картинку, чтобы при загрузке лента сообщений
  // не «лесенкой» прыгала вниз: для одиночных вложений берём 4/3, для
  // нескольких — квадрат (чтобы плотно ложились в 2-колоночный грид).
  const aspectRatio = isMulti ? "1 / 1" : "4 / 3";

  return (
    <button
      type="button"
      onClick={() => onOpen(src)}
      className="relative block w-full overflow-hidden bg-[#e3e9ef] focus:outline-none focus:ring-2 focus:ring-white/60"
      style={{ aspectRatio }}
      aria-label="Открыть изображение"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#e3e9ef] via-[#eef3f7] to-[#e3e9ef]" />
      ) : null}
    </button>
  );
}
