type DevFallbackKind = "auth" | "data";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isDevFallbackEnabled(kind: DevFallbackKind) {
  if (isProduction()) {
    return false;
  }

  const envName = kind === "auth" ? "ALLOW_DEV_AUTH_FALLBACK" : "ALLOW_DEV_DATA_FALLBACK";
  return process.env[envName] === "true";
}

export function logDevFallbackUsed(params: {
  kind: DevFallbackKind;
  source: string;
  reason: unknown;
  meta?: Record<string, unknown>;
}) {
  const message =
    params.reason instanceof Error ? params.reason.message : String(params.reason ?? "unknown");

  console.warn(`[dev-fallback] ${params.kind}:${params.source}`, {
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    fallbackEnabled: isDevFallbackEnabled(params.kind),
    reason: message,
    ...params.meta,
  });
}
