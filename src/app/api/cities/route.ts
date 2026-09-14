import { unstable_cache } from "next/cache";

import { ok } from "@/lib/api";
import { demoCities } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

// Список городов — справочник; для запросов без `q` (только regionId или
// без фильтров) разрешаем браузеру кэшировать на 5 минут. Не используем
// route-level `revalidate`, потому что произвольный `q=...` поиск раздул бы
// серверный кэш до неограниченного количества записей.
const STATIC_CITIES_CACHE_HEADER = "private, max-age=300";

// Лимиты на выдачу. Справочник у нас небольшой (~десятки городов), но
// endpoint публичный, поэтому жёстко режем: без `q` выдаём до 500 записей
// (с запасом на рост); для `q`-поиска требуем минимум 2 символа и режем
// до 50 результатов, чтобы «q=а» не сканировал всю таблицу.
const MAX_CITIES_WITHOUT_QUERY = 500;
const MAX_CITIES_WITH_QUERY = 50;
const MIN_QUERY_LENGTH = 2;

// Server-side кеш для справочника. Cities меняются только сидом / админкой,
// поэтому держим 1 час. Серверный кеш шерится между всеми пользователями,
// в отличие от `Cache-Control: private`, который работает только в браузере
// каждого юзера. Кеш ключуется по `regionId` — конечное число ключей,
// взрыва кеша нет. `q`-поиск кешировать НЕ нужно: ключей бесконечно много,
// и сам запрос уже редкий (юзер вводит вручную).
const listAllCitiesCached = unstable_cache(
  async (regionId: string | null) => {
    return prisma.city.findMany({
      where: regionId ? { regionId } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true, regionId: true, slug: true },
      take: MAX_CITIES_WITHOUT_QUERY,
    });
  },
  ["cities-list-v1"],
  { revalidate: 3600, tags: ["cities"] },
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regionId = searchParams.get("regionId");
  const qRaw = searchParams.get("q")?.trim() ?? "";
  const q = qRaw.length >= MIN_QUERY_LENGTH ? qRaw : null;
  const cacheHeaders = q ? undefined : { "Cache-Control": STATIC_CITIES_CACHE_HEADER };

  // Если q передан, но короче MIN_QUERY_LENGTH — считаем, что поиск ещё не
  // начался, и возвращаем пустой список. Альтернатива «игнорировать q и
  // вернуть всё» — плохая идея: клиент подумал, что ищет, и получил
  // неожиданный результат.
  if (qRaw.length > 0 && !q) {
    return ok({ cities: [] });
  }

  try {
    const cities = q
      ? await prisma.city.findMany({
          where: {
            ...(regionId ? { regionId } : {}),
            name: { contains: q, mode: "insensitive" },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, regionId: true, slug: true },
          take: MAX_CITIES_WITH_QUERY,
        })
      : await listAllCitiesCached(regionId ?? null);

    return ok({ cities }, cacheHeaders ? { headers: cacheHeaders } : undefined);
  } catch {
    const filtered = demoCities.filter((city) => {
      if (regionId && city.regionId !== regionId) {
        return false;
      }
      if (q) {
        return city.name.toLowerCase().includes(q.toLowerCase());
      }
      return true;
    });

    return ok(
      {
        cities: filtered.slice(0, q ? MAX_CITIES_WITH_QUERY : MAX_CITIES_WITHOUT_QUERY),
      },
      cacheHeaders ? { headers: cacheHeaders } : undefined,
    );
  }
}
