import { z } from "zod";

import { fail, ok } from "@/lib/api";
import { getSessionPayload } from "@/lib/auth/session";
import { requireTrustedMutationRequest } from "@/lib/auth/mutation-guard";
import { CONSENT_PURPOSES } from "@/lib/legal-consents";
import {
  getConsentState,
  recordConsentDecision,
  recordOfferAcceptance,
} from "@/server/services/legal-consent-service";

const consentEventSchema = z.object({
  purpose: z.enum(CONSENT_PURPOSES),
  granted: z.boolean(),
  source: z.string().trim().max(80).optional(),
});

const offerEventSchema = z.object({
  purpose: z.literal("OFFER_ACCEPTANCE"),
  accepted: z.literal(true),
  source: z.string().trim().max(80).optional(),
});

export async function GET() {
  const session = await getSessionPayload();
  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  return ok({ consents: await getConsentState(session.userId) });
}

export async function POST(request: Request) {
  const session = await getSessionPayload();
  if (!session) {
    return fail("Нужен вход через Telegram.", 401);
  }

  const untrusted = requireTrustedMutationRequest(request, {
    sessionTelegramId: session.telegramId,
  });
  if (untrusted) return untrusted;

  const body = await request.json().catch(() => null);
  const consentResult = consentEventSchema.safeParse(body);
  if (consentResult.success) {
    await recordConsentDecision({
      userId: session.userId,
      purpose: consentResult.data.purpose,
      granted: consentResult.data.granted,
      source: consentResult.data.source,
    });
    return ok({ consents: await getConsentState(session.userId) });
  }

  const offerResult = offerEventSchema.safeParse(body);
  if (offerResult.success) {
    await recordOfferAcceptance({
      userId: session.userId,
      source: offerResult.data.source,
    });
    return ok({ accepted: true });
  }

  return fail("Некорректные параметры юридического действия.", 400);
}
