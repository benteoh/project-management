import type { ActivitySort } from "./activityQuery";

/** Maps UI columns to `ActivitySort` values (single source for header + `toggleSort`). */
export const PROGRAMME_SORT_COLUMN_MAP = {
  total: { asc: "totalAsc" as const, desc: "totalDesc" as const },
  start: { asc: "startAsc" as const, desc: "startDesc" as const },
  finish: { asc: "finishAsc" as const, desc: "finishDesc" as const },
} as const;

export type ProgrammeSortColumn = keyof typeof PROGRAMME_SORT_COLUMN_MAP;

export function programmeSortDirectionFor(
  sort: ActivitySort,
  column: ProgrammeSortColumn
): "asc" | "desc" | null {
  const m = PROGRAMME_SORT_COLUMN_MAP[column];
  if (sort === m.asc) return "asc";
  if (sort === m.desc) return "desc";
  return null;
}

export function programmeIsSortedColumn(sort: ActivitySort, column: ProgrammeSortColumn): boolean {
  return programmeSortDirectionFor(sort, column) !== null;
}
