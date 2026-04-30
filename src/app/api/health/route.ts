import { ok } from "@/lib/api";

export async function GET() {
  return ok({
    ok: true,
    service: "pvz-zamena-bot",
    timestamp: new Date().toISOString(),
    env: {
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      telegramBotConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      sessionSecretConfigured: Boolean(process.env.SESSION_SECRET),
    },
  });
}
