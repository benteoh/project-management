// Pure autofill algorithm — no React, no side effects.
// Determines which cells to fill, respecting capacity and eligibility constraints.
//
// DEBUG: set to true to log skip reasons to the browser console.
const DEBUG = false;

import { DEFAULT_MAX_DAILY_HOURS, DEFAULT_MAX_WEEKLY_HOURS } from "@/types/engineer-pool";

import type { ForecastGridRow } from "./types";
import type { CellValues, HistoryChange, PendingFill } from "./forecastGridTypes";

export type AutofillInput = {
  /** All rows currently in the grid (used for cross-row capacity totals). */
  rows: ForecastGridRow[];
  /** Ordered ISO date fields for all date columns in the grid. */
  dateColFields: string[];
  /** Current committed cell values (cellValuesRef snapshot). */
  currentValues: CellValues;
  bankHolidays: Set<string>;
  /**
   * Restrict filling to these row ids only.
   * When undefined, all rows are candidates.
   */
  targetRowIds?: Set<string>;
  /**
   * Restrict filling to these exact cells ("rowId:field").
   * When undefined, all columns are candidates for each row.
   */
  targetCells?: Set<string>;
};

// ── Date helpers ──────────────────────────────────────────────────────────────

/** True if an ISO date string falls on Saturday (6) or Sunday (0). */
export function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

/**
 * ISO week key — "YYYY-Www".
 * ISO 8601: week starts Monday; week belongs to the year containing Thursday.
 */
