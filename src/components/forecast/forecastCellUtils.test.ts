import { describe, it, expect } from "vitest";

import {
  cellNumeric,
  detectFillPattern,
  displayValue,
  evalFormula,
  normSel,
} from "./forecastCellUtils";

describe("evalFormula", () => {
  it("returns raw string when not a formula", () => {
    expect(evalFormula("42")).toBe("42");
  });

  it("evaluates simple arithmetic", () => {
    expect(evalFormula("=1+2*3")).toBe(7);
  });

  it("returns #ERROR for invalid or empty expression", () => {
    expect(evalFormula("=1++")).toBe("#ERROR");
    expect(evalFormula("=")).toBe("#ERROR");
  });

  it("strips letters so injected identifiers cannot run as code", () => {
    // "alert(1)" becomes "(1)" after stripping — still only arithmetic, not a call
    expect(evalFormula("=2+alert(1)")).toBe(3);
    expect(evalFormula("=1+abc")).toBe("#ERROR");
  });
});

describe("cellNumeric", () => {
  it("treats null and empty as 0", () => {
    expect(cellNumeric(null)).toBe(0);
    expect(cellNumeric("")).toBe(0);
  });

  it("parses numbers and formula results", () => {
    expect(cellNumeric("3.5")).toBe(3.5);
    expect(cellNumeric("=10/4")).toBe(2.5);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(cellNumeric("abc")).toBe(0);
  });
});

describe("displayValue", () => {
  it("shows evaluated formula for =… cells", () => {
    expect(displayValue("=2+2")).toBe("4");
  });

  it("stringifies plain values", () => {
    expect(displayValue(5)).toBe("5");
    expect(displayValue(null)).toBe("");
  });
});

describe("detectFillPattern", () => {
  it("returns null fills when source has no numbers", () => {
    const fill = detectFillPattern([null, null]);
    expect(fill(0)).toBeNull();
  });

  it("repeats single value", () => {
    const fill = detectFillPattern([5]);
    expect(fill(0)).toBe(5);
    expect(fill(3)).toBe(5);
  });

  it("extends arithmetic sequence", () => {
    const fill = detectFillPattern([1, 3, 5]);
    expect(fill(0)).toBe(7);
    expect(fill(1)).toBe(9);
  });

  it("repeats last value when not arithmetic", () => {
    const fill = detectFillPattern([1, 4, 9]);
    expect(fill(0)).toBe(9);
  });
});

describe("normSel", () => {
  it("normalizes inverted row and column ranges", () => {
    expect(normSel({ r1: 5, r2: 2, c1: 3, c2: 1 })).toEqual({
      r1: 2,
      r2: 5,
      c1: 1,
      c2: 3,
    });
  });
});
