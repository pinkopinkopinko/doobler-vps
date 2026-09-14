import { describe, expect, it } from "vitest";

import { calculateShiftAttendance } from "@/lib/shift-attendance";

describe("calculateShiftAttendance", () => {
  it("stays hidden until five resolved confirmed shifts are recorded", () => {
    expect(
      calculateShiftAttendance([
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "NO_SHOW" },
        { status: "CANCELLED", applicationStatus: "CANCELLED_BY_WORKER" },
      ]),
    ).toBeNull();
  });

  it("shows a warning at fifty percent attendance", () => {
    expect(
      calculateShiftAttendance([
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "NO_SHOW" },
        { status: "CANCELLED", applicationStatus: "CANCELLED_BY_WORKER" },
        { status: "CANCELLED", applicationStatus: "CANCELLED_BY_WORKER" },
      ]),
    ).toEqual({
      percentage: 50,
      completedCount: 3,
      failedCount: 3,
      totalCount: 6,
      warning: true,
    });
  });

  it("does not penalize employer cancellations or active assignments", () => {
    expect(
      calculateShiftAttendance([
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "CANCELLED", applicationStatus: "CANCELLED_BY_EMPLOYER" },
        { status: "CONFIRMED" },
      ]),
    ).toBeNull();
  });
});
