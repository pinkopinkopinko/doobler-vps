// Гейт для подробных debug-логов авторизации и WebApp.
//
// Включается флагом окружения. На сервере — LOG_VERBOSE, на клиенте —
// NEXT_PUBLIC_LOG_VERBOSE (Next.js инлайнит NEXT_PUBLIC_-переменные на этапе
// сборки, поэтому в проде по умолчанию helpers становятся no-op).
//
// Логи `[tg-auth]` (warn/error и итоговый success) и `[tg-notify]` остаются
// без гейта — они нужны для разбора инцидентов.

export const isVerboseLoggingEnabled =
  process.env.LOG_VERBOSE === "true" ||
  process.env.NEXT_PUBLIC_LOG_VERBOSE === "true";

export function tgDebug(scope: string, payload?: unknown) {
  if (!isVerboseLoggingEnabled) {
    return;
  }

  if (payload === undefined) {
    console.info(`[tg-debug] ${scope}`);
    return;
  }

  console.info(`[tg-debug] ${scope}`, payload);
}
