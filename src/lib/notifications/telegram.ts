import { addLoginTokenToMiniAppUrl } from "@/lib/telegram/bot";

const TELEGRAM_NOTIFICATION_TIMEOUT_MS = 8_000;

type SendTelegramMessageInput = {
  chatId: string;
  text: string;
  button?: {
    text: string;
    webAppUrl: string;
  };
};

// ВАЖНО: текст отправляется БЕЗ parse_mode. Раньше стояло parse_mode: "HTML",
// и потребители (application-service) клеили в text user-controlled поля
// (название смены, имя/фамилия), не экранируя их. Это давало HTML-injection
// в Telegram-сообщениях — атакующий мог подсунуть «<a href=…>» в title и
// получить кликабельную фишинговую ссылку. Plain text безопасен независимо
// от содержимого.
//
// Если когда-то понадобится HTML-форматирование (как в chat-notifier),
// делайте отдельный helper и обязательно прогоняйте user-input через
// escapeHtml перед склейкой.
export async function sendTelegramMessage(input: SendTelegramMessageInput) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return { ok: false, skipped: true };
  }

  const buttonWebAppUrl = input.button
    ? await addLoginTokenToMiniAppUrl(input.button.webAppUrl, { telegramId: input.chatId })
    : null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_NOTIFICATION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        disable_web_page_preview: true,
        ...(input.button
          ? {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: input.button.text,
                      web_app: { url: buttonWebAppUrl },
                    },
                  ],
                ],
              },
            }
          : {}),
      }),
    });
  } catch (error) {
    console.warn("[tg-notify] sendMessage request failed", {
      chatId: input.chatId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, skipped: false };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return { ok: false, skipped: false };
  }

  return { ok: true, skipped: false };
}
