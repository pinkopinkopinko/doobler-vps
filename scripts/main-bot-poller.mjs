let offset = 0;

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.MAIN_BOT_POLLER_APP_URL || "http://app:3000/api/bot/webhook";

if (!token || !secret) {
  console.error("TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are required.");
  process.exit(1);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function telegram(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return response.json();
}

async function forwardUpdate(update) {
  const response = await fetch(appUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: JSON.stringify(update),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`App webhook returned ${response.status}: ${text}`);
  }

  return text;
}

console.log(await telegram("deleteWebhook", { drop_pending_updates: false }));
console.log("Doobler main bot poller started.");

while (true) {
  try {
    const data = await telegram("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message"],
    });

    if (!data.ok) {
      console.error("getUpdates failed:", data);
      await sleep(3000);
      continue;
    }

    for (const update of data.result) {
      offset = update.update_id + 1;

      const text = update.message?.text || "";
      const kind = text ? text : update.message ? "message" : "non-message";
      console.log("update", update.update_id, kind);

      console.log(await forwardUpdate(update));
    }
  } catch (error) {
    console.error("poller error:", error instanceof Error ? error.message : error);
    await sleep(3000);
  }
}
