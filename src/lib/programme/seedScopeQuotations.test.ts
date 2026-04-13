import { describe, expect, it } from "vitest";

import type { ProgrammeNode } from "@/components/programme/types";

import { applySeedScopeQuotations, SEED_SCOPE_QUOTATION_GBP } from "./seedScopeQuotations";

function scope(id: string): ProgrammeNode {
  return {
    id,
    name: "Test",
    type: "scope",
    totalHours: 100,
    start: "",
    finish: "",
    status: "",
    children: [],
    engineers: [],
  };
}

describe("applySeedScopeQuotations", () => {
  it("applies fixed map for known seed scope ids", () => {
    const out = applySeedScopeQuotations([scope("s11")]);
    expect(out[0]!.quotedAmount).toBe(SEED_SCOPE_QUOTATION_GBP.s11!.quotedAmount);
    expect(out[0]!.quotationWarningAmount).toBeNull();
  });

  it("sets early warning only where defined in map", () => {
    const out = applySeedScopeQuotations([scope("s12")]);
    expect(out[0]!.quotationWarningAmount).toBe(
      SEED_SCOPE_QUOTATION_GBP.s12!.quotationWarningAmount
    );
  });

  it("leaves quotation null for unknown scope ids", () => {
    const out = applySeedScopeQuotations([scope("unknown")]);
    expect(out[0]!.quotedAmount).toBeNull();
    expect(out[0]!.quotationWarningAmount).toBeNull();
  });
});
