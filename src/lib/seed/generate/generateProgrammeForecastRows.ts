import type { SeededRng } from "../seedDeterministicRandom";
import { iterateWeekdaysInclusive, minIso } from "../isoDateUtc";

export type ProgrammeForecastRow = {
  projectId: string;
  scopeId: string;
  engineerCode: string;
  date: string;
  /** Whole hours only (integer). */
  hours: number;
};

export type ScopeForecastAllocation = {
  code: string;
  plannedHrs: number;
};

/** For “variance” scopes: forecast target = planned × factor in this range (seeded). */
export const DEMO_FORECAST_VARIANCE_FACTOR_MIN = 0.94;
export const DEMO_FORECAST_VARIANCE_FACTOR_MAX = 1.06;

/** Whole hours per engineer per scope per calendar day (matches working-day cap in timesheet rows). */
export const MAX_FORECAST_HOURS_PER_DAY = 8;

/**
 * First half of scope ids (sorted) use forecast totals = planned_hrs after the April cut, unless a
 * scope is listed in programme demo `DEMO_FORECAST_ABOVE_PLANNED_VARIANCE` (see
 * `programmeDemoForecastScopePayload`). Other scopes use a jittered target in
 * {@link DEMO_FORECAST_VARIANCE_FACTOR_MIN}…{@link DEMO_FORECAST_VARIANCE_FACTOR_MAX}.
 */
export function demoExactPlannedScopeIds(scopeIds: readonly string[]): Set<string> {
  const sorted = [...scopeIds].sort();
  const nExact = Math.floor(sorted.length / 2);
  return new Set(sorted.slice(0, nExact));
}

/**
 * Spread `target` whole hours across `weekdays`, at most `maxPerDay` per day (round-robin, shuffled order).
 * Places `min(target, weekdays.length * maxPerDay)` hours. One forecast row per weekday key in the map.
 */
function hoursByWeekdayCapped(
  target: number,
  weekdays: string[],
  rng: SeededRng,
  maxPerDay: number
): Map<string, number> {
  const out = new Map<string, number>();
  const n = weekdays.length;
  if (target <= 0 || n === 0) return out;

  const cap = Math.min(target, n * maxPerDay);
  const order = [...weekdays];
  rng.shuffleInPlace(order);
  let left = cap;
  let idx = 0;
  const maxIterations = cap * n + n + 5;
  let iterations = 0;
  while (left > 0 && iterations < maxIterations) {
    iterations++;
    const d = order[idx % n]!;
    idx++;
    const cur = out.get(d) ?? 0;
    if (cur >= maxPerDay) continue;
    out.set(d, cur + 1);
    left--;
  }
  return out;
}

export type GenerateForecastRowsForScopeParams = {
  projectId: string;
  scopeId: string;
  startIso: string;
  endIso: string;
  allocations: readonly ScopeForecastAllocation[];
  rng: SeededRng;
  /** Rows with date > this (ISO) are dropped after full-duration spread; totals are reconciled on kept rows. */
  planEndIso: string;
  /** When true, post-cut totals per engineer match `plannedHrs`; when false, match a jittered target. */
  exactPlanned: boolean;
  /**
   * When `exactPlanned` is false, per-engineer target = planned × U(min,max).
   * Defaults to {@link DEMO_FORECAST_VARIANCE_FACTOR_MIN} / {@link DEMO_FORECAST_VARIANCE_FACTOR_MAX}.
   */
  varianceFactorMin?: number;
  varianceFactorMax?: number;
};

/**
 * For each engineer: spread **target** hours across weekdays in [startIso, min(endIso, planEndIso)],
 * at most {@link MAX_FORECAST_HOURS_PER_DAY} per day (DB allows one row per engineer/scope/date).
 */
export function generateForecastRowsForScope(
  p: GenerateForecastRowsForScopeParams
): ProgrammeForecastRow[] {
  const capEnd = minIso(p.endIso, p.planEndIso);
  const eligibleWeekdays = iterateWeekdaysInclusive(p.startIso, capEnd);
  const rows: ProgrammeForecastRow[] = [];
  const maxPerDay = MAX_FORECAST_HOURS_PER_DAY;

  for (const a of p.allocations) {
    const planned = Math.max(0, Math.round(a.plannedHrs));
    if (planned <= 0) continue;

    const vMin = p.varianceFactorMin ?? DEMO_FORECAST_VARIANCE_FACTOR_MIN;
    const vMax = p.varianceFactorMax ?? DEMO_FORECAST_VARIANCE_FACTOR_MAX;
    const target = p.exactPlanned
      ? planned
      : Math.max(0, Math.round(planned * (vMin + p.rng.next() * Math.max(0, vMax - vMin))));

    if (target <= 0) continue;

    if (eligibleWeekdays.length === 0) continue;

    const byDay = hoursByWeekdayCapped(target, eligibleWeekdays, p.rng, maxPerDay);
    for (const [date, hours] of byDay) {
      if (hours <= 0) continue;
      rows.push({
        projectId: p.projectId,
        scopeId: p.scopeId,
        engineerCode: a.code,
        date,
        hours,
      });
    }
  }

  rows.sort((a, b) => {
    const da = a.date.localeCompare(b.date);
    if (da !== 0) return da;
    const ds = a.scopeId.localeCompare(b.scopeId);
    if (ds !== 0) return ds;
    return a.engineerCode.localeCompare(b.engineerCode);
  });

  return rows;
}

export type GenerateProgrammeForecastRowsParams = {
  projectId: string;
  scopes: readonly {
    scopeId: string;
    startIso: string;
    endIso: string;
    allocations: readonly ScopeForecastAllocation[];
    exactPlanned: boolean;
    varianceFactorMin?: number;
    varianceFactorMax?: number;
  }[];
  rng: SeededRng;
  planEndIso: string;
};

export function generateProgrammeForecastRows(
  p: GenerateProgrammeForecastRowsParams
): ProgrammeForecastRow[] {
  const all: ProgrammeForecastRow[] = [];
  for (const s of p.scopes) {
    all.push(
      ...generateForecastRowsForScope({
        projectId: p.projectId,
        scopeId: s.scopeId,
        startIso: s.startIso,
        endIso: s.endIso,
        allocations: s.allocations,
        rng: p.rng,
        planEndIso: p.planEndIso,
        exactPlanned: s.exactPlanned,
        varianceFactorMin: s.varianceFactorMin,
        varianceFactorMax: s.varianceFactorMax,
      })
    );
  }
  all.sort((a, b) => {
    const da = a.date.localeCompare(b.date);
    if (da !== 0) return da;
    const ds = a.scopeId.localeCompare(b.scopeId);
    if (ds !== 0) return ds;
    return a.engineerCode.localeCompare(b.engineerCode);
  });
  return all;
}
