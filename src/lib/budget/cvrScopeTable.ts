import type { CellValues } from "@/components/forecast/forecastGridTypes";
import type { ProgrammeNode } from "@/components/programme/types";
import { hourRateForScopeSlot } from "@/lib/forecast/hourRateForScopeSlot";
import { parseForecastRowId } from "@/lib/forecast/forecastRowId";
import type { TimesheetCvrEntry } from "@/lib/timesheet/timesheetActualsDb";
import type { EngineerPoolEntry } from "@/types/engineer-pool";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface CvrScopeRow {
  scopeId: string;
  scopeName: string;
  quotation: number | null;
  quotationEw: number | null;
  approvedBudget: number;
  monthlySpend: number;
  spentSoFar: number;
}

/** Transposed CVR grid: each column is a scope; rows are budget lines, spent so far (aggregate), variance, forecast months, expected variance. */
export interface CvrTransposedTable {
  scopes: { id: string; name: string }[];
  /**
   * Every `YYYY-MM` from earliest to latest **future-dated** forecast cell (inclusive), with gaps
   * filled. Empty when there is no forecast slice or no upcoming hours.
   */
  upcomingMonths: string[];
  byScopeId: Record<
    string,
    {
      quotation: number | null;
      quotationEw: number | null;
      approvedBudget: number;
      /** Sum of all dated, costed timesheet £ for this scope (not split by month). */
      spentSoFar: number;
      /** Approved budget − spent so far */
      variance: number;
      /**
       * £ from demand forecast for dates **strictly after** {@link CvrForecastSlice.afterDateExclusive},
       * by calendar month (keys match {@link CvrTransposedTable.upcomingMonths}).
       */
      upcomingMonthly: Record<string, number>;
      /** Total upcoming forecast £ (sum of per-month `upcomingMonthly` values). */
      upcomingForecastGbp: number;
      /** Variance − upcoming forecast £ */
      expectedVariance: number;
    }
  >;
  /** Pre-computed column totals — use these in the render instead of calling cvrTransposedRowTotals. */
  totals: {
    quotation: number | null;
    quotationEw: number | null;
    approvedBudget: number;
    spentSoFar: number;
    variance: number;
    upcomingForecast: number;
    expectedVariance: number;
    /** Total per upcoming month (keys match upcomingMonths). */
    upcomingMonthly: Record<string, number>;
  };
}

