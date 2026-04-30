import { ok } from "@/lib/api";
import { clearAdminSessionCookie } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearAdminSessionCookie();
  return ok({ ok: true });
}
