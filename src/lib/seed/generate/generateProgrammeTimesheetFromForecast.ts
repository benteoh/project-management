import {
  addDaysIso,
  nextWeekdayIso,
  shiftWeekdayInSameWeek,
  weekBucketMonday,
} from "../isoDateUtc";
import type { ProgrammeForecastRow } from "./generateProgrammeForecastRows";
import type { SeededRng } from "../seedDeterministicRandom";
import { splitWholeHoursIntoMaxPerDay } from "../seedHours";

/** Timesheet policy: one row may not exceed this many hours (split into multiple entries). */
const MAX_HOURS_PER_TIMESHEET_ROW = 8;

export type ProgrammeTimesheetCsvRow = {
  scopeId: string;
  date: string;
  code: string;
  /** Whole hours; never greater than {@link MAX_HOURS_PER_TIMESHEET_ROW}. */
  hours: number;
  /** CSV Task column: programme scope **display name** (matches programme node name). */
  taskId: string;
  projectLabel: string;
  /** `ActivityId: scope name` (and optional suffixes like `(cont.)`). */
  description: string;
};

export type TimesheetFromForecastStats = {
  forecastSlotsWithHours: number;
  alignedSlotCount: number;
  divergentSlotCount: number;
  timesheetRowCount: number;
  divergentSkipped: number;
};

export type TimesheetFromForecastResult = {
  rows: ProgrammeTimesheetCsvRow[];
  stats: TimesheetFromForecastStats;
  /** `scopeId|engineerCode|forecastDate` slots that follow the forecast (≥80%). */
  alignedForecastSlotKeys: string[];
};

/** Share of forecast slots that follow the same week and similar hours (rest: light divergence / skip). */
const FOLLOW_FORECAST_MIN = 0.92;
/** Share of non-aligned slots that are skipped entirely (not booked on timesheet). */
const DIVERGENT_SKIP_P = 0.08;

function slotKey(scopeId: string, code: string, forecastDate: string): string {
  return `${scopeId}|${code}|${forecastDate}`;
}

export type GenerateTimesheetFromForecastParams = {
  forecastRows: ProgrammeForecastRow[];
  projectLabel: string;
  /** Programme scope display name per scope id — CSV Task column and description tail. */
  scopeDisplayNameByScopeId: ReadonlyMap<string, string>;
  /** Activity ids per scope — rotated for `ActivityId: scope name` description prefix. */
  activityIdsByScopeId: ReadonlyMap<string, readonly string[]>;
  rng: SeededRng;
  /**
   * When set, scopes in the map book only `fraction ×` each slot’s hours on the timesheet (rounded),
   * simulating incomplete delivery vs the forecast grid. Omitted scopes unchanged.
   */
  timesheetForecastRetentionByScopeId?: ReadonlyMap<string, number>;
};

function scaleHoursForIncompleteScope(
  scopeId: string,
  hours: number,
  retentionByScopeId: ReadonlyMap<string, number> | undefined
): number {
  if (!retentionByScopeId || hours <= 0) return hours;
  const f = retentionByScopeId.get(scopeId);
  if (f === undefined || f >= 1) return hours;
  return Math.max(0, Math.round(hours * f));
}

function pickActivityIdForDescription(
  scopeId: string,
  activityIdsByScopeId: ReadonlyMap<string, readonly string[]>,
  rowIndex: number
): string {
  const ids = activityIdsByScopeId.get(scopeId);
  if (ids && ids.length > 0) {
    return ids[rowIndex % ids.length]!;
  }
  return "A0000";
}

function appendTimesheetBooking(
  rows: ProgrammeTimesheetCsvRow[],
  opts: {
    scopeId: string;
    anchorDate: string;
    code: string;
    totalHours: number;
    /** CSV Task ID column = programme scope display name. */
    scopeTaskLabel: string;
    projectLabel: string;
    activityId: string;
    scopeDisplayName: string;
    /** Appended after `activityId: scopeDisplayName` on the first segment (e.g. late booking). */
    descriptionExtraFirstSegment?: string;
  }
): void {
  const chunks = splitWholeHoursIntoMaxPerDay(opts.totalHours, MAX_HOURS_PER_TIMESHEET_ROW);
  let d = opts.anchorDate;
  for (let ci = 0; ci < chunks.length; ci++) {
    if (ci > 0) d = nextWeekdayIso(d);
    const base = `${opts.activityId}: ${opts.scopeDisplayName}`;
    let description: string;
    if (ci === 0) {
      const extra = opts.descriptionExtraFirstSegment ?? "";
      description = extra ? `${base}${extra}` : base;
    } else {
      description = `${base} (cont.)`;
    }
    rows.push({
      scopeId: opts.scopeId,
      date: d,
      code: opts.code,
      hours: chunks[ci]!,
      taskId: opts.scopeTaskLabel,
      projectLabel: opts.projectLabel,
      description,
    });
  }
}

