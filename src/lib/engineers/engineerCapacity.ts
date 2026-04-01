/** Half-hour steps match typical timesheet granularity. */
export const CAPACITY_STEP = 0.5;

/** Max hours in one day. */
export const CAPACITY_MAX_DAY = 24;

/** Max hours per week (upper bound for the stored weekly cap). */
export const CAPACITY_MAX_WEEK = 168;

export function roundCapacityStep(n: number): number {
  return Math.round(n / CAPACITY_STEP) * CAPACITY_STEP;
}

export function clampCapacityDay(n: number | null): number | null {
  if (n === null || Number.isNaN(n)) return null;
  return roundCapacityStep(Math.min(Math.max(0, n), CAPACITY_MAX_DAY));
}

export function clampCapacityWeek(n: number | null): number | null {
  if (n === null || Number.isNaN(n)) return null;
  return roundCapacityStep(Math.min(Math.max(0, n), CAPACITY_MAX_WEEK));
}

/**
 * Clamp both values; the only business rule is daily ≤ weekly (e.g. part-time 6h/week cannot have 8h daily).
 * If daily &gt; weekly, daily is reduced to match weekly.
 */
export function reconcileEngineerCapacityForSave(
  maxDaily: number | null,
  maxWeekly: number | null
): { maxDailyHours: number | null; maxWeeklyHours: number | null } {
  let d = clampCapacityDay(maxDaily);
  const w = clampCapacityWeek(maxWeekly);

  if ((d === null || d <= 0) && (w === null || w <= 0)) {
    return { maxDailyHours: null, maxWeeklyHours: null };
  }

  if (w === null || w <= 0) {
    return { maxDailyHours: d, maxWeeklyHours: null };
  }
  if (d === null || d <= 0) {
    return { maxDailyHours: null, maxWeeklyHours: w };
  }

  if (d > w) {
    const capped = clampCapacityDay(w);
    d = capped;
  }

  return { maxDailyHours: d, maxWeeklyHours: w };
}
