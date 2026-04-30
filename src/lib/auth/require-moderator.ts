import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { AppRole } from "@/lib/types";

export type ModeratorGuardFailure =
  | { ok: false; status: 401; reason: "no_session" }
  | { ok: false; status: 403; reason: "not_moderator" };

export type ModeratorGuardSuccess = {
  ok: true;
  user: {
    id: string;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    roles: AppRole[];
  };
};

export type ModeratorGuardResult = ModeratorGuardSuccess | ModeratorGuardFailure;

function normalizeRoles(
  roles: Array<string | { role: string }> | null | undefined,
): AppRole[] {
  if (!roles) {
    return [];
  }

  return roles.map((item) =>
    (typeof item === "string" ? item : item.role) as AppRole,
  );
}

export function hasModeratorRole(
  roles: Array<string | { role: string }> | null | undefined,
): boolean {
  return normalizeRoles(roles).includes("MODERATOR");
}

export async function requireModerator(): Promise<ModeratorGuardResult> {
  const current = await getCurrentUser();

  if (!current) {
    return { ok: false, status: 401, reason: "no_session" };
  }

  const roles = normalizeRoles(current.roles as Array<string | { role: string }> | null);

  if (!roles.includes("MODERATOR")) {
    return { ok: false, status: 403, reason: "not_moderator" };
  }

  return {
    ok: true,
    user: {
      id: current.id,
      telegramId: current.telegramId,
      firstName: current.firstName,
      lastName: current.lastName ?? null,
      username: current.username ?? null,
      roles,
    },
  };
}
