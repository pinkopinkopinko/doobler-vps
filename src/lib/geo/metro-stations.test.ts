import { describe, expect, it } from "vitest";

import { findNearestMetroStation, METRO_STATIONS } from "@/lib/geo/metro-stations";

describe("metro stations dataset", () => {
  it("contains the Kazan metro snapshot", () => {
    const kazanStations = METRO_STATIONS.filter((station) => station.citySlug === "kazan");

    expect(kazanStations).toHaveLength(11);
    expect(kazanStations.map((station) => station.name)).toContain("Кремлёвская");
  });

  it("finds the nearest metro station by coordinates", () => {
    const nearest = findNearestMetroStation({
      citySlug: "kazan",
      lat: 55.7952,
      lng: 49.107,
      maxDistanceMeters: 500,
    });

    expect(nearest?.name).toBe("Кремлёвская");
    expect(nearest?.distanceMeters).toBeLessThan(100);
  });
});
