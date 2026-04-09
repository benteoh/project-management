import type { CellValues } from "@/components/forecast/forecastGridTypes";

/** True if any cell has a positive numeric hour value (used for draft vs server conflict). */
export function cellValuesHasPositiveHours(values: CellValues): boolean {
  for (const row of Object.values(values)) {
    for (const v of Object.values(row)) {
      if (typeof v === "number" && v > 0) return true;
    }
  }
  return false;
}
