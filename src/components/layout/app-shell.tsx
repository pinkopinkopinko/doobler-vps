"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  AppSessionProvider,
  type ProfileUpdatedEventDetail,
} from "@/components/layout/app-session-context";
import { BannedUserScreen } from "@/components/layout/banned-user-screen";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { SplashFrame, SplashSpinner } from "@/components/layout/splash-frame";
import { fetchWithTelegramAuth } from "@/lib/auth/client";
import { isVerboseLoggingEnabled } from "@/lib/log";
import {
  getPlatformPrefixFromPathname,
  stripPlatformPrefix,
  withPlatformPrefix,
} from "@/lib/routing/platform";
import type { AppRole, VerificationStatus } from "@/lib/types";

const APP_SHELL_CACHE_KEY = "dubler:app-shell-session";
const MIN_BOOTSTRAP_LOADING_MS = 1400;
const POST_AUTH_REFRESH_LOADING_MS = 800;

type CachedShellState = {
  onboardingCompleted: boolean;
  roles: AppRole[];
  employerVerificationStatus: VerificationStatus | null;
  isBanned: boolean;
  bannedProfile: {
    id: string;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    cityName: string | null;
    district: string | null;
    banReason: string | null;
    bannedAt: string | null;
  } | null;
  cachedAt: number;
};

function logShellDebug(event: string, payload: Record<string, unknown>) {
  if (!isVerboseLoggingEnabled) return;
  console.info(`[tg-debug] shell:${event}`, payload);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readCachedShellState(): CachedShellState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(APP_SHELL_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedShellState>;
    if (
      typeof parsed.onboardingCompleted !== "boolean" ||
      !Array.isArray(parsed.roles) ||
      typeof parsed.isBanned !== "boolean" ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null;
    }

    if (Date.now() - parsed.cachedAt > 5 * 60_000) {
      return null;
    }

    return {
      onboardingCompleted: parsed.onboardingCompleted,
      roles: parsed.roles,
      employerVerificationStatus: parsed.employerVerificationStatus ?? null,
      isBanned: parsed.isBanned,
      bannedProfile: parsed.bannedProfile ?? null,
      cachedAt: parsed.cachedAt,
    };
  } catch {
    return null;
  }
}

function writeCachedShellState(state: {
  onboardingCompleted: boolean;
  roles: AppRole[];
  employerVerificationStatus: VerificationStatus | null;
}) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    APP_SHELL_CACHE_KEY,
    JSON.stringify({
        onboardingCompleted: state.onboardingCompleted,
        roles: state.roles,
        employerVerificationStatus: state.employerVerificationStatus,
        isBanned: false,
        bannedProfile: null,
        cachedAt: Date.now(),
      } satisfies CachedShellState),
  );
}

function writeBannedShellState(profile: CachedShellState["bannedProfile"]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    APP_SHELL_CACHE_KEY,
    JSON.stringify({
      onboardingCompleted: true,
      roles: [],
      employerVerificationStatus: null,
      isBanned: true,
      bannedProfile: profile,
      cachedAt: Date.now(),
    } satisfies CachedShellState),
  );
}

