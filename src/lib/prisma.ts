import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, Prisma } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Явно падаем, если DATABASE_URL не задан, вместо того чтобы молча коннектиться
// к "postgres:postgres@localhost". Тихий fallback опасен: в проде мы либо
// получаем невнятную connection error, либо, если локальный postgres есть,
// начинаем писать в неправильную БД. Лучше упасть на старте с понятной
// ошибкой — пусть конфиг починят явно.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Configure it in .env.local / environment before starting the app.",
  );
}

// PRISMA_QUERY_LOG=1 включает per-query SQL логирование с длительностью и
// слепком первого Prisma-вызова в стеке. Полезно когда страница или роут
// внезапно начинает грузиться 5+ секунд — видно, какой именно SELECT долгий
// и из какого сервиса он пришёл. По умолчанию выключено, чтобы не флудить
// stdout на каждый запрос.
const PRISMA_QUERY_LOG = process.env.PRISMA_QUERY_LOG === "1";
const SLOW_QUERY_MS = Number(process.env.PRISMA_SLOW_QUERY_MS ?? 200);

const log: Prisma.LogDefinition[] =
  process.env.NODE_ENV === "development"
    ? PRISMA_QUERY_LOG
      ? [
          { level: "query", emit: "event" },
          { level: "warn", emit: "stdout" },
          { level: "error", emit: "stdout" },
        ]
      : [
          { level: "warn", emit: "stdout" },
          { level: "error", emit: "stdout" },
        ]
    : [{ level: "error", emit: "stdout" }];

const client =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(connectionString),
    log,
  });

if (PRISMA_QUERY_LOG && !globalForPrisma.prisma) {
  // @ts-expect-error — emit:'event' for 'query' level produces a typed event
  // bus that the stock PrismaClient typings don't surface.
  client.$on("query", (event: Prisma.QueryEvent) => {
    const truncatedQuery = event.query.length > 240 ? `${event.query.slice(0, 240)}…` : event.query;
    if (event.duration >= SLOW_QUERY_MS) {
      console.warn("[prisma:slow]", {
        durationMs: event.duration,
        query: truncatedQuery,
        params: event.params,
      });
    } else {
      console.info("[prisma]", {
        durationMs: event.duration,
        query: truncatedQuery,
      });
    }
  });
}

export const prisma = client;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
