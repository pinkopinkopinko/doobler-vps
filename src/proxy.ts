import { NextResponse, type NextRequest } from "next/server";

import {
  TELEGRAM_PLATFORM_PREFIX,
  stripPlatformPrefix,
} from "@/lib/routing/platform";

/**
 * Hard guard for /admin pages and /api/admin endpoints.
 *
 * The actual authorization (password session OR Telegram-moderator session)
 * still happens inside the layouts/route handlers via requireAdminAccess(), but
 * this middleware enforces a baseline:
 *   - any /admin* request must carry one of the admin/session cookies;
 *   - otherwise we redirect to /admin-login (UI) or return 401 (API).
 *
 * It does NOT validate the cookie cryptographically — that's done downstream
 * with full DB access. The point is to fail fast and to make sure new admin
 * routes don't accidentally ship completely unguarded.
 */

const ADMIN_COOKIE = "dubler_admin_session";
const APP_COOKIE = "pvz_session";
const ADMIN_LOGIN_PATH = "/admin-login";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === TELEGRAM_PLATFORM_PREFIX ||
    pathname.startsWith(`${TELEGRAM_PLATFORM_PREFIX}/`)
  ) {
    const strippedPathname = stripPlatformPrefix(pathname);

    if (strippedPathname.startsWith("/admin") || strippedPathname.startsWith("/api/admin")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = strippedPathname;
      return NextResponse.redirect(redirectUrl);
    }

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = strippedPathname === "/" ? "/shifts" : strippedPathname;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-doobler-platform", "telegram");
    requestHeaders.set("x-doobler-platform-prefix", TELEGRAM_PLATFORM_PREFIX);

    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Don't trap the login pages/endpoints themselves.
  if (
    pathname.startsWith(ADMIN_LOGIN_PATH) ||
    pathname.startsWith("/api/admin/auth")
  ) {
    return NextResponse.next();
  }

  const isAdminUi = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminUi && !isAdminApi) {
    return NextResponse.next();
  }

  const hasAdminSession = Boolean(request.cookies.get(ADMIN_COOKIE)?.value);
  const hasAppSession = Boolean(request.cookies.get(APP_COOKIE)?.value);

  if (hasAdminSession || hasAppSession) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json(
      { ok: false, error: "Требуется авторизация." },
      { status: 401 },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = ADMIN_LOGIN_PATH;
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/telegram", "/telegram/:path*", "/admin/:path*", "/api/admin/:path*"],
};
