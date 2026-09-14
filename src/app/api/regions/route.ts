import { unstable_cache } from "next/cache";

import { ok } from "@/lib/api";
import { demoRegions } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

// Регионы — справочник, меняется только сидом/админкой. Поэтому ответы для
// «без поиска» агрессивно кэшируем. Под `q=...` route revalidate отключаем,
// чтобы не плодить серверный кэш по произвольным запросам.
const STATIC_REGIONS_CACHE_HEADER = "private, max-age=600";
const MAX_REGIONS_WITHOUT_QUERY = 200;
const MAX_REGIONS_WITH_QUERY = 50;
const MIN_QUERY_LENGTH = 2;

// Server-side кеш справочника (см. cities/route.ts — та же логика). Один
// ключ на всё, TTL 1 час; q-поиск идёт мимо кеша.
const listAllRegionsCached = unstable_cache(
  async () => {
    return prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
      take: MAX_REGIONS_WITHOUT_QUERY,
    });
  },
  ["regions-list-v1"],
  { revalidate: 3600, tags: ["regions"] },
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qRaw = searchParams.get("q")?.trim() ?? "";
  const q = qRaw.length >= MIN_QUERY_LENGTH ? qRaw : null;
  const cacheHeaders = q ? undefined : { "Cache-Control": STATIC_REGIONS_CACHE_HEADER };

  // Если пользователь начал вводить (qRaw непустой), но ещё короче минимума,
  // считаем поиск «не начатым» и возвращаем пустой список — иначе клиент
  // подумает, что фильтр сработал, и получит весь справочник.
  if (qRaw.length > 0 && !q) {
    return ok({ regions: [] });
  }

  try {
    const regions = q
      ? await prisma.region.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true },
          take: MAX_REGIONS_WITH_QUERY,
        })
      : await listAllRegionsCached();

    return ok({ regions }, cacheHeaders ? { headers: cacheHeaders } : undefined);
  } catch {
    const filtered = q
      ? demoRegions.filter((region) => region.name.toLowerCase().includes(q.toLowerCase()))
      : demoRegions;

    return ok(
      {
        regions: filtered.slice(0, q ? MAX_REGIONS_WITH_QUERY : MAX_REGIONS_WITHOUT_QUERY),
      },
      cacheHeaders ? { headers: cacheHeaders } : undefined,
    );
  }
}