/**
 * Timesheet rows from forecast: most slots stay in the same calendar week (day may move Mon–Fri);
 * the rest simulate skips, week slips, or heavy hours. Each row is capped at 8h; larger totals split
 * across consecutive weekdays.
 */
export function generateTimesheetRowsFromForecast(
  p: GenerateTimesheetFromForecastParams
): TimesheetFromForecastResult {
  const retention = p.timesheetForecastRetentionByScopeId;
  const slots = p.forecastRows.filter((r) => r.hours > 0);
  const n = slots.length;
  const alignedCount = n === 0 ? 0 : Math.round(n * FOLLOW_FORECAST_MIN);

  const indices = slots.map((_, i) => i);
  p.rng.shuffleInPlace(indices);
  const alignedIdx = new Set(indices.slice(0, alignedCount));

  const alignedForecastSlotKeys: string[] = [];
  const rows: ProgrammeTimesheetCsvRow[] = [];
  let divergentSkipped = 0;
  let rowIndex = 0;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const key = slotKey(slot.scopeId, slot.engineerCode, slot.date);
    const activityId = pickActivityIdForDescription(slot.scopeId, p.activityIdsByScopeId, rowIndex);
    rowIndex++;
    const scopeDisplayName = p.scopeDisplayNameByScopeId.get(slot.scopeId) ?? slot.scopeId;

    if (alignedIdx.has(i)) {
      const dayShift = p.rng.nextInt(-1, 1);
      const date = shiftWeekdayInSameWeek(slot.date, dayShift);
      let hours = Math.max(1, Math.round(slot.hours));
      hours = scaleHoursForIncompleteScope(slot.scopeId, hours, retention);
      if (hours <= 0) continue;

      alignedForecastSlotKeys.push(key);
      appendTimesheetBooking(rows, {
        scopeId: slot.scopeId,
        anchorDate: date,
        code: slot.engineerCode,
        totalHours: hours,
        scopeTaskLabel: scopeDisplayName,
        projectLabel: p.projectLabel,
        activityId,
        scopeDisplayName,
      });
      continue;
    }

    const branch = p.rng.next();
    if (branch < DIVERGENT_SKIP_P) {
      divergentSkipped++;
      continue;
    }

    if (branch < 0.55) {
      const weekBump = p.rng.pick([-7, 7, 14]);
      const date = addDaysIso(slot.date, weekBump);
      let hours = Math.max(1, Math.round(slot.hours * (0.92 + p.rng.next() * 0.16)));
      hours = scaleHoursForIncompleteScope(slot.scopeId, hours, retention);
      if (hours <= 0) continue;

      appendTimesheetBooking(rows, {
        scopeId: slot.scopeId,
        anchorDate: date,
        code: slot.engineerCode,
        totalHours: hours,
        scopeTaskLabel: scopeDisplayName,
        projectLabel: p.projectLabel,
        activityId,
        scopeDisplayName,
        descriptionExtraFirstSegment: " (late booking)",
      });
      continue;
    }

    const lateDays = p.rng.nextInt(-2, 12);
    const date = addDaysIso(slot.date, lateDays);
    let hours = Math.max(1, Math.round(slot.hours * (1.02 + p.rng.next() * 0.18)));
    hours = scaleHoursForIncompleteScope(slot.scopeId, hours, retention);
    if (hours <= 0) continue;

    appendTimesheetBooking(rows, {
      scopeId: slot.scopeId,
      anchorDate: date,
      code: slot.engineerCode,
      totalHours: hours,
      scopeTaskLabel: scopeDisplayName,
      projectLabel: p.projectLabel,
      activityId,
      scopeDisplayName,
      descriptionExtraFirstSegment: " — overspend week",
    });
  }

  rows.sort((a, b) => {
    const da = a.date.localeCompare(b.date);
    if (da !== 0) return da;
    const sc = a.scopeId.localeCompare(b.scopeId);
    if (sc !== 0) return sc;
    return a.code.localeCompare(b.code);
  });

  return {
    rows,
    stats: {
      forecastSlotsWithHours: n,
      alignedSlotCount: alignedCount,
      divergentSlotCount: n - alignedCount,
      timesheetRowCount: rows.length,
      divergentSkipped,
    },
    alignedForecastSlotKeys,
  };
}

export function timesheetRowMatchesAlignedForecast(
  forecast: ProgrammeForecastRow,
  row: ProgrammeTimesheetCsvRow
): boolean {
  if (forecast.scopeId !== row.scopeId) return false;
  if (forecast.engineerCode !== row.code) return false;
  return weekBucketMonday(forecast.date) === weekBucketMonday(row.date);
}
