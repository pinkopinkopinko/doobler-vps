/**
 * Оборачивает fetch к DaData в AbortController с дедлайном.
 *
 * DaData/Suggestions API — синхронные подсказки адресов, которые блокируют
 * UX набора адреса и response запросов `POST /api/address-*`. Без таймаута
 * воркер Next.js при зависшем апстриме может висеть до дефолтного Node
 * undici keep-alive и копить сокеты, что деградирует latency всего
 * приложения. Для этого же типа upstream retry смысла нет: пользователь
 * за 3 секунды либо перепечатает, либо остановится.
 *
 * `DADATA_TIMEOUT` — отдельный error message, чтобы выше по стеку можно
 * было отличить "таймаут" от "DADATA_5xx" и корректно сообщить клиенту.
 */
export async function fetchDaData(
  url: string,
  init: RequestInit,
  timeoutMs = 3000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("DADATA_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
