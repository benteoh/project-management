type PlannedHoursRow = { plannedHrs: number | null };

/** True when summed planned hours per engineer matches scope total (2 dp). */
export function plannedAllocationMatchesScope(
  scopeTotalHours: number | null,
  engineers: PlannedHoursRow[]
): boolean {
  if (scopeTotalHours === null) return true;
  const sum = sumPlannedHours(engineers);
  return Math.round(sum * 100) === Math.round(scopeTotalHours * 100);
}

export function sumPlannedHours(engineers: PlannedHoursRow[]): number {
  return engineers.reduce((s, e) => s + (e.plannedHrs ?? 0), 0);
}

/** Tooltip copy when planned sum ≠ scope total; `undefined` when aligned or scope total unset. */
export function allocationMismatchExplanation(
  scopeTotalHours: number | null,
  engineers: PlannedHoursRow[]
): string | undefined {
  if (scopeTotalHours === null || plannedAllocationMatchesScope(scopeTotalHours, engineers)) {
    return undefined;
  }
  const sum = sumPlannedHours(engineers);
  return `Planned hours (${sum}) do not match scope total (${scopeTotalHours}) — click to edit`;
}