/** Forecast slice: cell values + “today” boundary (ISO); only future dated hours count as upcoming. */
export type CvrForecastSlice = {
  values: CellValues;
  /** Sum hours on dates `> afterDateExclusive` (typically calendar today in the viewer’s timezone). */
  afterDateExclusive: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function collectScopesInOrder(nodes: ProgrammeNode[]): ProgrammeNode[] {
  const result: ProgrammeNode[] = [];
  function walk(node: ProgrammeNode) {
    if (node.type === "scope") result.push(node);
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

/** Inclusive end of calendar month as ISO `YYYY-MM-DD` (local date parts from `yyyyMm`). */
function endOfMonthIso(yyyyMm: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(y, month, 0);
  const d = last.getDate();
  return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Approved budget = quotation + quotation EW (null amounts treated as 0). */
function approvedBudgetFromQuotations(scope: ProgrammeNode): number {
  const q = scope.quotedAmount ?? 0;
  const ew = scope.quotationWarningAmount ?? 0;
  return round2(q + ew);
}

/**
 * £ for one timesheet row using the scope’s engineer rate slot (same rule as the forecast grid).
 */
function entrySpendGbp(
  scope: ProgrammeNode | undefined,
  engineerId: string | null,
  hours: number | null,
  poolById: Map<string, EngineerPoolEntry>
): number {
  if (!scope || !engineerId || !hours || hours <= 0) return 0;
  const alloc = scope.engineers?.find((a) => a.engineerId === engineerId);
  if (!alloc) return 0;
  const eng = poolById.get(engineerId);
  if (!eng) return 0;
  const rate = hourRateForScopeSlot(eng, alloc.rate);
  if (rate === null || rate <= 0) return 0;
  return round2(hours * rate);
}

/**
 * Upcoming forecast £ per scope per calendar month (only cells with `dateKey > afterDateExclusive`).
 */
function accumulateUpcomingForecastGbpByScopeMonth(
  forecastValues: CellValues,
  scopeById: Map<string, ProgrammeNode>,
  poolById: Map<string, EngineerPoolEntry>,
  afterDateExclusive: string
): {
  monthlyByScope: Map<string, Map<string, number>>;
  monthsSeen: Set<string>;
} {
  const monthlyByScope = new Map<string, Map<string, number>>();
  const monthsSeen = new Set<string>();
  if (!ISO_DATE.test(afterDateExclusive)) return { monthlyByScope, monthsSeen };

  for (const [rowId, dates] of Object.entries(forecastValues)) {
    const parsed = parseForecastRowId(rowId);
    if (!parsed) continue;
    const scope = scopeById.get(parsed.scopeId);
    for (const [dateKey, raw] of Object.entries(dates)) {
      if (!ISO_DATE.test(dateKey)) continue;
      if (dateKey <= afterDateExclusive) continue;
      const hrs = typeof raw === "number" ? raw : Number(raw);
      if (raw == null || hrs <= 0 || Number.isNaN(hrs)) continue;
      const gbp = entrySpendGbp(scope, parsed.engineerId, hrs, poolById);
      if (gbp <= 0) continue;
      const ym = dateKey.slice(0, 7);
      monthsSeen.add(ym);
      if (!monthlyByScope.has(parsed.scopeId)) monthlyByScope.set(parsed.scopeId, new Map());
      const perMonth = monthlyByScope.get(parsed.scopeId)!;
      perMonth.set(ym, round2((perMonth.get(ym) ?? 0) + gbp));
    }
  }
  return { monthlyByScope, monthsSeen };
}

/** Total costed timesheet £ per scope (all dated rows). */
function accumulateSpentSoFarByScope(
  entries: TimesheetCvrEntry[],
  scopeById: Map<string, ProgrammeNode>,
  poolById: Map<string, EngineerPoolEntry>
): Map<string, number> {
  const spentAllByScope = new Map<string, number>();
  for (const e of entries) {
    if (!e.scopeId || !e.entryDate || !e.hours || e.hours <= 0) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.entryDate)) continue;
    const scope = scopeById.get(e.scopeId);
    const gbp = entrySpendGbp(scope, e.engineerId, e.hours, poolById);
    if (gbp <= 0) continue;
    spentAllByScope.set(e.scopeId, round2((spentAllByScope.get(e.scopeId) ?? 0) + gbp));
  }
  return spentAllByScope;
}

function accumulateSpendByScopeMonth(
  entries: TimesheetCvrEntry[],
  scopeById: Map<string, ProgrammeNode>,
  poolById: Map<string, EngineerPoolEntry>
): {
  monthlyByScope: Map<string, Map<string, number>>;
  spentAllByScope: Map<string, number>;
  monthsSeen: Set<string>;
} {
  const monthlyByScope = new Map<string, Map<string, number>>();
  const spentAllByScope = new Map<string, number>();
  const monthsSeen = new Set<string>();

  for (const e of entries) {
    if (!e.scopeId || !e.entryDate || !e.hours || e.hours <= 0) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.entryDate)) continue;
    const scope = scopeById.get(e.scopeId);
    const gbp = entrySpendGbp(scope, e.engineerId, e.hours, poolById);
    if (gbp <= 0) continue;

    const ym = e.entryDate.slice(0, 7);
    monthsSeen.add(ym);

    if (!monthlyByScope.has(e.scopeId)) monthlyByScope.set(e.scopeId, new Map());
    const perMonth = monthlyByScope.get(e.scopeId)!;
    perMonth.set(ym, round2((perMonth.get(ym) ?? 0) + gbp));

    spentAllByScope.set(e.scopeId, round2((spentAllByScope.get(e.scopeId) ?? 0) + gbp));
  }

  return { monthlyByScope, spentAllByScope, monthsSeen };
}

/** Every `YYYY-MM` from `minYm` through `maxYm` inclusive. */
export function expandMonthRange(minYm: string, maxYm: string): string[] {
  const p = (s: string) => {
    const m = /^(\d{4})-(\d{2})$/.exec(s);
    if (!m) return null;
    return { y: Number(m[1]), mo: Number(m[2]) };
  };
  const a = p(minYm);
  const b = p(maxYm);
  if (!a || !b || a.mo < 1 || a.mo > 12 || b.mo < 1 || b.mo > 12) return [];
  if (minYm > maxYm) return [];

  const out: string[] = [];
  let y = a.y;
  let mo = a.mo;
  for (;;) {
    const key = `${y}-${String(mo).padStart(2, "0")}`;
    out.push(key);
    if (key === maxYm) break;
    mo += 1;
    if (mo > 12) {
      mo = 1;
      y += 1;
    }
    if (out.length > 1200) break;
  }
  return out;
}

