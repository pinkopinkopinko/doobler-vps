import { timingSafeEqual } from "node:crypto";

import { fail, ok } from "@/lib/api";
import {
  getWebhookSecret,
  handleTelegramUpdate,
  type TelegramUpdate,
} from "@/lib/telegram/bot";

const MAX_BODY_BYTES = 1024 * 64; // 64 KB — Telegram updates are well under this.

// In-memory dedup of update_id. LRU-style ring; lives per process.
const RECENT_UPDATE_IDS_LIMIT = 1024;
const recentUpdateIds = new Map<number, number>();

function rememberUpdateId(updateId: number): boolean {
  if (recentUpdateIds.has(updateId)) {
    return false;
  }
  recentUpdateIds.set(updateId, Date.now());
  if (recentUpdateIds.size > RECENT_UPDATE_IDS_LIMIT) {
    const oldest = recentUpdateIds.keys().next().value;
    if (oldest !== undefined) {
      recentUpdateIds.delete(oldest);
    }
  }
  return true;
}

function safeStringEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const secretOk = secret.length > 0 && safeStringEqual(secret, getWebhookSecret());

  if (!secretOk) {
    console.warn("[bot-debug] webhook:bad-secret", {
      secretPresent: Boolean(secret),
      userAgent,
    });
    return fail("Invalid webhook secret.", 401);
  }

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return fail("Payload too large.", 413);
  }

  const payload = (await request.json().catch(() => null)) as TelegramUpdate | null;

  if (!payload || typeof payload.update_id !== "number") {
    console.warn("[bot-debug] webhook:bad-payload", { userAgent });
    return fail("Invalid payload.", 400);
  }

  if (!rememberUpdateId(payload.update_id)) {
    console.info("[bot-debug] webhook:duplicate", {
      updateId: payload.update_id,
    });
    return ok({ received: true, duplicate: true });
  }

  console.info("[bot-debug] webhook:update", {
    updateId: payload.update_id,
    chatId: payload.message?.chat.id ?? null,
    fromId: payload.message?.from?.id ?? null,
  });

  const result = await handleTelegramUpdate(payload).catch((error) => ({
    handled: false,
    error: error instanceof Error ? error.message : "Unknown Telegram error",
  }));

  return ok({ received: true, result });
}

export async function GET() {
  return ok({ ok: true, webhook: "telegram" });
}
