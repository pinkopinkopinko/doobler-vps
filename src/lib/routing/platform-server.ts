import { headers } from "next/headers";

import { TELEGRAM_PLATFORM_PREFIX } from "@/lib/routing/platform";

export async function getRequestPlatformPrefix() {
  const requestHeaders = await headers();

  return requestHeaders.get("x-doobler-platform-prefix") === TELEGRAM_PLATFORM_PREFIX
    ? TELEGRAM_PLATFORM_PREFIX
    : "";
}
