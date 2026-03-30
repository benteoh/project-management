import type { EngineerCapacityDays } from "@/types/engineer-pool";

/** Half-hour steps match typical timesheet granularity. */
export const CAPACITY_STEP = 0.5;

/** Max hours in one weekday (sensible upper bound). */
export const CAPACITY_MAX_DAY = 24;

/** Max hours per week (5 × max day). */
export const CAPACITY_MAX_WEEK = CAPACITY_MAX_DAY * 5;

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

/** Sum Mon–Fri; null and non-finite treated as 0. */
export function sumCapacityDays(days: EngineerCapacityDays): number {
  let s = 0;
  for (let i = 0; i < 5; i++) {
    const v = days[i];
    if (v !== null && Number.isFinite(v)) s += v;
  }
  return roundCapacityStep(s);
}

/**
 * Split weekly total into five Mon–Fri values (0.5h steps) so the sum equals `weekly`.
 * Remainder half-steps are added from Friday backward.
 */
export function weeklyHoursToFiveDays(weekly: number | null): EngineerCapacityDays {
  if (weekly === null) return [null, null, null, null, null];
  const w = clampCapacityWeek(weekly);
  if (w === null || w <= 0) return [0, 0, 0, 0, 0];

  const halfUnits = Math.round(w / CAPACITY_STEP);
  const baseHalf = Math.floor(halfUnits / 5);
  const rem = halfUnits % 5;
  const base = baseHalf * CAPACITY_STEP;
  const row: EngineerCapacityDays = [base, base, base, base, base];
  for (let i = 0; i < rem; i++) {
    const idx = 4 - i;
    row[idx] = roundCapacityStep((row[idx] ?? 0) + CAPACITY_STEP);
  }
  return row;
}

export function cloneCapacityDays(d: EngineerCapacityDays): EngineerCapacityDays {
  return [d[0], d[1], d[2], d[3], d[4]];
}

/**
 * After editing one weekday: clamp the day, cap total week at max, then return aligned week + days.
 */
export function syncWeekFromDays(
  days: EngineerCapacityDays,
  changedIndex: number,
  nextDay: number | null
): { capacityPerWeek: number | null; capacityDays: EngineerCapacityDays } {
  const d = cloneCapacityDays(days);
  d[changedIndex] = clampCapacityDay(nextDay);

  let s = sumCapacityDays(d);
  if (s > CAPACITY_MAX_WEEK) {
    const others = s - (d[changedIndex] ?? 0);
    const capForCell = Math.max(0, CAPACITY_MAX_WEEK - others);
    d[changedIndex] = clampCapacityDay(
      roundCapacityStep(Math.min(d[changedIndex] ?? 0, capForCell))
    );
    s = sumCapacityDays(d);
  }

  return {
    capacityPerWeek: s <= 0 ? null : clampCapacityWeek(s),
    capacityDays: d,
  };
}

/**
 * After editing weekly total: clamp and redistribute across Mon–Fri so sums match.
 */
export function syncDaysFromWeek(weekly: number | null): {
  capacityPerWeek: number | null;
  capacityDays: EngineerCapacityDays;
} {
  const w = clampCapacityWeek(weekly);
  if (w === null) {
    return { capacityPerWeek: null, capacityDays: [null, null, null, null, null] };
  }
  return {
    capacityPerWeek: w,
    capacityDays: weeklyHoursToFiveDays(w),
  };
}

/** Coerce add-form / save payload so week matches Mon–Fri. */
export function reconcileCapacityForSave(
  week: number | null,
  days: EngineerCapacityDays
): { capacityPerWeek: number | null; capacityDays: EngineerCapacityDays } {
  const sum = sumCapacityDays(days);
  if (sum > 0) {
    const clamped = days.map((v) => clampCapacityDay(v)) as EngineerCapacityDays;
    const s2 = sumCapacityDays(clamped);
    if (s2 > CAPACITY_MAX_WEEK) {
      return syncDaysFromWeek(CAPACITY_MAX_WEEK);
    }
    return { capacityPerWeek: clampCapacityWeek(s2), capacityDays: clamped };
  }
  return syncDaysFromWeek(week);
}
