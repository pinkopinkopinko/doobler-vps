import { prisma } from "@/lib/prisma";
import { getSessionPayload } from "@/lib/auth/session";
import { decodeInlineProfilePhoto } from "@/lib/profile-photo";
import { hasActiveConsent } from "@/server/services/legal-consent-service";

type RouteParams = {
  params: Promise<{ userId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSessionPayload();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { userId } = await params;
  if (
    session.userId !== userId &&
    !(await hasActiveConsent(userId, "PUBLIC_PROFILE_DISTRIBUTION"))
  ) {
    return new Response("Profile is not shared", { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { photoUrl: true },
  });

  if (!user?.photoUrl) {
    return new Response("Not found", { status: 404 });
  }

  if (user.photoUrl.startsWith("/api/uploads/")) {
    return Response.redirect(new URL(user.photoUrl, request.url), 307);
  }

  const decoded = decodeInlineProfilePhoto(user.photoUrl);
  if (!decoded) {
    return new Response("Unsupported photo", { status: 415 });
  }

  return new Response(decoded.buffer, {
    status: 200,
    headers: {
      "Content-Type": decoded.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
