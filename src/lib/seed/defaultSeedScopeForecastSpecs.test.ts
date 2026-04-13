import { describe, expect, it } from "vitest";

import { SEED_SCOPE_ENGINEER_FALLBACK } from "./programmeSeedDemo";
import { defaultSeedScopeForecastSpecs } from "./seedProgrammeScopeMetadata";
import { sumAllocationPlannedHrs } from "./scopeEngineerPlannedDistribution";

describe("defaultSeedScopeForecastSpecs planned_hrs", () => {
  const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);

  it("matches scope totalHours for neutral scopes (not under/over demo scopes)", () => {
    for (const s of specs) {
      if (s.isUnderAllocated || s.isOverAllocated) continue;
      expect(sumAllocationPlannedHrs(s.allocations)).toBe(s.totalHours);
    }
  });

  it("sums below totalHours for under-allocated demo scopes", () => {
    for (const s of specs) {
      if (!s.isUnderAllocated) continue;
      const sum = sumAllocationPlannedHrs(s.allocations);
      expect(sum).toBeLessThan(s.totalHours);
      expect(sum).toBeGreaterThan(0);
    }
  });

  it("marks s14, s17, s19 as under-allocated", () => {
    expect(specs.find((s) => s.scopeId === "s14")?.isUnderAllocated).toBe(true);
    expect(specs.find((s) => s.scopeId === "s17")?.isUnderAllocated).toBe(true);
    expect(specs.find((s) => s.scopeId === "s19")?.isUnderAllocated).toBe(true);
    expect(specs.find((s) => s.scopeId === "s12")?.isUnderAllocated).toBe(false);
  });

  it("sums above totalHours for over-allocated demo scopes", () => {
    for (const s of specs) {
      if (!s.isOverAllocated) continue;
      const sum = sumAllocationPlannedHrs(s.allocations);
      expect(sum).toBeGreaterThan(s.totalHours);
    }
  });

  it("marks s12, s15, s18 as over-allocated", () => {
    expect(specs.find((s) => s.scopeId === "s12")?.isOverAllocated).toBe(true);
    expect(specs.find((s) => s.scopeId === "s15")?.isOverAllocated).toBe(true);
    expect(specs.find((s) => s.scopeId === "s18")?.isOverAllocated).toBe(true);
    expect(specs.find((s) => s.scopeId === "s13")?.isOverAllocated).toBe(false);
  });
});
