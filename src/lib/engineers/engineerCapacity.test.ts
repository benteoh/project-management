import { describe, expect, it } from "vitest";

import { sumCapacityDays, weeklyHoursToFiveDays } from "./engineerCapacity";

describe("weeklyHoursToFiveDays", () => {
  it("returns null tuple for null input", () => {
    expect(weeklyHoursToFiveDays(null)).toEqual([null, null, null, null, null]);
  });

  it("sums to the clamped weekly total (40h → 8h × 5)", () => {
    const row = weeklyHoursToFiveDays(40);
    expect(sumCapacityDays(row)).toBe(40);
    expect(row.every((d) => d === 8)).toBe(true);
  });

  it("distributes remainder from Friday backward (6h week)", () => {
    const row = weeklyHoursToFiveDays(6);
    expect(sumCapacityDays(row)).toBe(6);
  });
});
