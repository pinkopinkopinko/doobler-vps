import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { listMyApplications } from "@/server/services/application-service";

export async function GET() {
  const session = await getSessionPayload();

  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const applications = await listMyApplications(session.userId);
  return ok({ applications });
}