function monthRangeFromSeen(monthsSeen: Set<string>): string[] {
  if (monthsSeen.size === 0) return [];
  const sorted = [...monthsSeen].sort();
  return expandMonthRange(sorted[0]!, sorted[sorted.length - 1]!);
}

function sumMonthlyThrough(perMonth: Map<string, number>, throughYm: string): number {
  let s = 0;
  for (const [ym, v] of perMonth) {
    if (ym <= throughYm) s += v;
  }
  return round2(s);
}

/**
 * Full transposed dataset: scopes as columns; rows = quotation, EW, approved budget, spent so far,
 * variance, upcoming forecast by month, expected variance.
 */
export function buildCvrTransposedTable(
  programmeTree: ProgrammeNode[],
  engineerPool: EngineerPoolEntry[],
  entries: TimesheetCvrEntry[],
  forecast?: CvrForecastSlice | null
): CvrTransposedTable {
  const scopes = collectScopesInOrder(programmeTree);
  const poolById = new Map(engineerPool.map((e) => [e.id, e]));
  const scopeById = new Map(scopes.map((s) => [s.id, s]));

  const spentAllByScope = accumulateSpentSoFarByScope(entries, scopeById, poolById);

  const upcomingAgg = forecast
    ? accumulateUpcomingForecastGbpByScopeMonth(
        forecast.values,
        scopeById,
        poolById,
        forecast.afterDateExclusive
      )
    : { monthlyByScope: new Map<string, Map<string, number>>(), monthsSeen: new Set<string>() };

  const upcomingMonths = monthRangeFromSeen(upcomingAgg.monthsSeen);

  const byScopeId: CvrTransposedTable["byScopeId"] = {};

  for (const scope of scopes) {
    const upcomingPerMonth = upcomingAgg.monthlyByScope.get(scope.id) ?? new Map<string, number>();
    const upcomingMonthly: Record<string, number> = {};
    let upcomingForecastGbp = 0;
    for (const ym of upcomingMonths) {
      const v = upcomingPerMonth.get(ym) ?? 0;
      upcomingMonthly[ym] = v;
      upcomingForecastGbp = round2(upcomingForecastGbp + v);
    }
    const spentSoFar = spentAllByScope.get(scope.id) ?? 0;
    const approvedBudget = approvedBudgetFromQuotations(scope);
    const variance = round2(approvedBudget - spentSoFar);
    const expectedVariance = round2(variance - upcomingForecastGbp);

    byScopeId[scope.id] = {
      quotation: scope.quotedAmount ?? null,
      quotationEw: scope.quotationWarningAmount ?? null,
      approvedBudget,
      spentSoFar,
      variance,
      upcomingMonthly,
      upcomingForecastGbp,
      expectedVariance,
    };
  }

  // Compute totals in a single pass over scopes — stored on the result so
  // the render never calls cvrTransposedRowTotals() repeatedly.
  let totalQuotation: number | null = null;
  let totalQuotationEw: number | null = null;
  let totalApprovedBudget = 0;
  let totalSpentSoFar = 0;
  let totalVariance = 0;
  let totalUpcomingForecast = 0;
  let totalExpectedVariance = 0;
  const totalUpcomingMonthly: Record<string, number> = {};

  for (const scope of scopes) {
    const row = byScopeId[scope.id]!;
    if (row.quotation != null) totalQuotation = round2((totalQuotation ?? 0) + row.quotation);
    if (row.quotationEw != null)
      totalQuotationEw = round2((totalQuotationEw ?? 0) + row.quotationEw);
    totalApprovedBudget = round2(totalApprovedBudget + row.approvedBudget);
    totalSpentSoFar = round2(totalSpentSoFar + row.spentSoFar);
    totalVariance = round2(totalVariance + row.variance);
    totalUpcomingForecast = round2(totalUpcomingForecast + row.upcomingForecastGbp);
    totalExpectedVariance = round2(totalExpectedVariance + row.expectedVariance);
    for (const [ym, v] of Object.entries(row.upcomingMonthly)) {
      totalUpcomingMonthly[ym] = round2((totalUpcomingMonthly[ym] ?? 0) + v);
    }
  }

  return {
    scopes: scopes.map((s) => ({ id: s.id, name: s.name })),
    upcomingMonths,
    byScopeId,
    totals: {
      quotation: totalQuotation,
      quotationEw: totalQuotationEw,
      approvedBudget: totalApprovedBudget,
      spentSoFar: totalSpentSoFar,
      variance: totalVariance,
      upcomingForecast: totalUpcomingForecast,
      expectedVariance: totalExpectedVariance,
      upcomingMonthly: totalUpcomingMonthly,
    },
  };
}

