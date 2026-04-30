import dotenv from "dotenv";
import { pathToFileURL } from "node:url";

dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env" });

import {
  getTelegramMe,
  getTelegramWebhookInfo,
  setTelegramChatMenuButton,
  setTelegramCommands,
  setTelegramWebhook,
} from "../src/lib/telegram/bot";
import {
  getCurrentNgrokUrl,
  updateEnvLocalUrl,
  writeRuntimeNgrokUrl,
} from "./ngrok-utils";

export async function syncNgrokUrl(baseUrl = "") {
  const publicUrl = (baseUrl || (await getCurrentNgrokUrl())).replace(/\/$/, "");
  process.env.NEXT_PUBLIC_APP_URL = publicUrl;

  await updateEnvLocalUrl(publicUrl);
  await writeRuntimeNgrokUrl(publicUrl);

  const webhookUrl = `${publicUrl}/api/bot/webhook`;
  const [bot] = await Promise.all([
    getTelegramMe(),
    setTelegramCommands(),
    setTelegramChatMenuButton(),
  ]);
  await setTelegramWebhook(webhookUrl);
  const webhookInfo = await getTelegramWebhookInfo();

  return {
    publicUrl,
    webhookUrl,
    bot,
    webhookInfo,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncNgrokUrl(process.argv[2])
    .then((result) => {
      console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