function clearCachedShellState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(APP_SHELL_CACHE_KEY);
}

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const platformPrefix = getPlatformPrefixFromPathname(pathname);
  const logicalPathname = stripPlatformPrefix(pathname);
  // IMPORTANT: do not read sessionStorage during render. It would diverge from the
  // server-rendered HTML and trigger a hydration mismatch. We hydrate from cache
  // synchronously inside a layout effect, before the browser paints.
  const [bootstrapped, setBootstrapped] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [employerVerificationStatus, setEmployerVerificationStatus] =
    useState<VerificationStatus | null>(null);
  const [isBanned, setIsBanned] = useState<boolean>(false);
  const [bannedProfile, setBannedProfile] = useState<CachedShellState["bannedProfile"]>(null);

  useEffect(() => {
    const cached = readCachedShellState();
    if (!cached) return;
    // Синхронизация с sessionStorage: безопасно делать в эффекте, потому что
    // на сервере sessionStorage недоступен и хранилище — внешний источник.
    /* eslint-disable react-hooks/set-state-in-effect */
    setOnboardingCompleted(cached.onboardingCompleted);
    setRoles(cached.roles);
    setEmployerVerificationStatus(cached.employerVerificationStatus ?? null);
    setIsBanned(cached.isBanned);
    setBannedProfile(cached.bannedProfile);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    function handleProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<ProfileUpdatedEventDetail>).detail;
      const nextRoles = Array.isArray(detail?.roles) ? detail.roles : roles;
      const nextEmployerVerificationStatus =
        "employerVerificationStatus" in (detail ?? {})
          ? (detail.employerVerificationStatus ?? null)
          : employerVerificationStatus;
      if (typeof detail?.onboardingCompleted === "boolean") {
        setOnboardingCompleted(detail.onboardingCompleted);
        setRoles(nextRoles);
        setEmployerVerificationStatus(nextEmployerVerificationStatus);
        writeCachedShellState({
          onboardingCompleted: detail.onboardingCompleted,
          roles: nextRoles,
          employerVerificationStatus: nextEmployerVerificationStatus,
        });
        logShellDebug("profile-updated", {
          onboardingCompleted: detail.onboardingCompleted,
          roles: nextRoles,
          employerVerificationStatus: nextEmployerVerificationStatus,
        });
      }
    }

    window.addEventListener("profile:updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profile:updated", handleProfileUpdated);
    };
  }, [employerVerificationStatus, roles]);

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      const startedAt = Date.now();
      let shouldRefreshServerTree = false;

      logShellDebug("bootstrap-start", {
        pathname: window.location.pathname,
        userAgent: window.navigator.userAgent,
      });

      try {
        setAuthFailed(false);
        const meRes = await fetchWithTelegramAuth("/api/auth/me", { cache: "no-store" });
        const mePayload = meRes.ok
          ? (((await meRes.json().catch(() => null)) as {
              onboardingCompleted?: boolean;
              roles?: AppRole[];
              employerVerificationStatus?: VerificationStatus | null;
              isBanned?: boolean;
              bannedProfile?: CachedShellState["bannedProfile"];
            } | null) ?? null)
          : null;

        logShellDebug("auth-me-response", {
          status: meRes.status,
          ok: meRes.ok,
          hasPayload: Boolean(mePayload),
          isBanned: mePayload?.isBanned ?? false,
          onboardingCompleted: mePayload?.onboardingCompleted ?? null,
          roles: mePayload?.roles ?? [],
          pathname: window.location.pathname,
        });

        if (!ignore) {
          setAuthFailed(!meRes.ok || !mePayload);
          const nextOnboardingCompleted =
            typeof mePayload?.onboardingCompleted === "boolean"
              ? mePayload.onboardingCompleted
              : null;
          const nextRoles = mePayload?.roles ?? [];
          const nextEmployerVerificationStatus = mePayload?.employerVerificationStatus ?? null;
          const nextIsBanned = mePayload?.isBanned === true;
          const nextBannedProfile = mePayload?.bannedProfile ?? null;
          shouldRefreshServerTree = meRes.ok && Boolean(mePayload);
          setOnboardingCompleted(nextOnboardingCompleted);
          setRoles(nextRoles);
          setEmployerVerificationStatus(nextEmployerVerificationStatus);
          setIsBanned(nextIsBanned);
          setBannedProfile(nextBannedProfile);
          if (meRes.ok && nextOnboardingCompleted !== null) {
            if (nextIsBanned) {
              writeBannedShellState(nextBannedProfile);
            } else {
              writeCachedShellState({
                onboardingCompleted: nextOnboardingCompleted,
                roles: nextRoles,
                employerVerificationStatus: nextEmployerVerificationStatus,
              });
            }
          } else {
            clearCachedShellState();
          }
        }
      } catch (error) {
        console.error("[tg-debug] shell:bootstrap-failed", {
          message: error instanceof Error ? error.message : "unknown error",
          stack: error instanceof Error ? error.stack : null,
          pathname: window.location.pathname,
        });

        if (!ignore) {
          setAuthFailed(true);
          setOnboardingCompleted(null);
          setRoles([]);
          setEmployerVerificationStatus(null);
          setIsBanned(false);
          setBannedProfile(null);
          clearCachedShellState();
        }
      } finally {
        if (!ignore) {
          if (shouldRefreshServerTree) {
            router.refresh();
            await delay(POST_AUTH_REFRESH_LOADING_MS);
          }

          const elapsedMs = Date.now() - startedAt;
          if (elapsedMs < MIN_BOOTSTRAP_LOADING_MS) {
            await delay(MIN_BOOTSTRAP_LOADING_MS - elapsedMs);
          }
        }

        if (!ignore) {
          setBootstrapped(true);
          logShellDebug("bootstrap-finished", {
            pathname: window.location.pathname,
            waitedMs: Date.now() - startedAt,
            refreshedServerTree: shouldRefreshServerTree,
          });
        }
      }
    }

    void bootstrap();

    return () => {
      ignore = true;
    };
  }, [router]);

  useEffect(() => {
    logShellDebug("state", {
      bootstrapped,
      authFailed,
      isBanned,
      onboardingCompleted,
      roles,
      employerVerificationStatus,
      pathname,
    });

    if (!bootstrapped || authFailed || isBanned || onboardingCompleted === null) {
      return;
    }

    const onOnboardingPage = logicalPathname === "/onboarding";

    if (!onboardingCompleted && !onOnboardingPage) {
      logShellDebug("redirect", {
        from: pathname,
        to: withPlatformPrefix("/onboarding", platformPrefix),
        reason: "onboarding_required",
      });
      router.replace(withPlatformPrefix("/onboarding", platformPrefix));
      return;
    }

    if (onboardingCompleted && onOnboardingPage) {
      logShellDebug("redirect", {
        from: pathname,
        to: withPlatformPrefix("/shifts", platformPrefix),
        reason: "onboarding_completed",
      });
      router.replace(withPlatformPrefix("/shifts", platformPrefix));
    }
  }, [
    authFailed,
    bootstrapped,
    employerVerificationStatus,
    isBanned,
    logicalPathname,
    onboardingCompleted,
    pathname,
    platformPrefix,
    roles,
    router,
  ]);

  const showBottomNav = logicalPathname !== "/onboarding";

  if (!bootstrapped) {
    return (
      <SplashFrame
        bottomSlot={
          <>
            <SplashSpinner />
            <div style={{ fontSize: 12, opacity: 0.7 }}>Подключаем Telegram…</div>
          </>
        }
      />
    );
  }

  if (isBanned && bannedProfile) {
    return <BannedUserScreen user={bannedProfile} />;
  }

  if (authFailed || onboardingCompleted === null) {
    return (
      <SplashFrame
        bottomSlot={
          <div
            style={{
              maxWidth: 300,
              padding: "0 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Не удалось войти через Telegram
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.45 }}>
              Закройте приложение, отправьте боту /start и откройте его заново.
              Если открыто в обычном браузере, Telegram не отдаёт initData.
            </div>
            <button
              className="rounded-full bg-[#15131c] px-4 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={() => window.location.reload()}
            >
              Повторить вход
            </button>
          </div>
        }
      />
    );
  }

  return (
    <AppSessionProvider value={{ roles, employerVerificationStatus, onboardingCompleted }}>
      <div className="app-shell mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[#eef3f7] px-4 pt-4">
        <div className="flex-1 pb-6">{children}</div>
        {showBottomNav ? <BottomNav /> : null}
      </div>
    </AppSessionProvider>
  );
}
