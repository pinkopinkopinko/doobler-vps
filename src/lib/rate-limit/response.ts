// Унифицированный 429-ответ. Возвращает `Retry-After` в секундах
// (HTTP-стандарт; Telegram WebApp / fetch его честно понимают).
export function buildRateLimitResponse(retryAfterMs: number, message?: string) {
  const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));

  return new Response(
    JSON.stringify({
      error: message ?? "Слишком много запросов. Попробуйте чуть позже.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
