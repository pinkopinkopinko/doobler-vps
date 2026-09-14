import { describe, expect, it } from "vitest";

import { formatCompactShiftAddress, formatShiftLocation } from "@/lib/utils";

describe("shift location formatting", () => {
  it("removes regional parts and normalizes street and house labels", () => {
    expect(
      formatShiftLocation(
        "Казань",
        "Вахитовский р-н",
        "респ Татарстан, г Казань, Вахитовский р-н, ул Татарстан, д 1",
      ),
    ).toBe("Казань, Вахитовский р-н, ул. Татарстан, д.1");
  });

  it("keeps only the street-level address for compact storage", () => {
    expect(
      formatCompactShiftAddress(
        "Екатеринбург",
        "Ленинский р-н",
        "Свердловская обл, г Екатеринбург, Ленинский р-н, ул Малышева, д 10",
      ),
    ).toBe("ул. Малышева, д.10");
  });
});
