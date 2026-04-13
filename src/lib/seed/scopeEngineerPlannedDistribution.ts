import type { SeedScopeAllocation } from "./seedProgrammeScopeMetadata";

/**
 * Rewrites `plannedHrs` so the row sum equals `targetSum` (integer), keeping engineer identity,
 * lead flag, and rough weighting from existing planned hrs (or lead=2 / non-lead=1 when null).
 */
export function distributePlannedHoursToTarget(
  allocations: readonly SeedScopeAllocation[],
  targetSum: number
): SeedScopeAllocation[] {
  const n = allocations.length;
  if (n === 0) return [];
  const safeTarget = Math.max(0, Math.round(targetSum));

  const weights = allocations.map((a) => {
    if (a.plannedHrs != null && a.plannedHrs > 0) return a.plannedHrs;
    return a.isLead ? 2 : 1;
  });

  const wsum = weights.reduce((s, w) => s + w, 0);
  if (safeTarget === 0) {
    return allocations.map((a) => ({ ...a, plannedHrs: 0 }));
  }
  if (wsum <= 0) {
    const base = Math.floor(safeTarget / n);
    const rem = safeTarget - base * n;
    return allocations.map((a, i) => ({
      ...a,
      plannedHrs: base + (i < rem ? 1 : 0),
    }));
  }

  const exact = weights.map((w) => (safeTarget * w) / wsum);
  const floors = exact.map((x) => Math.floor(x));
  const remainder = safeTarget - floors.reduce((s, x) => s + x, 0);
  const fracOrder = [...exact.keys()].sort(
    (i, j) => exact[j]! - floors[j]! - (exact[i]! - floors[i]!)
  );
  const ints = [...floors];
  for (let k = 0; k < remainder; k++) {
    ints[fracOrder[k]!]! += 1;
  }

  return allocations.map((a, i) => ({ ...a, plannedHrs: ints[i]! }));
}

export function sumAllocationPlannedHrs(allocations: readonly SeedScopeAllocation[]): number {
  return allocations.reduce((s, a) => s + (a.plannedHrs ?? 0), 0);
}
