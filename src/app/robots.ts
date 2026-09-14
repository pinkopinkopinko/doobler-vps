import type { MetadataRoute } from "next";

const SITE_URL = "https://doobler.ru";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/offer", "/privacy"],
        disallow: [
          "/telegram/",
          "/admin",
          "/admin/",
          "/admin-login",
          "/api/",
          "/uploads/",
          "/onboarding",
          "/profile",
          "/profiles/",
          "/shifts",
          "/shifts/",
          "/posts",
          "/applications",
          "/chats",
          "/chats/",
          "/home",
          "/reviews",
          "/moderation",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
