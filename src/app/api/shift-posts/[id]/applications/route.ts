import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { hasModeratorRole } from "@/lib/auth/require-moderator";
import { getSessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { enforceUserRateLimit } from "@/lib/rate-limit/user";
import { applyToShift, listApplicationsForShift } from "@/server/services/application-service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("РќСѓР¶РµРЅ РІС…РѕРґ С‡РµСЂРµР· Telegram.", 401);
  }

  const { id } = await params;
  const [currentUser, shiftPost] = await Promise.all([
    getCurrentUser(),
    prisma.shiftPost.findUnique({
      where: { id },
      select: { createdByUserId: true },
    }),
  ]);

  if (!shiftPost) {
    return fail("Shift post not found.", 404);
  }

  const canViewApplications =
    shiftPost.createdByUserId === session.userId || hasModeratorRole(currentUser?.roles ?? []);
  if (!canViewApplications) {
    return fail("Access denied.", 403);
  }

  const applications = await listApplicationsForShift(id);
  return ok({ applications });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSessionPayload();

  if (!session) {
    return fail("РќСѓР¶РµРЅ РІС…РѕРґ С‡РµСЂРµР· Telegram.", 401);
  }

  // РћС‚РєР»РёРє РЅР° СЃРјРµРЅСѓ вЂ” РЅРѕС‚РёС„РёРєР°С†РёСЏ РІР»Р°РґРµР»СЊС†Сѓ + Р‘Р”-Р·Р°РїРёСЃСЊ. Р›РёРјРёС‚РёРј, С‡С‚РѕР±С‹
  // СЋР·РµСЂ РЅРµ РјРѕРі Р·Р° СЃРµРєСѓРЅРґСѓ РѕС‚РєР»РёРєРЅСѓС‚СЊСЃСЏ РЅР° РґРµСЃСЏС‚РєРё СЃРјРµРЅ СЃРєСЂРёРїС‚РѕРј.
  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  const limited = await enforceUserRateLimit({
    userId: session.userId,
    scope: "application-create",
    limits: [
      { windowMs: 60_000, max: 10, label: "minute" },
      { windowMs: 60 * 60_000, max: 60, label: "hour" },
    ],
    message: "РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ РѕС‚РєР»РёРєРѕРІ РїРѕРґСЂСЏРґ. РџРѕРґРѕР¶РґРёС‚Рµ РЅРµРјРЅРѕРіРѕ.",
  });
  if (limited) return limited;

  const body = await request.json();
  const { id } = await params;

  try {
    const application = await applyToShift(id, session.userId, body);
    return ok({ application }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "already_assigned_on_date":
          return fail(
            "РЈ РІР°СЃ СѓР¶Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅР° СЃРјРµРЅР° РЅР° СЌС‚РѕС‚ РґРµРЅСЊ. РЎРЅР°С‡Р°Р»Р° Р·Р°РІРµСЂС€РёС‚Рµ РµС‘.",
            409,
          );
        case "already_applied":
          return fail("Р’С‹ СѓР¶Рµ РѕС‚РєР»РёРєРЅСѓР»РёСЃСЊ РЅР° СЌС‚Сѓ СЃРјРµРЅСѓ.", 409);
        case "shift_not_open":
          return fail("Р­С‚Р° СЃРјРµРЅР° СѓР¶Рµ Р·Р°РєСЂС‹С‚Р° РёР»Рё СЃРЅСЏС‚Р° СЃ РїСѓР±Р»РёРєР°С†РёРё.", 410);
        case "cannot_apply_to_own_shift":
          return fail("РќРµР»СЊР·СЏ РѕС‚РєР»РёРєР°С‚СЊСЃСЏ РЅР° СЃРѕР±СЃС‚РІРµРЅРЅСѓСЋ СЃРјРµРЅСѓ.", 400);
        case "owner_cannot_apply":
          return fail("Р’Р»Р°РґРµР»СЊС†С‹ РџР’Р— РЅРµ РјРѕРіСѓС‚ РѕС‚РєР»РёРєР°С‚СЊСЃСЏ РЅР° СЃРјРµРЅС‹.", 403);
        case "applicant_banned":
          return fail("Р’Р°С€ Р°РєРєР°СѓРЅС‚ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ.", 403);
        case "shift_not_found":
          return fail("РЎРјРµРЅР° РЅРµ РЅР°Р№РґРµРЅР°.", 404);
      }
    }

    throw error;
  }
}
