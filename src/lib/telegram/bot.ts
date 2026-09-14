import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { invalidateCachedUserRecord } from "@/lib/cache/user-record-cache";
import { prisma } from "@/lib/prisma";
import { hasActiveConsent } from "@/server/services/legal-consent-service";
import { getTelegramMiniAppPath } from "@/lib/routing/platform";

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

type TelegramLoginIdentity = {
  telegramId: string | number;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
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

const BOT_LOGIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TELEGRAM_API_TIMEOUT_MS = 8_000;

function maskLoginToken(value: string) {
  return value.replace(/([?&](?:loginToken|token)=)[^&]+/g, "$1<hidden>");
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

function getConfiguredAppUrl() {
  const candidates = [
    process.env.APP_URL?.trim(),
    process.env.DOMAIN?.trim(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const url =
      candidate.startsWith("http://") || candidate.startsWith("https://")
        ? candidate
        : `https://${candidate}`;
    const isLocalhost = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(
      url,
    );

    if (process.env.NODE_ENV === "production" && isLocalhost) {
      continue;
    }

    return url;
  }

  return process.env.NODE_ENV === "production" ? "https://doobler.ru" : "http://localhost:3000";
}

export function getMiniAppUrl(pathname = "/shifts") {
  const devUrlPath = join(process.cwd(), ".dev-ngrok-url");
  const devNgrokUrl =
    process.env.NODE_ENV !== "production" && existsSync(devUrlPath)
      ? readFileSync(devUrlPath, "utf8").trim()
      : "";
  const appUrl = devNgrokUrl || getConfiguredAppUrl();
  return `${appUrl.replace(/\/$/, "")}${getTelegramMiniAppPath(pathname)}`;
}

function addLoginTokenQueryParam(targetUrl: string, token: string) {
  const target = new URL(targetUrl);
  target.searchParams.set("loginToken", token);
  return target.toString();
}

async function createBotLoginToken(identity?: TelegramLoginIdentity | null) {
  if (!identity?.telegramId) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + BOT_LOGIN_TOKEN_TTL_MS);
  const firstName = identity.firstName?.trim() || "Пользователь";

  await prisma.botLoginToken.create({
    data: {
      token,
      telegramId: String(identity.telegramId),
      username: identity.username?.trim() || null,
      firstName,
      lastName: identity.lastName?.trim() || null,
      expiresAt,
    },
  });

  return token;
}

function getLoginIdentityFromTelegramFrom(from?: TelegramFrom): TelegramLoginIdentity | null {
  if (!from?.id) {
    return null;
  }

  return {
    telegramId: from.id,
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null,
    username: from.username ?? null,
  };
}

export async function addLoginTokenToMiniAppUrl(
  url: string,
  identity?: TelegramLoginIdentity | null,
) {
  try {
    const loginToken = await createBotLoginToken(identity);
    return loginToken ? addLoginTokenQueryParam(url, loginToken) : url;
  } catch (error) {
    console.warn("[bot-debug] login-token-create-failed", {
      telegramId: identity?.telegramId ? String(identity.telegramId) : null,
      message: error instanceof Error ? error.message : "unknown",
    });
    return url;
  }
}

export async function getMiniAppUrlWithLoginToken(
  pathname = "/shifts",
  identity?: TelegramLoginIdentity | null,
) {
  return addLoginTokenToMiniAppUrl(getMiniAppUrl(pathname), identity);
}

export function getWebhookSecret() {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (explicit) {
    return explicit;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("TELEGRAM_WEBHOOK_SECRET is not configured.");
  }
  // Fallback: deterministic from bot token. Acceptable for dev,
  // but production should set TELEGRAM_WEBHOOK_SECRET to a random value.
  const token = getBotToken();
  return `pvz-webhook-${token.slice(-12)}`;
}

async function callTelegramApi<T>(method: string, payload: Record<string, unknown>) {
  const token = getBotToken();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);

  console.info("[bot-debug] telegram-api:start", {
    method,
    chatId: payload.chat_id ?? null,
  });

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    console.error("[bot-debug] telegram-api:request-failed", {
      method,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown Telegram request error",
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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
  const appUrl = await getMiniAppUrlWithLoginToken("/shifts", getLoginIdentityFromTelegramFrom(from));

  console.info("[bot-debug] send-mini-app-invite", {
    chatId,
    appUrl: maskLoginToken(appUrl),
    hasLoginToken: /[?&](?:loginToken|token)=/.test(appUrl),
    telegramId: from?.id ? String(from.id) : null,
  });

  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text:
      "Дублер - поиск замены в Пункт Выдачи. Ищите сотрудников или сами выходите на замену в любой пункт выдачи заказов.\n\nДля продолжения работы зайдите в приложение.",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть приложение",
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
      "Не удалось определить ваш Telegram-профиль. Откройте приложение ещё раз и повторите попытку.",
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
      "Сначала откройте приложение, чтобы мы связали Telegram-аккаунт с профилем, а потом повторите подтверждение номера.",
    );

    return { handled: true, action: "phone_verification_user_not_found" };
  }

  if (!(await hasActiveConsent(user.id, "PHONE_PROCESSING"))) {
    await sendPhoneVerificationResult(
      message.chat.id,
      "Сначала откройте профиль в приложении и отдельно подтвердите согласие на обработку номера телефона.",
    );

    return { handled: true, action: "phone_verification_consent_required" };
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

  // isPhoneVerified — часть кешируемого wide-select; без сброса юзер
  // до 30 сек будет видеть «номер не подтверждён» в приложении после того,
  // как Telegram уже принял contact.
  invalidateCachedUserRecord(user.id);

  console.info("[bot-debug] phone-verification-complete", {
    chatId: message.chat.id,
    userId: user.id,
    telegramId: String(fromId),
  });

  await sendPhoneVerificationResult(
    message.chat.id,
    "Номер телефона подтверждён. Возвращайтесь в приложение — отметка появится в вашем профиле.",
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
    drop_pending_updates: process.env.TELEGRAM_DROP_PENDING_UPDATES === "true",
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
      { command: "start", description: "Запустить бота и открыть приложение" },
      { command: "app", description: "Открыть приложение" },
      { command: "help", description: "Показать подсказку по использованию" },
    ],
  });
}

export async function setTelegramChatMenuButton() {
  return callTelegramApi("setChatMenuButton", {
    menu_button: {
      type: "commands",
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
      "Этот бот открывает приложение Дублер для поиска смен и подмен в ПВЗ.\n\nНажмите /start или /app, чтобы открыть приложение.",
    );
    return { handled: true, action: "help" };
  }

  await sendMiniAppInvite(message.chat.id, message.from);
  return { handled: true, action: "fallback_invite" };
}
