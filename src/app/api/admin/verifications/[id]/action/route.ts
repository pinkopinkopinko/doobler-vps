import { fail } from "@/lib/api";

export async function POST() {
  return fail("Проверка личности по паспорту отключена.", 410);
}
