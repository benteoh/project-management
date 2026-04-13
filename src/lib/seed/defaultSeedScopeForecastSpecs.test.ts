import { describe, expect, it } from "vitest";

import { SEED_SCOPE_ENGINEER_FALLBACK } from "./programmeSeedDemo";
import {
  defaultSeedScopeForecastSpecs,
  programmeDemoTimesheetTaskCellToScopeId,
  programmeScopeNameForTimesheetDisplay,
} from "./seedProgrammeScopeMetadata";
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

describe("programmeScopeNameForTimesheetDisplay", () => {
  it("strips leading list number from scope titles", () => {
    expect(programmeScopeNameForTimesheetDisplay("11. CGMM - Early Design Workstream")).toBe(
      "CGMM - Early Design Workstream"
    );
    expect(programmeScopeNameForTimesheetDisplay("12. NR Boiler Room")).toBe("NR Boiler Room");
  });
});

describe("programmeDemoTimesheetTaskCellToScopeId", () => {
  const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);

  it("resolves Task cell without number prefix", () => {
    const s11 = specs.find((s) => s.scopeId === "s11")!;
    const label = programmeScopeNameForTimesheetDisplay(s11.name);
    expect(programmeDemoTimesheetTaskCellToScopeId(label, specs)).toBe("s11");
  });
});
