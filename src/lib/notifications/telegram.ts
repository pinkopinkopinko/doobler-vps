type SendTelegramMessageInput = {
  chatId: string;
  text: string;
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

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
    }),
  });

  if (!response.ok) {
    return { ok: false, skipped: false };
  }

  return { ok: true, skipped: false };
}
