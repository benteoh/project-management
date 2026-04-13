import type { SeedProgrammeNode } from "@/lib/programme/seedProgrammeData";
import { seedProgrammeData } from "@/lib/programme/seedProgrammeData";
import { normalise } from "@/lib/timesheet/timesheetImportResolve";

import { parseSeedDisplayDate } from "./parseSeedDisplayDate";
import { distributePlannedHoursToTarget } from "./scopeEngineerPlannedDistribution";

/**
 * Last calendar day (inclusive) **kept** in programme demo forecast / timesheet CSVs.
 * Forecast hours are spread across weekdays from scope start through this date (inclusive), at most
 * 8h per engineer per scope per day (see `MAX_FORECAST_HOURS_PER_DAY` in `generateProgrammeForecastRows`).
 */
export const DEMO_FORECAST_PLAN_END_ISO = "2026-04-17" as const;

/** Demo CSV: `planned_hrs` sum to only a fraction of scope `totalHours`. */
export const DEMO_UNDER_ALLOCATED_SCOPE_IDS = new Set<string>(["s14", "s17", "s19"]);

/** Demo CSV: `planned_hrs` sum **above** scope `totalHours` (resource plan overspend vs WBS). */
export const DEMO_OVER_ALLOCATED_SCOPE_IDS = new Set<string>(["s12", "s15", "s18"]);

/** Target sum of planned_hrs as a fraction of scope totalHours for under-allocated scopes. */
export const DEMO_SCOPE_UNDER_ALLOCATION_RATIO: Readonly<Record<string, number>> = {
  s14: 0.58,
  s17: 0.9,
  s19: 0.63,
};

/** Target sum of planned_hrs as a fraction of scope totalHours for over-allocated scopes (>1). */
export const DEMO_SCOPE_OVER_ALLOCATION_RATIO: Readonly<Record<string, number>> = {
  s12: 1.1,
  s15: 1.09,
  s18: 1.11,
};

/**
 * Demo timesheet vs forecast: per-scope fraction of each forecast slot’s hours written to the
 * timesheet CSV (work incomplete / not logged vs the grid — forecast looks “heavy” vs actuals).
 */
export const DEMO_TIMESHEET_FORECAST_RETENTION: Readonly<Record<string, number>> = {
  s13: 0.74,
  s16: 0.71,
};

/**
 * Demo forecast vs roster: per-engineer target uses U(min,max) on planned_hrs (both ends above 1) so
 * scope forecast totals exceed sum(planned_hrs). Overrides the usual “first half exact” rule for these ids.
 */
export const DEMO_FORECAST_ABOVE_PLANNED_VARIANCE: Readonly<
  Record<string, { min: number; max: number }>
> = {
  s13: { min: 1.05, max: 1.12 },
  s15: { min: 1.06, max: 1.14 },
  s16: { min: 1.05, max: 1.12 },
  s17: { min: 1.04, max: 1.11 },
  s18: { min: 1.07, max: 1.15 },
};

export type ProgrammeDemoForecastScopePayload = {
  scopeId: string;
  startIso: string;
  endIso: string;
  allocations: readonly { code: string; plannedHrs: number }[];
  exactPlanned: boolean;
  varianceFactorMin?: number;
  varianceFactorMax?: number;
};

export function programmeDemoForecastScopePayload(
  spec: {
    scopeId: string;
    startIso: string;
    endIso: string;
    allocations: readonly { code: string; plannedHrs: number }[];
  },
  exactPlannedScopeIds: ReadonlySet<string>
): ProgrammeDemoForecastScopePayload {
  const boost = DEMO_FORECAST_ABOVE_PLANNED_VARIANCE[spec.scopeId];
  if (boost) {
    return {
      scopeId: spec.scopeId,
      startIso: spec.startIso,
      endIso: spec.endIso,
      allocations: spec.allocations,
      exactPlanned: false,
      varianceFactorMin: boost.min,
      varianceFactorMax: boost.max,
    };
  }
  return {
    scopeId: spec.scopeId,
    startIso: spec.startIso,
    endIso: spec.endIso,
    allocations: spec.allocations,
    exactPlanned: exactPlannedScopeIds.has(spec.scopeId),
  };
}

/** True when forecast rows are generated to match planned_hrs per engineer (after plan-end cut). */
export function isProgrammeDemoForecastExactScope(
  scopeId: string,
  exactPlannedScopeIds: ReadonlySet<string>
): boolean {
  if (DEMO_FORECAST_ABOVE_PLANNED_VARIANCE[scopeId]) return false;
  return exactPlannedScopeIds.has(scopeId);
}

/** Strip leading `11. `-style numbering from programme scope titles (timesheet Task / description). */
export function programmeScopeNameForTimesheetDisplay(fullName: string): string {
  return fullName.replace(/^\d+\.\s*/, "").trim();
}

