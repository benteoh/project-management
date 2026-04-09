import { describe, expect, it } from "vitest";

import { deriveScopeRateFromAllocations, normalizeScopeRate } from "./scopeRateSlots";

describe("scopeRateSlots", () => {
  it("normalizeScopeRate defaults invalid to A", () => {
    expect(normalizeScopeRate(undefined)).toBe("A");
    expect(normalizeScopeRate("")).toBe("A");
    expect(normalizeScopeRate("Z")).toBe("A");
  });

  it("deriveScopeRateFromAllocations uses first row", () => {
    expect(deriveScopeRateFromAllocations([])).toBe("A");
    expect(deriveScopeRateFromAllocations([{ rate: "C" }])).toBe("C");
  });
});
