// Вытаскиваем «client IP» из стандартных reverse-proxy заголовков.
// За ngrok / Vercel / nginx запрос приходит через прокси, поэтому
// request.url или request.connection.remoteAddress давали бы IP прокси,
// а не пользователя.
//
// Доверяем заголовкам ТОЛЬКО первому значению (это исходный клиент;
// дальше идут адреса прокси-цепочки). Значение никогда не используется
// для авторизации — только как идентификатор для rate-limit, поэтому
// если кто-то спуфит x-forwarded-for, потеряем точность учёта,
// но безопасности это не угрожает.
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  return "unknown";
}
