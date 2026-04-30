import { ok } from "@/lib/api";
import { demoMarketplaces } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

// Маркетплейсы — практически статичный справочник (4 строки). Кэшируем ответ
// роута на час; обновлять придётся только при добавлении нового маркетплейса.
export const revalidate = 3600;

export async function GET() {
  try {
    const marketplaces = await prisma.marketplace.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return ok({ marketplaces });
  } catch {
    return ok({ marketplaces: demoMarketplaces });
  }
}
