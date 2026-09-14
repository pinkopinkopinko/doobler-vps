/**
 * Высокоуровневый хелпер для per-user rate-limit на /api/* роутах.
 *
 * Зачем отдельный модуль:
 *   - все ручки повторяли один и тот же бойлерплейт:
 *     `checkInMemoryRateLimit(...) → if (!ok) return buildRateLimitResponse(...)`;
 *   - часто хотелось проверить сразу два окна (минута + час), и каждый
 *     раз эту пару писали заново;
 *   - per-user — это самый честный ключ в Telegram Mini App: per-IP плохо
 *     работает из-за CGNAT мобильных операторов (у тысяч юзеров один IP),
 *     а per-tg-user-id ставится из `session.userId` после bootstrap.
 *
 * Использование:
 *   const limited = enforceUserRateLimit({
 *     userId: session.userId,
 *     scope: "applications-create",
 *     limits: [
 *       { windowMs: 60_000, max: 6,   label: "minute" },
 *       { windowMs: 60 * 60_000, max: 60, label: "hour"   },
 *     ],
 *   });
 *   if (limited) return limited;
 *
 * Кеш — `checkInMemoryRateLimit`: Redis (если задан `REDIS_URL`) с
 * fallback на per-process Map. См. `src/lib/rate-limit/in-memory.ts`.
 */

import { checkInMemoryRateLimit } from "@/lib/rate-limit/in-memory";
import { buildRateLimitResponse } from "@/lib/rate-limit/response";

export type UserRateLimitWindow = {
  windowMs: number;
  max: number;
  /**
   * Опциональный человеко-читаемый суффикс ключа, чтобы при нескольких
   * окнах разных длин счётчики не сливались в один bucket. Если не задан,
   * берём `windowMs` — это тоже уникально по факту, но менее наглядно
   * в дебаг-логах.
   */
  label?: string;
};

export type UserRateLimitOptions = {
  /** Stable user identifier — обычно `session.userId` Telegram-юзера. */
  userId: string;
  /** Логическая зона лимита (e.g. "applications-create"). */
  scope: string;
  /** Одно или несколько окон, проверяются в порядке передачи. */
  limits: UserRateLimitWindow[];
  /** Кастомное user-facing сообщение для 429. */
  message?: string;
};

/**
 * Возвращает `Response` с кодом 429 при первом провалившемся окне, иначе
 * `null` — handler продолжает обработку. Намеренно не throw — чтобы можно
 * было сразу `return enforceUserRateLimit(...) ?? ...` в обработчике.
 */
export async function enforceUserRateLimit(
  options: UserRateLimitOptions
): Promise<Response | null> {
  for (const window of options.limits) {
    const labelSuffix = window.label ?? `${window.windowMs}ms`;
    const key = `${options.scope}:${labelSuffix}:${options.userId}`;

    const result = await checkInMemoryRateLimit({
      key,
      windowMs: window.windowMs,
      max: window.max,
    });

    if (!result.ok) {
      return buildRateLimitResponse(result.retryAfterMs, options.message);
    }
  }

  return null;
}

/**
 * Грубый общий потолок на любые /api/* действия одного юзера — чтобы
 * даже залогиненный, прошедший nginx-фильтр клиент не мог утянуть
 * Postgres на тысячах запросов в минуту. Вызывать ТОЛЬКО в дешёвых
 * write-handler'ах (POST/PATCH/DELETE), которые трогают БД; на GET
 * — оверкилл, там и так есть кеш и легче.
 */
const GLOBAL_API_BUDGET: UserRateLimitWindow[] = [
  { windowMs: 60_000, max: 120, label: "min" },
  { windowMs: 60 * 60_000, max: 1_200, label: "hour" },
];

export function enforceUserApiBudget(userId: string): Promise<Response | null> {
  return enforceUserRateLimit({
    userId,
    scope: "api-budget",
    limits: GLOBAL_API_BUDGET,
    message: "Вы превысили общий лимит запросов. Попробуйте позже.",
  });
}