/** CSV Task column is scope display name or legacy scope id — resolve to programme scope id. */
export function programmeDemoTimesheetTaskCellToScopeId(
  taskCell: string,
  specs: ReadonlyArray<{ scopeId: string; name: string }>
): string {
  const t = taskCell.trim();
  for (const s of specs) {
    if (s.scopeId === t) return s.scopeId;
  }
  const key = normalise(t);
  for (const s of specs) {
    if (normalise(s.name) === key) return s.scopeId;
  }
  for (const s of specs) {
    if (normalise(programmeScopeNameForTimesheetDisplay(s.name)) === key) return s.scopeId;
  }
  throw new Error(`Programme demo timesheet: unknown Task column "${taskCell}"`);
}

export type SeedScopeAllocation = {
  code: string;
  isLead: boolean;
  plannedHrs: number | null;
};

export type SeedScopeForecastSpec = {
  scopeId: string;
  name: string;
  /** Programme scope total hours (WBS); full scopes normalize planned_hrs to sum to this. */
  totalHours: number;
  /** When true, planned_hrs sum is intentionally below {@link totalHours}. */
  isUnderAllocated: boolean;
  /** When true, planned_hrs sum is intentionally above {@link totalHours}. */
  isOverAllocated: boolean;
  startIso: string;
  endIso: string;
  allocations: readonly SeedScopeAllocation[];
  /** Activity ids under this scope (for timesheet description prefix). */
  activityIds: readonly string[];
};

function collectActivityIdsDeep(n: SeedProgrammeNode): string[] {
  const out: string[] = [];
  if (n.type === "activity" && n.activityId) out.push(n.activityId);
  for (const c of n.children) out.push(...collectActivityIdsDeep(c));
  return out;
}

export type CollectSeedScopeForecastOptions = {
  fallbackAllocations: readonly SeedScopeAllocation[];
  /** Scopes whose engineer `planned_hrs` sum to a fraction of totalHours only. */
  underAllocatedScopeIds: ReadonlySet<string>;
  /** Scopes whose engineer `planned_hrs` sum exceeds totalHours (demo overspend vs WBS). */
  overAllocatedScopeIds: ReadonlySet<string>;
};

/**
 * Walks top-level programme seed scopes: dates, engineer allocations, activity ids.
 * Scopes with no `engineers` in the static tree use `fallbackAllocations` (e.g. s11 demo roster).
 * Engineer `planned_hrs` are normalized so neutral scopes sum to `totalHours`; under-allocated sum lower;
 * over-allocated sum higher (demo resource plan vs WBS).
 */
export function collectSeedScopeForecastSpecs(
  roots: readonly SeedProgrammeNode[],
  options: CollectSeedScopeForecastOptions
): SeedScopeForecastSpec[] {
  const scopes = roots.filter((n) => n.type === "scope");
  return scopes.map((node) => {
    if (!node.start || !node.finish) {
      throw new Error(`Seed scope ${node.id} missing start/finish`);
    }
    const startIso = parseSeedDisplayDate(node.start);
    const endIso = parseSeedDisplayDate(node.finish);
    const fromSeed = node.engineers?.map((e) => ({
      code: e.code,
      isLead: e.isLead,
      plannedHrs: e.plannedHrs,
    }));
    const rawAllocations = fromSeed && fromSeed.length > 0 ? fromSeed : options.fallbackAllocations;

    const activityIds: string[] = [];
    for (const ch of node.children) {
      activityIds.push(...collectActivityIdsDeep(ch));
    }

    const totalH = node.totalHours ?? 0;
    const isUnderAllocated = options.underAllocatedScopeIds.has(node.id);
    const isOverAllocated = options.overAllocatedScopeIds.has(node.id);
    if (isUnderAllocated && isOverAllocated) {
      throw new Error(`Seed scope ${node.id} cannot be both under- and over-allocated`);
    }
    const ratio = isUnderAllocated
      ? (DEMO_SCOPE_UNDER_ALLOCATION_RATIO[node.id] ?? 0.6)
      : isOverAllocated
        ? (DEMO_SCOPE_OVER_ALLOCATION_RATIO[node.id] ?? 1.1)
        : 1;
    const targetSum =
      totalH > 0 && rawAllocations.length > 0 ? Math.max(1, Math.floor(totalH * ratio)) : 0;
    const allocations =
      totalH > 0 && rawAllocations.length > 0
        ? distributePlannedHoursToTarget(rawAllocations, targetSum)
        : rawAllocations;

    return {
      scopeId: node.id,
      name: node.name,
      totalHours: totalH,
      isUnderAllocated,
      isOverAllocated,
      startIso,
      endIso,
      allocations,
      activityIds,
    };
  });
}

export function defaultSeedScopeForecastSpecs(
  fallbackAllocations: readonly SeedScopeAllocation[],
  underAllocatedScopeIds: ReadonlySet<string> = DEMO_UNDER_ALLOCATED_SCOPE_IDS,
  overAllocatedScopeIds: ReadonlySet<string> = DEMO_OVER_ALLOCATED_SCOPE_IDS
): SeedScopeForecastSpec[] {
  return collectSeedScopeForecastSpecs(seedProgrammeData, {
    fallbackAllocations,
    underAllocatedScopeIds,
    overAllocatedScopeIds,
  });
}
