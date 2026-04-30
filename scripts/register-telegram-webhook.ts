import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env" });

import {
  getTelegramMe,
  getTelegramWebhookInfo,
  setTelegramChatMenuButton,
  setTelegramCommands,
  setTelegramWebhook,
} from "../src/lib/telegram/bot";

async function main() {
  const baseUrl = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    throw new Error("Pass base URL as an argument or set NEXT_PUBLIC_APP_URL.");
  }

  process.env.NEXT_PUBLIC_APP_URL = baseUrl;

  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/bot/webhook`;

  const [me] = await Promise.all([getTelegramMe(), setTelegramCommands(), setTelegramChatMenuButton()]);
  await setTelegramWebhook(webhookUrl);
  const webhookInfo = await getTelegramWebhookInfo();

  console.log(
    JSON.stringify(
      {
        ok: true,
        bot: me,
        webhookUrl,
        webhookInfo,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
