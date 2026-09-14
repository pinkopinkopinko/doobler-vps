export const TELEGRAM_PLATFORM_PREFIX = "/telegram";

const INTERNAL_PATH_PREFIXES = ["/api", "/_next", "/admin", "/admin-login"];

export function getPlatformPrefixFromPathname(pathname: string | null | undefined) {
  if (
    pathname === TELEGRAM_PLATFORM_PREFIX ||
    pathname?.startsWith(`${TELEGRAM_PLATFORM_PREFIX}/`)
  ) {
    return TELEGRAM_PLATFORM_PREFIX;
  }

  return "";
}

export function stripPlatformPrefix(pathname: string) {
  if (pathname === TELEGRAM_PLATFORM_PREFIX) {
    return "/";
  }

  if (pathname.startsWith(`${TELEGRAM_PLATFORM_PREFIX}/`)) {
    return pathname.slice(TELEGRAM_PLATFORM_PREFIX.length) || "/";
  }

  return pathname;
}

export function withPlatformPrefix(href: string, prefix: string) {
  if (!prefix || !href.startsWith("/") || href.startsWith("//")) {
    return href;
  }

  const match = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const pathname = match?.[1] || "/";
  const query = match?.[2] || "";
  const hash = match?.[3] || "";

  if (
    pathname === prefix ||
    pathname.startsWith(`${prefix}/`) ||
    INTERNAL_PATH_PREFIXES.some(
      (internalPrefix) =>
        pathname === internalPrefix || pathname.startsWith(`${internalPrefix}/`),
    )
  ) {
    return href;
  }

  return `${prefix}${pathname === "/" ? "" : pathname}${query}${hash}`;
}

export function getTelegramMiniAppPath(pathname = "/shifts") {
  return withPlatformPrefix(pathname, TELEGRAM_PLATFORM_PREFIX);
}
