import type { ProgrammeNode } from "@/components/programme/types";
import { forecastRowId } from "@/lib/forecast/forecastRowId";
import type { TimesheetCvrEntry } from "@/lib/timesheet/timesheetActualsDb";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { describe, expect, it } from "vitest";

import {
  buildCvrScopeRows,
  buildCvrTransposedTable,
  cvrScopeRowsTotals,
  cvrTransposedRowTotals,
  expandMonthRange,
} from "./cvrScopeTable";

const UUID_S1 = "10000000-0000-4000-8000-000000000001";
const UUID_E1 = "20000000-0000-4000-8000-000000000001";

const pool: EngineerPoolEntry[] = [
  {
    id: "e1",
    code: "E1",
    firstName: "A",
    lastName: "One",
    maxWeeklyHours: 40,
    rates: [100, 80, null, null, null],
  },
];

function scopeNode(
  id: string,
  name: string,
  opts: { quoted?: number; ew?: number; plannedHrs?: number }
): ProgrammeNode {
  return {
    id,
    name,
    type: "scope",
    totalHours: 10,
    start: "",
    finish: "",
    status: "",
    children: [],
    quotedAmount: opts.quoted ?? null,
    quotationWarningAmount: opts.ew ?? null,
    engineers: [
      {
        engineerId: "e1",
        isLead: false,
        plannedHrs: opts.plannedHrs ?? null,
        weeklyScopeLimitHrs: null,
        rate: "A",
      },
    ],
  };
}

describe("buildCvrScopeRows", () => {
  it("computes approved budget as quotation plus quotation EW", () => {
    const tree: ProgrammeNode[] = [scopeNode("s1", "Scope A", { quoted: 1000, ew: 250 })];
    const rows = buildCvrScopeRows(tree, pool, [], "2026-04");
    expect(rows).toHaveLength(1);
    expect(rows[0].approvedBudget).toBe(1250);
  });

  it("splits monthly vs cumulative spend by entry_date", () => {
    const tree: ProgrammeNode[] = [scopeNode("s1", "Scope A", { plannedHrs: 10 })];
    const entries: TimesheetCvrEntry[] = [
      {
        engineerId: "e1",
        scopeId: "s1",
        hours: 2,
        entryDate: "2026-03-15",
      },
      {
        engineerId: "e1",
        scopeId: "s1",
        hours: 1,
        entryDate: "2026-04-10",
      },
      {
        engineerId: "e1",
        scopeId: "s1",
        hours: 3,
        entryDate: "2026-05-01",
      },
    ];
    const rows = buildCvrScopeRows(tree, pool, entries, "2026-04");
    expect(rows[0].monthlySpend).toBe(100);
    expect(rows[0].spentSoFar).toBe(300);
  });

  it("ignores rows without entry_date for spend", () => {
    const tree: ProgrammeNode[] = [scopeNode("s1", "Scope A", { plannedHrs: 1 })];
    const entries: TimesheetCvrEntry[] = [
      { engineerId: "e1", scopeId: "s1", hours: 2, entryDate: null },
    ];
    const rows = buildCvrScopeRows(tree, pool, entries, "2026-04");
    expect(rows[0].monthlySpend).toBe(0);
    expect(rows[0].spentSoFar).toBe(0);
  });
});

