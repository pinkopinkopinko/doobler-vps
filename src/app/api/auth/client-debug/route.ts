import { ok } from "@/lib/api";
import { tgDebug } from "@/lib/log";

function sanitizePayload(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/([?&]loginToken=)[^&]+/g, "$1<hidden>");
  }

  if (Array.isArray(value)) {
    return value.map(sanitizePayload);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizePayload(item)]),
    );
  }

  return value;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  tgDebug("client-report", {
    userAgent: request.headers.get("user-agent") ?? "unknown",
    referer: request.headers.get("referer") ?? null,
    origin: request.headers.get("origin") ?? null,
    forwardedHost: request.headers.get("x-forwarded-host") ?? null,
    forwardedProto: request.headers.get("x-forwarded-proto") ?? null,
    payload: sanitizePayload(payload),
  });

  return ok({ received: true });
}
