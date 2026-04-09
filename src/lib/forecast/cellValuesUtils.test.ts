import { describe, it, expect } from "vitest";

import type { CellValues } from "@/components/forecast/forecastGridTypes";

import { cellValuesHasPositiveHours } from "./cellValuesUtils";

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
