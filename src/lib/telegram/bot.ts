import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramChat = {
  id: number;
};

type TelegramFrom = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramContact = {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
};

type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramFrom;
  text?: string;
  contact?: TelegramContact;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

function maskLoginToken(value: string) {
  return value.replace(/([?&]loginToken=)[^&]+/g, "$1<hidden>");
}

function sanitizeTelegramPayload(value: unknown): unknown {
  if (typeof value === "string") {
    return maskLoginToken(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeTelegramPayload);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeTelegramPayload(item)]),
    );
  }

  return value;
}

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  return token;
}

function normalizeTelegramPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return `+${digits}`;
}

export function getMiniAppUrl() {
  const devUrlPath = join(process.cwd(), ".dev-ngrok-url");
  const devNgrokUrl =
    process.env.NODE_ENV !== "production" && existsSync(devUrlPath)
      ? readFileSync(devUrlPath, "utf8").trim()
      : "";
  const appUrl = devNgrokUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/home`;
}

export function getWebhookSecret() {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (explicit) {
    return explicit;
  }
  // Fallback: deterministic from bot token. Acceptable for dev,
  // but production should set TELEGRAM_WEBHOOK_SECRET to a random value.
  const token = getBotToken();
  return `pvz-webhook-${token.slice(-12)}`;
}

async function callTelegramApi<T>(method: string, payload: Record<string, unknown>) {
  const token = getBotToken();
  const startedAt = Date.now();

  console.info("[bot-debug] telegram-api:start", {
    method,
    chatId: payload.chat_id ?? null,
  });

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TelegramApiResponse<T>;

  console.info("[bot-debug] telegram-api:response", {
    method,
    status: response.status,
    ok: data.ok,
    description: data.description ?? null,
    durationMs: Date.now() - startedAt,
    resultPreview:
      data.result && typeof data.result === "object"
        ? {
            message_id:
              "message_id" in data.result
                ? (data.result as { message_id?: unknown }).message_id
                : undefined,
          }
        : null,
  });

  if (!response.ok || !data.ok) {
    console.error("[bot-debug] telegram-api:failed", {
      method,
      status: response.status,
      description: data.description ?? null,
      payload: sanitizeTelegramPayload(payload),
    });
    throw new Error(data.description ?? `Telegram API error on ${method}`);
  }

  return data.result as T;
}

// Plain-text helper. parse_mode НЕ выставляем: если в text попадёт user-input
// (имя пользователя, текст команды, …), HTML-теги отрендерятся как обычный
// текст, а не как кликабельные ссылки/разметка. Для HTML-форматированных
// уведомлений используйте chat-notifier с обязательным escapeHtml.
export async function sendTelegramText(chatId: number | string, text: string) {
  console.info("[bot-debug] send-text", {
    chatId,
    textLength: text.length,
  });

  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
  });
}

export async function sendMiniAppInvite(chatId: number | string, from?: TelegramFrom) {
  const appUrl = getMiniAppUrl();

  console.info("[bot-debug] send-mini-app-invite", {
    chatId,
    appUrl,
    hasLoginToken: false,
    telegramId: from?.id ? String(from.id) : null,
  });

  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text:
      "ПВЗ Подмена уже готов к работе.\n\nОткройте Mini App, чтобы найти смену, опубликовать срочную замену или посмотреть отклики.",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть Mini App",
            web_app: {
              url: appUrl,
            },
          },
        ],
      ],
    },
  });
}

export async function sendPhoneVerificationRequest(chatId: number | string, from?: TelegramFrom) {
  const firstName = from?.first_name?.trim();
  const greeting = firstName ? `${firstName}, ` : "";

  console.info("[bot-debug] send-phone-verification-request", {
    chatId,
    telegramId: from?.id ? String(from.id) : null,
  });

  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text:
      `${greeting}чтобы подтвердить номер телефона в профиле, нажмите кнопку ниже и отправьте контакт из Telegram.` +
      "\n\nМы сохраним номер в анкете и отметим профиль как подтверждённый по телефону.",
    reply_markup: {
      keyboard: [
        [
          {
            text: "Поделиться номером телефона",
            request_contact: true,
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
      input_field_placeholder: "Нажмите кнопку ниже",
    },
  });
}

async function sendPhoneVerificationResult(chatId: number | string, text: string) {
  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: {
      remove_keyboard: true,
    },
  });
}

async function handlePhoneVerificationContact(message: TelegramMessage) {
  const fromId = message.from?.id;
  const contactUserId = message.contact?.user_id;
  const phoneNumber = message.contact?.phone_number ?? "";

  if (!fromId) {
    console.warn("[bot-debug] phone-verification-missing-from", {
      chatId: message.chat.id,
      messageId: message.message_id,
    });

    await sendPhoneVerificationResult(
      message.chat.id,
      "Не удалось определить ваш Telegram-профиль. Откройте Mini App ещё раз и повторите попытку.",
    );

    return { handled: true, action: "phone_verification_missing_from" };
  }

  if (!contactUserId || String(contactUserId) !== String(fromId)) {
    console.warn("[bot-debug] phone-verification-mismatch", {
      chatId: message.chat.id,
      fromId: String(fromId),
      contactUserId: contactUserId ? String(contactUserId) : null,
    });

    await sendPhoneVerificationResult(
      message.chat.id,
      "Подтвердить можно только свой собственный номер. Нажмите кнопку ещё раз и отправьте контакт текущего Telegram-аккаунта.",
    );

    return { handled: true, action: "phone_verification_mismatch" };
  }

  const normalizedPhoneNumber = normalizeTelegramPhoneNumber(phoneNumber);

  if (!normalizedPhoneNumber) {
    await sendPhoneVerificationResult(
      message.chat.id,
      "Не удалось прочитать номер телефона. Попробуйте ещё раз через кнопку подтверждения.",
    );

    return { handled: true, action: "phone_verification_invalid_phone" };
  }

  const user = await prisma.user.findUnique({
    where: {
      telegramId: String(fromId),
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    await sendPhoneVerificationResult(
      message.chat.id,
      "Сначала откройте Mini App, чтобы мы связали Telegram-аккаунт с профилем, а потом повторите подтверждение номера.",
    );

    return { handled: true, action: "phone_verification_user_not_found" };
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      phone: normalizedPhoneNumber,
      isPhoneVerified: true,
    },
  });

  console.info("[bot-debug] phone-verification-complete", {
    chatId: message.chat.id,
    userId: user.id,
    telegramId: String(fromId),
  });

  await sendPhoneVerificationResult(
    message.chat.id,
    "Номер телефона подтверждён. Возвращайтесь в Mini App — отметка появится в вашем профиле.",
  );

  return {
    handled: true,
    action: "phone_verification_completed",
    userId: user.id,
  };
}

export async function setTelegramWebhook(webhookUrl: string) {
  return callTelegramApi("setWebhook", {
    url: webhookUrl,
    secret_token: getWebhookSecret(),
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export async function getTelegramWebhookInfo() {
  return callTelegramApi("getWebhookInfo", {});
}

export async function getTelegramMe() {
  return callTelegramApi("getMe", {});
}

export async function setTelegramCommands() {
  return callTelegramApi("setMyCommands", {
    commands: [
      { command: "start", description: "Запустить бота и открыть Mini App" },
      { command: "app", description: "Открыть Mini App" },
      { command: "help", description: "Показать подсказку по использованию" },
    ],
  });
}

export async function setTelegramChatMenuButton() {
  return callTelegramApi("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Открыть ПВЗ Подмена",
      web_app: {
        url: getMiniAppUrl(),
      },
    },
  });
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;

  if (!message) {
    console.info("[bot-debug] update-ignored", {
      updateId: update.update_id,
      reason: "no_message",
    });
    return { handled: false, reason: "No message" };
  }

  if (message.contact) {
    console.info("[bot-debug] update-contact", {
      updateId: update.update_id,
      chatId: message.chat.id,
      fromId: message.from?.id ?? null,
      contactUserId: message.contact.user_id ?? null,
    });

    return handlePhoneVerificationContact(message);
  }

  if (!message.text) {
    console.info("[bot-debug] update-ignored", {
      updateId: update.update_id,
      reason: "no_text_message",
    });
    return { handled: false, reason: "No text message" };
  }

  const text = message.text.trim().toLowerCase();

  console.info("[bot-debug] update-text", {
    updateId: update.update_id,
    chatId: message.chat.id,
    fromId: message.from?.id ?? null,
    text,
  });

  if (text.startsWith("/start") || text.startsWith("/app")) {
    await sendMiniAppInvite(message.chat.id, message.from);
    return { handled: true, action: "mini_app_invite" };
  }

  if (text.startsWith("/help")) {
    await sendTelegramText(
      message.chat.id,
      "Этот бот открывает Telegram Mini App для поиска смен и подмен в ПВЗ.\n\nНажмите /start или /app, чтобы открыть приложение.",
    );
    return { handled: true, action: "help" };
  }

  await sendMiniAppInvite(message.chat.id, message.from);
  return { handled: true, action: "fallback_invite" };
}
