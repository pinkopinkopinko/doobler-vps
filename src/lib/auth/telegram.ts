import crypto from "node:crypto";

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

export type TelegramInitDataInspection =
  | {
      ok: true;
      user: TelegramUser;
      authDate: number;
      initDataLength: number;
    }
  | {
      ok: false;
      reason:
        | "missing_user"
        | "missing_hash"
        | "invalid_hash"
        | "missing_auth_date"
        | "expired_auth_date"
        | "invalid_user_json";
      authDate?: number;
      initDataLength: number;
    };

function buildDataCheckString(params: URLSearchParams) {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function isValidHash(dataCheckString: string, hash: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return false;
  }

  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const calculatedHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest();
  const receivedHash = Buffer.from(hash, "hex");

  if (receivedHash.length !== calculatedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(calculatedHash, receivedHash);
}

export function inspectTelegramInitData(initData: string): TelegramInitDataInspection {
  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");
  const hash = params.get("hash");
  const initDataLength = initData.length;

  if (!userRaw) {
    return { ok: false, reason: "missing_user", initDataLength };
  }

  if (!hash) {
    return { ok: false, reason: "missing_hash", initDataLength };
  }

  const dataCheckString = buildDataCheckString(params);
  if (!isValidHash(dataCheckString, hash)) {
    return { ok: false, reason: "invalid_hash", initDataLength };
  }

  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);

  if (!authDate) {
    return { ok: false, reason: "missing_auth_date", initDataLength };
  }

  if (now - authDate > 60 * 60) {
    return { ok: false, reason: "expired_auth_date", authDate, initDataLength };
  }

  try {
    return {
      ok: true,
      user: JSON.parse(userRaw) as TelegramUser,
      authDate,
      initDataLength,
    };
  } catch {
    return { ok: false, reason: "invalid_user_json", authDate, initDataLength };
  }
}

export function parseTelegramInitData(initData: string) {
  const inspection = inspectTelegramInitData(initData);
  return inspection.ok ? inspection.user : null;
}

export function getDevelopmentTelegramUser() {
  const telegramId = process.env.NEXT_PUBLIC_DEV_TELEGRAM_ID?.trim();

  if (!telegramId) {
    return null;
  }

  const numericTelegramId = Number(telegramId);

  if (!Number.isSafeInteger(numericTelegramId) || numericTelegramId <= 0) {
    return null;
  }

  return {
    id: numericTelegramId,
    first_name: "Dev",
    last_name: "User",
    username: "dev_user",
    photo_url: undefined,
  } satisfies TelegramUser;
}
