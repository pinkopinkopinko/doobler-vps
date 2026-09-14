import blacklistTelegramIds from "../../data/blacklist-pvz/telegram-ids.json";

type BlacklistTelegramIdEntry = {
  telegramId: string;
  postUrl: string;
};

const blacklistByTelegramId = new Map(
  (blacklistTelegramIds.items as BlacklistTelegramIdEntry[]).map((entry) => [
    entry.telegramId,
    entry.postUrl,
  ]),
);

export function getBlacklistPvzMatch(telegramId: string) {
  const postUrl = blacklistByTelegramId.get(telegramId);

  if (!postUrl) {
    return null;
  }

  return { postUrl };
}
