import type { CellValues } from "@/components/forecast/forecastGridTypes";

import { parseForecastRowId } from "./forecastRowId";

/**
 * Keeps only rows whose scope and engineer ids exist in the current programme / pool.
 * Drops stale keys (e.g. localStorage after reseed) that would violate `forecast_entries` FKs.
 */
export function filterCellValuesToValidProgramme(
  values: CellValues,
  allowedScopeIds: ReadonlySet<string>,
  allowedEngineerIds: ReadonlySet<string>
): CellValues {
  const out: CellValues = {};
  for (const [rowId, fields] of Object.entries(values)) {
    const parsed = parseForecastRowId(rowId);
    if (!parsed) continue;
    if (!allowedScopeIds.has(parsed.scopeId) || !allowedEngineerIds.has(parsed.engineerId)) {
      continue;
    }
    out[rowId] = fields;
  }
  return out;
}

/** True if any cell has a positive numeric hour value (used for draft vs server conflict). */
export function cellValuesHasPositiveHours(values: CellValues): boolean {
  for (const row of Object.values(values)) {
    for (const v of Object.values(row)) {
      if (typeof v === "number" && v > 0) return true;
    }
  }
  return false;
}
