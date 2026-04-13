import { describe, expect, it } from "vitest";

import type { ProgrammeNode } from "@/components/programme/types";
import type { EngineerPoolEntry } from "@/types/engineer-pool";

import { estimateScopeQuotationGbp } from "./scopeQuotationEstimate";

function scopeWithEng(engineers: NonNullable<ProgrammeNode["engineers"]>): ProgrammeNode {
  return {
    id: "s1",
    name: "Test scope",
    type: "scope",
    totalHours: 100,
    start: "",
    finish: "",
    status: "",
    children: [],
    engineers,
  };
}

describe("estimateScopeQuotationGbp", () => {
  const pool: EngineerPoolEntry[] = [
    { id: "e1", code: "AB", firstName: "A", lastName: "B", rates: [100, 80, null, null, null] },
  ];

  it("sums planned hours × slot rate", () => {
    const scope = scopeWithEng([
      { engineerId: "e1", isLead: true, plannedHrs: 10, weeklyScopeLimitHrs: null, rate: "A" },
    ]);
    expect(estimateScopeQuotationGbp(scope, pool)).toEqual({
      subtotalGbp: 1000,
      warnings: [],
    });
  });

  it("uses0 when planned hours null", () => {
    const scope = scopeWithEng([
      { engineerId: "e1", isLead: false, plannedHrs: null, weeklyScopeLimitHrs: null, rate: "B" },
    ]);
    expect(estimateScopeQuotationGbp(scope, pool).subtotalGbp).toBe(0);
  });

  it("warns when £/hr missing for slot", () => {
    const scope = scopeWithEng([
      { engineerId: "e1", isLead: false, plannedHrs: 5, weeklyScopeLimitHrs: null, rate: "C" },
    ]);
    const r = estimateScopeQuotationGbp(scope, pool);
    expect(r.subtotalGbp).toBe(0);
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toContain("missing £/hr");
  });
});