export function isoWeekKey(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Find the Thursday of the current week (determines which year's week this is)
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + (4 - (date.getDay() || 7)));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Sum of all numeric hour values for a row across the given date fields. */
function sumRowHours(currentValues: CellValues, rowId: string, dateColFields: string[]): number {
  const vals = currentValues[rowId] ?? {};
  let sum = 0;
  for (const field of dateColFields) {
    const v = vals[field];
    if (typeof v === "number" && v > 0) sum += v;
  }
  return sum;
}

// ── Main algorithm ─────────────────────────────────────────────────────────────

export function autofill(input: AutofillInput): PendingFill {
  const { rows, dateColFields, currentValues, bankHolidays, targetRowIds, targetCells } = input;

  const changes: HistoryChange[] = [];
  const warnings: string[] = [];
  const budgetWarnings: string[] = [];

  // Index rows by id for cross-row capacity lookups
  const rowById = new Map<string, ForecastGridRow>();
  for (const row of rows) {
    rowById.set(`${row.scope.id}-${row.engineer.id}`, row);
  }

  // Filter to target rows (all rows if no filter)
  const candidateRows = targetRowIds
    ? rows.filter((r) => targetRowIds.has(`${r.scope.id}-${r.engineer.id}`))
    : rows;

  // Sort by scopeEndDate ascending (null last) then scope.id for stability.
  // This gives deadline priority: tighter deadlines get first use of daily/weekly caps.
  const sortedRows = [...candidateRows].sort((a, b) => {
    if (!a.scopeEndDate && !b.scopeEndDate) return a.scope.id.localeCompare(b.scope.id);
    if (!a.scopeEndDate) return 1;
    if (!b.scopeEndDate) return -1;
    const cmp = a.scopeEndDate.localeCompare(b.scopeEndDate);
    return cmp !== 0 ? cmp : a.scope.id.localeCompare(b.scope.id);
  });

  // Seed running totals from ALL rows' current values (cross-row capacity tracking).
  // Daily: engineerId:date. Weekly scope: scopeId:engineerId:week. Weekly global: engineerId:week (all scopes).
  const runningDaily = new Map<string, number>();
  const runningWeeklyScope = new Map<string, number>();
  const runningWeeklyGlobal = new Map<string, number>();

  for (const [rowId, row] of rowById) {
    const engId = row.engineer.id;
    const scopeId = row.scope.id;
    const vals = currentValues[rowId] ?? {};
    for (const field of dateColFields) {
      const v = vals[field];
      const hrs = typeof v === "number" && v > 0 ? v : 0;
      if (hrs === 0) continue;
      const dk = `${engId}:${field}`;
      const wk = isoWeekKey(field);
      const scopeKey = `${scopeId}:${engId}:${wk}`;
      const globalKey = `${engId}:${wk}`;
      runningDaily.set(dk, (runningDaily.get(dk) ?? 0) + hrs);
      runningWeeklyScope.set(scopeKey, (runningWeeklyScope.get(scopeKey) ?? 0) + hrs);
      runningWeeklyGlobal.set(globalKey, (runningWeeklyGlobal.get(globalKey) ?? 0) + hrs);
    }
  }

  // Track hours queued in this pass per row (to correctly compute remaining)
  const queuedPerRow = new Map<string, number>();

  if (DEBUG) console.group(`autofill — ${sortedRows.length} candidate rows`);

  for (const row of sortedRows) {
    const rowId = `${row.scope.id}-${row.engineer.id}`;
    const label = `${row.engineer.code} / "${row.scope.label}"`;

    // Row-level eligibility
    if (row.scopeStatus === "Completed") {
      if (DEBUG) console.log(`[SKIP row] ${label} — status: Completed`);
      continue;
    }

    if (row.plannedHrs === null || row.plannedHrs === 0) {
      if (DEBUG) console.log(`[SKIP row] ${label} — no planned hours`);
      warnings.push(`No planned hours for ${row.engineer.code} on "${row.scope.label}" — skipped`);
      continue;
    }

    const forecastedSoFar = sumRowHours(currentValues, rowId, dateColFields);
    const alreadyQueued = queuedPerRow.get(rowId) ?? 0;
    let remaining = Math.max(0, row.plannedHrs - forecastedSoFar - alreadyQueued);

    if (remaining <= 0) {
      if (DEBUG)
        console.log(
          `[SKIP row] ${label} — already fully allocated (planned=${row.plannedHrs}, forecasted=${forecastedSoFar})`
        );
      continue;
    }

    const maxDaily = row.maxDailyHours ?? DEFAULT_MAX_DAILY_HOURS;
    const maxWeeklyScope = row.weeklyScopeLimit;
    const maxWeeklyGlobal = row.maxWeeklyHours ?? DEFAULT_MAX_WEEKLY_HOURS;
    const engId = row.engineer.id;

    if (DEBUG)
      console.log(
        `[ROW] ${label} | planned=${row.plannedHrs} forecasted=${forecastedSoFar} remaining=${remaining} | caps: daily=${maxDaily} weeklyScope=${maxWeeklyScope} weeklyGlobal=${maxWeeklyGlobal}`
      );

    for (const field of dateColFields) {
      if (remaining <= 0) break;

      // Column-level eligibility
      if (isWeekend(field)) continue;
      if (bankHolidays.has(field)) continue;
      if (row.scopeStartDate && field < row.scopeStartDate) {
        if (DEBUG)
          console.log(`  [skip cell] ${field} — before scopeStartDate (${row.scopeStartDate})`);
        continue;
      }
      // scopeEndDate: used for row sort only — do not clip cells after finish (AUTOFILL_PLAN v1).

      // Selection restriction
      if (targetCells && !targetCells.has(`${rowId}:${field}`)) continue;

      // Skip non-empty cells
      const existing = currentValues[rowId]?.[field];
      if (existing != null && existing !== 0) {
        if (DEBUG) console.log(`  [skip cell] ${field} — already has value (${existing})`);
        continue;
      }

      // Cross-row capacity: daily = global per engineer; weekly scope = this row's cap;
      // weekly global = engineer's max across all scopes in the same ISO week.
      const dk = `${engId}:${field}`;
      const weekK = isoWeekKey(field);
      const scopeWkKey = `${row.scope.id}:${engId}:${weekK}`;
      const globalWkKey = `${engId}:${weekK}`;
      const dailyUsed = runningDaily.get(dk) ?? 0;
      const weeklyScopeUsed = runningWeeklyScope.get(scopeWkKey) ?? 0;
      const weeklyGlobalUsed = runningWeeklyGlobal.get(globalWkKey) ?? 0;
      const dailyCap = Math.max(0, maxDaily - dailyUsed);
      const weeklyScopeCap = Math.max(0, maxWeeklyScope - weeklyScopeUsed);
      const weeklyGlobalCap = Math.max(0, maxWeeklyGlobal - weeklyGlobalUsed);

      const toFill = Math.floor(Math.min(remaining, dailyCap, weeklyScopeCap, weeklyGlobalCap));
      if (toFill <= 0) {
        if (DEBUG)
          console.log(
            `  [skip cell] ${field} — capacity 0 (daily ${dailyUsed}/${maxDaily}, scopeWeek ${weeklyScopeUsed}/${maxWeeklyScope}, globalWeek ${weeklyGlobalUsed}/${maxWeeklyGlobal})`
          );
        continue;
      }

      if (DEBUG) console.log(`  [fill] ${field} → ${toFill}h (remaining before: ${remaining})`);
      changes.push({ rowId, field, oldValue: null, newValue: toFill });

      // Update running totals so later rows in this pass see reduced capacity
      runningDaily.set(dk, dailyUsed + toFill);
      runningWeeklyScope.set(scopeWkKey, weeklyScopeUsed + toFill);
      runningWeeklyGlobal.set(globalWkKey, weeklyGlobalUsed + toFill);
      // Fix: accumulate from current map value, not stale alreadyQueued
      queuedPerRow.set(rowId, (queuedPerRow.get(rowId) ?? 0) + toFill);
      remaining -= toFill;
    }

    // In selection mode the user deliberately limited the range — leftover hours are expected.
    if (remaining > 0 && !targetCells) {
      if (DEBUG) console.log(`  [warn] ${remaining}h unallocated — capacity reached`);
      warnings.push(
        `Could not fully allocate ${row.engineer.code} on "${row.scope.label}" — ${remaining}h unallocated (capacity reached)`
      );
    }
  }

  if (DEBUG) console.groupEnd();

  // Budget sanity: check any row that now exceeds planned hours
  for (const [rowId, queued] of queuedPerRow) {
    const row = rowById.get(rowId);
    if (!row || row.plannedHrs === null) continue;
    const forecastedAfter = sumRowHours(currentValues, rowId, dateColFields) + queued;
    if (forecastedAfter > row.plannedHrs) {
      budgetWarnings.push(
        `${row.engineer.code} on "${row.scope.label}" exceeds planned hours (${row.plannedHrs}h planned, ${forecastedAfter}h forecasted)`
      );
    }
  }

  return { changes, warnings, budgetWarnings };
}
