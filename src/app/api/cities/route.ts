import { ok } from "@/lib/api";
import { demoCities } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

// Список городов — справочник; для запросов без `q` (только regionId или
// без фильтров) разрешаем браузеру кэшировать на 5 минут. Не используем
// route-level `revalidate`, потому что произвольный `q=...` поиск раздул бы
// серверный кэш до неограниченного количества записей.
const STATIC_CITIES_CACHE_HEADER = "private, max-age=300";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regionId = searchParams.get("regionId");
  const q = searchParams.get("q");
  const cacheHeaders = q ? undefined : { "Cache-Control": STATIC_CITIES_CACHE_HEADER };

  try {
    const cities = await prisma.city.findMany({
      where: {
        ...(regionId ? { regionId } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, regionId: true, slug: true },
    });

    return ok({ cities }, cacheHeaders ? { headers: cacheHeaders } : undefined);
  } catch {
    return ok(
      {
        cities: demoCities.filter((city) => {
          if (regionId && city.regionId !== regionId) {
            return false;
          }
          if (q) {
            return city.name.toLowerCase().includes(q.toLowerCase());
          }
          return true;
        }),
      },
      cacheHeaders ? { headers: cacheHeaders } : undefined,
    );
  }
}
