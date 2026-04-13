import { describe, expect, it } from "vitest";

import {
  distributePlannedHoursToTarget,
  sumAllocationPlannedHrs,
} from "./scopeEngineerPlannedDistribution";

describe("distributePlannedHoursToTarget", () => {
  it("matches target sum and preserves row count", () => {
    const out = distributePlannedHoursToTarget(
      [
        { code: "A", isLead: true, plannedHrs: 40 },
        { code: "B", isLead: false, plannedHrs: 20 },
      ],
      255
    );
    expect(sumAllocationPlannedHrs(out)).toBe(255);
    expect(out[0]!.code).toBe("A");
    expect(out[0]!.plannedHrs! + out[1]!.plannedHrs!).toBe(255);
  });

  it("handles null planned hrs using lead weight", () => {
    const out = distributePlannedHoursToTarget(
      [
        { code: "A", isLead: true, plannedHrs: null },
        { code: "B", isLead: false, plannedHrs: null },
      ],
      100
    );
    expect(sumAllocationPlannedHrs(out)).toBe(100);
    expect(out[0]!.plannedHrs!).toBeGreaterThan(out[1]!.plannedHrs!);
  });
});
