import { describe, expect, it } from "vitest";

import { shiftTemplateSchema } from "@/lib/validations/shift-template";

const validTemplate = {
  name: "Вечерняя смена",
  pickupPointId: "",
  title: "Смена в ПВЗ",
  type: "DAY_SHIFT",
  marketplaceId: "marketplace-1",
  cityId: "city-1",
  regionId: "region-1",
  district: "Центр",
  address: "ул. Татарстан, д.1",
  addressSuggestionUri: "dadata-uri",
  landmark: "",
  description: "",
  startAt: "10:00",
  endAt: "20:00",
  paymentAmountRub: "4500",
  paymentType: "FIXED_SHIFT",
  experienceLevelRequired: "LESS_THAN_3_MONTHS",
  isUrgent: false,
};

describe("shiftTemplateSchema", () => {
  it("accepts a complete template without a shift date", () => {
    const parsed = shiftTemplateSchema.parse(validTemplate);

    expect(parsed.name).toBe("Вечерняя смена");
    expect(parsed.paymentAmountRub).toBe(4500);
    expect("shiftDate" in parsed).toBe(false);
  });

  it("requires a selected address when no pickup point is stored", () => {
    const parsed = shiftTemplateSchema.safeParse({
      ...validTemplate,
      addressSuggestionUri: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("allows a template without optional start and end time", () => {
    const parsed = shiftTemplateSchema.parse({
      ...validTemplate,
      startAt: "",
      endAt: "",
    });

    expect(parsed.startAt).toBeNull();
    expect(parsed.endAt).toBeNull();
  });
});
