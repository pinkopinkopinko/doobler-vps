import { getAdminSessionPayload } from "@/lib/auth/admin-session";
import { requireModerator } from "@/lib/auth/require-moderator";
import type { AppRole } from "@/lib/types";

export type AdminAccessFailure =
  | { ok: false; status: 401; reason: "no_session" }
  | { ok: false; status: 403; reason: "not_authorized" };

export type AdminAccessSuccess = {
  ok: true;
  source: "password" | "telegram";
  user: {
    id: string | null;
    telegramId: string | null;
    firstName: string;
    lastName: string | null;
    username: string | null;
    roles: AppRole[];
  };
};

export type AdminAccessResult = AdminAccessSuccess | AdminAccessFailure;

export async function requireAdminAccess(): Promise<AdminAccessResult> {
  const adminSession = await getAdminSessionPayload();

  if (adminSession) {
    return {
      ok: true,
      source: "password",
      user: {
        id: null,
        telegramId: null,
        firstName: "Администратор",
        lastName: null,
        username: adminSession.username,
        roles: ["MODERATOR"],
      },
    };
  }

  const moderator = await requireModerator();

  if (!moderator.ok) {
    if (moderator.reason === "no_session") {
      return {
        ok: false,
        status: 401,
        reason: "no_session",
      };
    }

    return {
      ok: false,
      status: 403,
      reason: "not_authorized",
    };
  }

  return {
    ok: true,
    source: "telegram",
    user: moderator.user,
  };
}
