import { ok } from "@/lib/api";
import { demoRegions } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

// Регионы — справочник, меняется только сидом/админкой. Кэшируем ответ роута
// на час, чтобы дропдауны в формах не били в БД на каждый рендер.
export const revalidate = 3600;

export async function GET() {
  try {
    const regions = await prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });

    return ok({ regions });
  } catch {
    return ok({ regions: demoRegions });
  }
}
