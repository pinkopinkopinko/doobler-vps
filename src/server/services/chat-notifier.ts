import { getMiniAppUrl } from "@/lib/telegram/bot";

type NotifyArgs = {
  conversationId: string;
  peerTelegramId: string;
  authorDisplayName: string;
  preview: string;
  hasAttachments: boolean;
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPreview(args: NotifyArgs) {
  const clean = args.preview.trim();
  const truncated = clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;

  if (!truncated && args.hasAttachments) {
    return "📷 Изображение";
  }
  if (args.hasAttachments && truncated) {
    return `📷 ${truncated}`;
  }
  return truncated;
}

export async function notifyPeerAboutNewMessage(args: NotifyArgs): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return;
  }

  const appUrl = getMiniAppUrl().replace(/\/home$/, "");
  const chatUrl = `${appUrl}/chats/${args.conversationId}`;
  const previewBody = escapeHtml(buildPreview(args));
  const author = escapeHtml(args.authorDisplayName);

  const text = [
    `💬 <b>${author}</b> оставил(а) вам сообщение.`,
    previewBody ? `\n<i>${previewBody}</i>` : "",
  ].join("");

  const payload = {
    chat_id: args.peerTelegramId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть чат",
            web_app: { url: chatUrl },
          },
        ],
      ],
    },
  };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.warn("[chat-notifier] telegram non-2xx", response.status);
    }
  } catch (error) {
    console.warn("[chat-notifier] telegram fetch failed", error);
  }
}