/**
 * Per-scope CVR cost table for the selected calendar month (`YYYY-MM`).
 *
 * **Monthly spend** — £ in that month only (rows with `entryDate` in that month).
 *
 * **Spent so far** — £ from all rows with `entryDate` on or before the last day of the selected month.
 * Rows without a date do not contribute to either spend column.
 */
export function buildCvrScopeRows(
  programmeTree: ProgrammeNode[],
  engineerPool: EngineerPoolEntry[],
  entries: TimesheetCvrEntry[],
  selectedMonth: string
): CvrScopeRow[] {
  const scopes = collectScopesInOrder(programmeTree);
  const poolById = new Map(engineerPool.map((e) => [e.id, e]));
  const scopeById = new Map(scopes.map((s) => [s.id, s]));

  const { monthlyByScope } = accumulateSpendByScopeMonth(entries, scopeById, poolById);

  return scopes.map((scope) => {
    const perMonth = monthlyByScope.get(scope.id) ?? new Map<string, number>();
    const monthlySpend = perMonth.get(selectedMonth) ?? 0;
    const spentSoFar = endOfMonthIso(selectedMonth)
      ? sumMonthlyThrough(perMonth, selectedMonth)
      : 0;

    return {
      scopeId: scope.id,
      scopeName: scope.name,
      quotation: scope.quotedAmount ?? null,
      quotationEw: scope.quotationWarningAmount ?? null,
      approvedBudget: approvedBudgetFromQuotations(scope),
      monthlySpend,
      spentSoFar,
    };
  });
}

export function cvrScopeRowsTotals(rows: CvrScopeRow[]): {
  quotation: number | null;
  quotationEw: number | null;
  approvedBudget: number;
  monthlySpend: number;
  spentSoFar: number;
} {
  let quotation: number | null = null;
  let quotationEw: number | null = null;
  let approvedBudget = 0;
  let monthlySpend = 0;
  let spentSoFar = 0;

  for (const r of rows) {
    if (r.quotation != null) quotation = round2((quotation ?? 0) + r.quotation);
    if (r.quotationEw != null) quotationEw = round2((quotationEw ?? 0) + r.quotationEw);
    approvedBudget = round2(approvedBudget + r.approvedBudget);
    monthlySpend = round2(monthlySpend + r.monthlySpend);
    spentSoFar = round2(spentSoFar + r.spentSoFar);
  }

  return { quotation, quotationEw, approvedBudget, monthlySpend, spentSoFar };
}

/** Row sums for the transposed table (totals column). */
export function cvrTransposedRowTotals(
  table: CvrTransposedTable,
  row:
    | { kind: "quotation" }
    | { kind: "quotationEw" }
    | { kind: "approvedBudget" }
    | { kind: "spentSoFar" }
    | { kind: "variance" }
    | { kind: "upcomingMonth"; monthKey: string }
    | { kind: "upcomingForecast" }
    | { kind: "expectedVariance" }
): number | null {
  const ids = table.scopes.map((s) => s.id);
  if (row.kind === "quotation") {
    let t: number | null = null;
    for (const id of ids) {
      const v = table.byScopeId[id]?.quotation;
      if (v != null) t = round2((t ?? 0) + v);
    }
    return t;
  }
  if (row.kind === "quotationEw") {
    let t: number | null = null;
    for (const id of ids) {
      const v = table.byScopeId[id]?.quotationEw;
      if (v != null) t = round2((t ?? 0) + v);
    }
    return t;
  }
  if (row.kind === "approvedBudget") {
    let t = 0;
    for (const id of ids) t = round2(t + (table.byScopeId[id]?.approvedBudget ?? 0));
    return t;
  }
  if (row.kind === "spentSoFar") {
    let t = 0;
    for (const id of ids) t = round2(t + (table.byScopeId[id]?.spentSoFar ?? 0));
    return t;
  }
  if (row.kind === "variance") {
    let t = 0;
    for (const id of ids) t = round2(t + (table.byScopeId[id]?.variance ?? 0));
    return t;
  }
  if (row.kind === "upcomingMonth") {
    let t = 0;
    for (const id of ids) {
      t = round2(t + (table.byScopeId[id]?.upcomingMonthly[row.monthKey] ?? 0));
    }
    return t;
  }
  if (row.kind === "upcomingForecast") {
    let t = 0;
    for (const id of ids) t = round2(t + (table.byScopeId[id]?.upcomingForecastGbp ?? 0));
    return t;
  }
  let t = 0;
  for (const id of ids) t = round2(t + (table.byScopeId[id]?.expectedVariance ?? 0));
  return t;
}
