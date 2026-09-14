import { fail } from "@/lib/api";

export async function GET() {
  return fail("Проверка личности по паспорту отключена.", 410);
}
