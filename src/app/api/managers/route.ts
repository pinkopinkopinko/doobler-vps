import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getSessionPayload } from "@/lib/auth/session";
import { isOwnerRole } from "@/lib/profile-completion";
import {
  assignManagerByUsername,
  listOwnerManagers,
} from "@/server/services/manager-access-service";

export async function GET() {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const currentUser = await getCurrentUser();
  const roles =
    currentUser && "roles" in currentUser
      ? currentUser.roles.map((role) => (typeof role === "string" ? role : role.role))
      : [];

  if (!isOwnerRole(roles)) {
    return fail("Только владелец может управлять доступами управляющих.", 403);
  }

  const managers = await listOwnerManagers(session.userId);
  return ok({ managers });
}

export async function POST(request: Request) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const currentUser = await getCurrentUser();
  const roles =
    currentUser && "roles" in currentUser
      ? currentUser.roles.map((role) => (typeof role === "string" ? role : role.role))
      : [];

  if (!isOwnerRole(roles)) {
    return fail("Только владелец может назначать управляющего.", 403);
  }

  const body = (await request.json().catch(() => null)) as { username?: string } | null;

  try {
    const manager = await assignManagerByUsername({
      ownerUserId: session.userId,
      username: body?.username ?? "",
    });

    return ok({ manager }, { status: 201 });
  } catch (error) {
    if (!(error instanceof Error)) {
      return fail("Не удалось назначить управляющего.", 500);
    }

    if (error.message === "USERNAME_REQUIRED") {
      return fail("Укажите username управляющего в Telegram.", 400);
    }

    if (error.message === "OWNER_PICKUP_POINTS_REQUIRED") {
      return fail("Сначала создайте хотя бы один ПВЗ, чтобы выдать к нему доступ.", 400);
    }

    if (error.message === "USER_NOT_FOUND") {
      return fail("Пользователь с таким username не найден.", 404);
    }

    if (error.message === "SELF_ASSIGNMENT_FORBIDDEN") {
      return fail("Нельзя назначить управляющим самого себя.", 400);
    }

    return fail("Не удалось назначить управляющего.", 500);
  }
}
