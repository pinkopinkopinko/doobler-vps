import { ok } from "@/lib/api";
import { clearAdminSessionCookie } from "@/lib/auth/admin-session";
import { requireSameOriginMutationRequest } from "@/lib/auth/mutation-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const untrusted = requireSameOriginMutationRequest(request);
  if (untrusted) return untrusted;

  await clearAdminSessionCookie();
  return ok({ ok: true });
}