describe("expandMonthRange", () => {
  it("fills months between min and max inclusive", () => {
    expect(expandMonthRange("2026-01", "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("returns empty when min > max", () => {
    expect(expandMonthRange("2026-04", "2026-01")).toEqual([]);
  });
});

describe("buildCvrTransposedTable", () => {
  it("lists scopes as columns data and fills month gaps with zero", () => {
    const tree: ProgrammeNode[] = [
      scopeNode("s1", "Alpha", { quoted: 100, ew: 10 }),
      scopeNode("s2", "Beta", { quoted: 50, ew: 5 }),
    ];
    const entries: TimesheetCvrEntry[] = [
      { engineerId: "e1", scopeId: "s1", hours: 1, entryDate: "2026-01-10" },
      { engineerId: "e1", scopeId: "s2", hours: 1, entryDate: "2026-03-05" },
    ];
    const t = buildCvrTransposedTable(tree, pool, entries);
    expect(t.scopes.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(t.upcomingMonths).toEqual([]);
    expect(t.byScopeId.s1.spentSoFar).toBe(100);
    expect(t.byScopeId.s1.approvedBudget).toBe(110);
    expect(t.byScopeId.s1.variance).toBe(10);
    expect(t.byScopeId.s1.upcomingForecastGbp).toBe(0);
    expect(t.byScopeId.s1.expectedVariance).toBe(10);
    expect(t.byScopeId.s2.approvedBudget).toBe(55);
    expect(t.byScopeId.s2.spentSoFar).toBe(100);
    expect(t.byScopeId.s2.variance).toBe(-45);
    expect(cvrTransposedRowTotals(t, { kind: "spentSoFar" })).toBe(200);
  });

  it("costs upcoming forecast hours after a cutoff date", () => {
    const tree: ProgrammeNode[] = [
      {
        id: UUID_S1,
        name: "Scoped",
        type: "scope",
        totalHours: null,
        start: "",
        finish: "",
        status: "",
        children: [],
        quotedAmount: 500,
        quotationWarningAmount: 0,
        engineers: [
          {
            engineerId: UUID_E1,
            isLead: false,
            plannedHrs: null,
            weeklyScopeLimitHrs: null,
            rate: "A",
          },
        ],
      },
    ];
    const poolOne: EngineerPoolEntry[] = [
      {
        id: UUID_E1,
        code: "E1",
        rates: [100, 80, null, null, null],
      },
    ];
    const entries: TimesheetCvrEntry[] = [];
    const rowId = forecastRowId(UUID_S1, UUID_E1);
    const t = buildCvrTransposedTable(tree, poolOne, entries, {
      values: {
        [rowId]: {
          "2026-03-01": 1,
          "2026-05-10": 2,
        },
      },
      afterDateExclusive: "2026-04-01",
    });
    expect(t.upcomingMonths).toEqual(["2026-05"]);
    expect(t.byScopeId[UUID_S1].upcomingMonthly["2026-05"]).toBe(200);
    expect(t.byScopeId[UUID_S1].upcomingForecastGbp).toBe(200);
    expect(t.byScopeId[UUID_S1].variance).toBe(500);
    expect(t.byScopeId[UUID_S1].expectedVariance).toBe(300);
    expect(cvrTransposedRowTotals(t, { kind: "upcomingMonth", monthKey: "2026-05" })).toBe(200);
  });

  it("splits upcoming forecast across months with gaps filled", () => {
    const tree: ProgrammeNode[] = [
      {
        id: UUID_S1,
        name: "Scoped",
        type: "scope",
        totalHours: null,
        start: "",
        finish: "",
        status: "",
        children: [],
        quotedAmount: 1000,
        quotationWarningAmount: 0,
        engineers: [
          {
            engineerId: UUID_E1,
            isLead: false,
            plannedHrs: null,
            weeklyScopeLimitHrs: null,
            rate: "A",
          },
        ],
      },
    ];
    const poolOne: EngineerPoolEntry[] = [
      {
        id: UUID_E1,
        code: "E1",
        rates: [100, 80, null, null, null],
      },
    ];
    const rowId = forecastRowId(UUID_S1, UUID_E1);
    const t = buildCvrTransposedTable(tree, poolOne, [], {
      values: {
        [rowId]: {
          "2026-05-01": 1,
          "2026-07-15": 1,
        },
      },
      afterDateExclusive: "2026-04-01",
    });
    expect(t.upcomingMonths).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(t.byScopeId[UUID_S1].upcomingMonthly["2026-05"]).toBe(100);
    expect(t.byScopeId[UUID_S1].upcomingMonthly["2026-06"]).toBe(0);
    expect(t.byScopeId[UUID_S1].upcomingMonthly["2026-07"]).toBe(100);
    expect(t.byScopeId[UUID_S1].upcomingForecastGbp).toBe(200);
  });
});

describe("cvrScopeRowsTotals", () => {
  it("sums numeric columns", () => {
    const totals = cvrScopeRowsTotals([
      {
        scopeId: "a",
        scopeName: "A",
        quotation: 100,
        quotationEw: 10,
        approvedBudget: 200,
        monthlySpend: 50,
        spentSoFar: 75,
      },
      {
        scopeId: "b",
        scopeName: "B",
        quotation: null,
        quotationEw: 5,
        approvedBudget: 100,
        monthlySpend: 25,
        spentSoFar: 25,
      },
    ]);
    expect(totals.quotation).toBe(100);
    expect(totals.quotationEw).toBe(15);
    expect(totals.approvedBudget).toBe(300);
    expect(totals.monthlySpend).toBe(75);
    expect(totals.spentSoFar).toBe(100);
  });
});
