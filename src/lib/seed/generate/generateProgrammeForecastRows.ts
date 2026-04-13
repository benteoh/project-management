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

/** Spread `target` whole hours across `weekdays` (one row per day max); sum of values = target. */
function hoursByWeekday(target: number, weekdays: string[], rng: SeededRng): Map<string, number> {
  const out = new Map<string, number>();
  const n = weekdays.length;
  if (target <= 0 || n === 0) return out;

  const order = [...weekdays];
  rng.shuffleInPlace(order);
  const base = Math.floor(target / n);
  const remainder = target % n;
  for (let i = 0; i < n; i++) {
    const h = base + (i < remainder ? 1 : 0);
    if (h > 0) out.set(order[i]!, h);
  }
  return out;
}

/** Adjust row hours so sums change by `delta` (positive = add). Drops rows that reach 0 hours. */
function applyHoursDelta(rows: ProgrammeForecastRow[], delta: number): void {
  if (delta === 0 || rows.length === 0) return;

  rows.sort((a, b) => a.date.localeCompare(b.date));

  if (delta > 0) {
    let i = rows.length - 1;
    let left = delta;
    while (left > 0) {
      rows[i]!.hours += 1;
      left--;
      i = (i - 1 + rows.length) % rows.length;
    }
    return;
  }

  let need = -delta;
  for (let i = rows.length - 1; i >= 0 && need > 0; i--) {
    const r = rows[i]!;
    const sub = Math.min(need, r.hours - 1);
    if (sub > 0) {
      r.hours -= sub;
      need -= sub;
    }
  }

  while (need > 0 && rows.length > 0) {
    const r = rows[rows.length - 1]!;
    if (r.hours <= need) {
      need -= r.hours;
      rows.pop();
    } else {
      r.hours -= need;
      need = 0;
    }
  }
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
 * For each engineer: spread a **target** hours across **all** weekdays in [startIso, endIso], then keep only
 * weekdays ≤ `planEndIso` and **reconcile** so the sum of kept rows equals that target (when possible).
 */
export function generateForecastRowsForScope(
  p: GenerateForecastRowsForScopeParams
): ProgrammeForecastRow[] {
  const fullWeekdays = iterateWeekdaysInclusive(p.startIso, p.endIso);
  const rows: ProgrammeForecastRow[] = [];

  for (const a of p.allocations) {
    const planned = Math.max(0, Math.round(a.plannedHrs));
    if (planned <= 0) continue;

    const vMin = p.varianceFactorMin ?? DEMO_FORECAST_VARIANCE_FACTOR_MIN;
    const vMax = p.varianceFactorMax ?? DEMO_FORECAST_VARIANCE_FACTOR_MAX;
    const target = p.exactPlanned
      ? planned
      : Math.max(0, Math.round(planned * (vMin + p.rng.next() * Math.max(0, vMax - vMin))));

    if (target <= 0) continue;

    if (fullWeekdays.length === 0) continue;

    const byDay = hoursByWeekday(target, fullWeekdays, p.rng);
    const kept: ProgrammeForecastRow[] = [];
    for (const [date, hours] of byDay) {
      if (date.localeCompare(p.planEndIso) > 0) continue;
      kept.push({
        projectId: p.projectId,
        scopeId: p.scopeId,
        engineerCode: a.code,
        date,
        hours,
      });
    }

    const sumKept = kept.reduce((s, r) => s + r.hours, 0);
    let diff = target - sumKept;

    if (kept.length === 0 && target > 0) {
      const capEnd = minIso(p.endIso, p.planEndIso);
      const fallbackDays = iterateWeekdaysInclusive(p.startIso, capEnd);
      if (fallbackDays.length > 0) {
        const last = fallbackDays[fallbackDays.length - 1]!;
        kept.push({
          projectId: p.projectId,
          scopeId: p.scopeId,
          engineerCode: a.code,
          date: last,
          hours: target,
        });
        diff = 0;
      }
    }

    if (diff !== 0) {
      applyHoursDelta(kept, diff);
    }

    const filtered = kept.filter((r) => r.hours > 0);
    rows.push(...filtered);
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
