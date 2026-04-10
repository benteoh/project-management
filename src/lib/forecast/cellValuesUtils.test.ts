import { describe, it, expect } from "vitest";

import type { CellValues } from "@/components/forecast/forecastGridTypes";

import { cellValuesHasPositiveHours, filterCellValuesToValidProgramme } from "./cellValuesUtils";
import { forecastRowId } from "./forecastRowId";

describe("filterCellValuesToValidProgramme", () => {
  const scopeA = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const scopeB = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee";
  const eng1 = "11111111-2222-3333-4444-555555555555";
  const eng2 = "22222222-3333-4444-5555-666666666666";
  const rowValid = forecastRowId(scopeA, eng1);

  it("keeps rows whose scope and engineer are allowed", () => {
    const v: CellValues = {
      [rowValid]: { "2026-01-06": 4 },
      "bad-row": { "2026-01-06": 1 },
    };
    const out = filterCellValuesToValidProgramme(v, new Set([scopeA]), new Set([eng1]));
    expect(out).toEqual({ [rowValid]: { "2026-01-06": 4 } });
  });

  it("drops rows for unknown engineer (stale draft UUID)", () => {
    const staleRow = forecastRowId(scopeA, eng2);
    const v: CellValues = {
      [staleRow]: { "2026-01-06": 8 },
    };
    const out = filterCellValuesToValidProgramme(v, new Set([scopeA]), new Set([eng1]));
    expect(out).toEqual({});
  });

  it("drops rows for unknown scope", () => {
    const v: CellValues = {
      [forecastRowId(scopeB, eng1)]: { "2026-01-06": 1 },
    };
    const out = filterCellValuesToValidProgramme(v, new Set([scopeA]), new Set([eng1]));
    expect(out).toEqual({});
  });
});

describe("cellValuesHasPositiveHours", () => {
  it("returns false for empty object", () => {
    expect(cellValuesHasPositiveHours({})).toBe(false);
  });

  it("returns false when all values are zero, null, or negative", () => {
    const v: CellValues = {
      "s-1": { "2026-01-05": 0, "2026-01-06": -1 },
    };
    expect(cellValuesHasPositiveHours(v)).toBe(false);
  });

  it("returns false when only non-number values exist", () => {
    const v: CellValues = {
      "s-1": { "2026-01-05": "foo" as unknown as number },
    };
    expect(cellValuesHasPositiveHours(v)).toBe(false);
  });

  it("returns true when any cell has a positive number", () => {
    const v: CellValues = {
      "s-1": { "2026-01-05": 0, "2026-01-06": 1 },
    };
    expect(cellValuesHasPositiveHours(v)).toBe(true);
  });
});
