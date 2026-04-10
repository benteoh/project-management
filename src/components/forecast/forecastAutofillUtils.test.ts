import { describe, it, expect } from "vitest";

import { autofill, isWeekend, isoWeekKey } from "./forecastAutofillUtils";
import type { ForecastGridRow } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function row(overrides: Partial<ForecastGridRow> = {}): ForecastGridRow {
  return {
    scope: { id: "s1", label: "Scope 1" },
    engineer: { id: "e1", code: "ENG" },
    hourRate: null,
    plannedHrs: 16,
    scopeStartDate: "2026-01-05", // Monday
    scopeEndDate: "2026-03-27",
    scopeStatus: "Not Started",
    maxDailyHours: 8,
    weeklyScopeLimit: 40,
    maxWeeklyHours: 40,
    ...overrides,
  };
}

// Mon–Fri working days in the first week of Jan 2026
const WEEK1 = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"];
// Mon–Fri second week
const WEEK2 = ["2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15", "2026-01-16"];
const DATES = [...WEEK1, ...WEEK2];

// ── isWeekend ──────────────────────────────────────────────────────────────────

describe("isWeekend", () => {
  it("returns true for Saturday and Sunday", () => {
    expect(isWeekend("2026-01-03")).toBe(true); // Saturday
    expect(isWeekend("2026-01-04")).toBe(true); // Sunday
  });

  it("returns false for weekdays", () => {
    expect(isWeekend("2026-01-05")).toBe(false); // Monday
    expect(isWeekend("2026-01-09")).toBe(false); // Friday
  });
});

// ── isoWeekKey ────────────────────────────────────────────────────────────────

describe("isoWeekKey", () => {
  it("returns the same week key for Mon–Fri of the same week", () => {
    const keys = WEEK1.map(isoWeekKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("returns different week keys for two separate weeks", () => {
    expect(isoWeekKey(WEEK1[0])).not.toBe(isoWeekKey(WEEK2[0]));
  });
});

// ── autofill ──────────────────────────────────────────────────────────────────

describe("autofill — basic allocation", () => {
  it("fills cells front-loaded up to plannedHrs", () => {
    const r = row({ plannedHrs: 10, maxDailyHours: 8, weeklyScopeLimit: 40 });
    const result = autofill({
      rows: [r],
      dateColFields: DATES,
      currentValues: {},
      bankHolidays: new Set(),
    });

    const total = result.changes.reduce((s, c) => s + (c.newValue as number), 0);
    expect(total).toBe(10);
    // Front-loaded: first cell gets 8 (daily cap), second gets 2
    expect(result.changes[0].newValue).toBe(8);
    expect(result.changes[1].newValue).toBe(2);
    expect(result.changes.length).toBe(2);
  });

  it("produces integer hours only", () => {
    const result = autofill({
      rows: [row({ plannedHrs: 5 })],
      dateColFields: DATES,
      currentValues: {},
      bankHolidays: new Set(),
    });
    for (const c of result.changes) {
      expect(Number.isInteger(c.newValue)).toBe(true);
    }
  });

  it("emits no changes when plannedHrs is null", () => {
    const result = autofill({
      rows: [row({ plannedHrs: null })],
      dateColFields: DATES,
      currentValues: {},
      bankHolidays: new Set(),
    });
    expect(result.changes).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("emits no changes for a completed scope", () => {
    const result = autofill({
      rows: [row({ scopeStatus: "Completed" })],
      dateColFields: DATES,
      currentValues: {},
      bankHolidays: new Set(),
    });
    expect(result.changes).toHaveLength(0);
  });
});

describe("autofill — skips ineligible cells", () => {
  it("skips weekends", () => {
    const weekendDates = ["2026-01-03", "2026-01-04", ...WEEK1]; // Sat + Sun + 5 weekdays
    const result = autofill({
      rows: [row({ plannedHrs: 8 })],
      dateColFields: weekendDates,
      currentValues: {},
      bankHolidays: new Set(),
    });
    const filledDates = result.changes.map((c) => c.field);
    expect(filledDates).not.toContain("2026-01-03");
    expect(filledDates).not.toContain("2026-01-04");
  });

  it("skips bank holidays", () => {
    const result = autofill({
      rows: [row({ plannedHrs: 16 })],
      dateColFields: WEEK1,
      currentValues: {},
      bankHolidays: new Set(["2026-01-05"]), // block Monday
    });
    expect(result.changes.map((c) => c.field)).not.toContain("2026-01-05");
  });

  it("skips dates before scopeStartDate", () => {
    const result = autofill({
      rows: [row({ plannedHrs: 8, scopeStartDate: "2026-01-07" })], // start Wed
      dateColFields: WEEK1,
      currentValues: {},
      bankHolidays: new Set(),
    });
    const filledDates = result.changes.map((c) => c.field);
    expect(filledDates).not.toContain("2026-01-05"); // Mon before start
    expect(filledDates).not.toContain("2026-01-06"); // Tue before start
  });

  it("skips cells that already have a value", () => {
    const rowId = "s1-e1";
    const existing = { [rowId]: { "2026-01-05": 4 } };
    const result = autofill({
      rows: [row({ plannedHrs: 12 })],
      dateColFields: WEEK1,
      currentValues: existing,
      bankHolidays: new Set(),
    });
    const filledDates = result.changes.map((c) => c.field);
    expect(filledDates).not.toContain("2026-01-05");
  });
});

describe("autofill — capacity constraints", () => {
  it("respects daily cap across two scope rows for same engineer", () => {
    // Two scopes, same engineer, maxDailyHours = 8 → combined daily total ≤ 8
    const r1 = row({ scope: { id: "s1", label: "Scope 1" }, plannedHrs: 16 });
    const r2 = row({ scope: { id: "s2", label: "Scope 2" }, plannedHrs: 16 });

    const result = autofill({
      rows: [r1, r2],
      dateColFields: WEEK1,
      currentValues: {},
      bankHolidays: new Set(),
    });

    // Group changes by date
    const byDate = new Map<string, number>();
    for (const c of result.changes) {
      byDate.set(c.field, (byDate.get(c.field) ?? 0) + (c.newValue as number));
    }
    for (const [, total] of byDate) {
      expect(total).toBeLessThanOrEqual(8);
    }
  });

  it("respects weekly cap", () => {
    const r = row({ plannedHrs: 100, maxDailyHours: 8, weeklyScopeLimit: 20 });
    const result = autofill({
      rows: [r],
      dateColFields: WEEK1,
      currentValues: {},
      bankHolidays: new Set(),
    });
    const weekTotal = result.changes.reduce((s, c) => s + (c.newValue as number), 0);
    expect(weekTotal).toBeLessThanOrEqual(20);
  });

  it("tracks weekly hours per scope (same engineer can use full cap on each scope)", () => {
    const r1 = row({
      scope: { id: "s1", label: "S1" },
      plannedHrs: 8,
      weeklyScopeLimit: 5,
    });
    const r2 = row({
      scope: { id: "s2", label: "S2" },
      plannedHrs: 8,
      weeklyScopeLimit: 5,
    });
    const result = autofill({
      rows: [r1, r2],
      dateColFields: WEEK1,
      currentValues: {},
      bankHolidays: new Set(),
    });
    const sumForRow = (rowId: string) =>
      result.changes
        .filter((c) => c.rowId === rowId)
        .reduce((s, c) => s + (c.newValue as number), 0);
    expect(sumForRow("s1-e1")).toBeLessThanOrEqual(5);
    expect(sumForRow("s2-e1")).toBeLessThanOrEqual(5);
    expect(sumForRow("s1-e1") + sumForRow("s2-e1")).toBe(10);
  });

  it("accounts for pre-existing hours when computing daily cap", () => {
    // Engineer already has 6h on Monday from another scope (not in rows)
    const rowId = "s2-e1"; // different scope, same engineer
    const existing = { [rowId]: { "2026-01-05": 6 } };

    // Row we're filling has same engineer id
    const r = row({ plannedHrs: 8 });
    // Add the "other scope" row to rows so it's included in capacity totals
    const otherRow = row({
      scope: { id: "s2", label: "Other" },
      plannedHrs: 10,
      scopeStatus: "Completed", // won't be filled, but its existing hours count
    });

    const result = autofill({
      rows: [r, otherRow],
      dateColFields: WEEK1,
      currentValues: existing,
      bankHolidays: new Set(),
    });

    // On 2026-01-05, daily cap is 8, 6h already used → at most 2h should be filled
    const mondayChange = result.changes.find((c) => c.field === "2026-01-05");
    if (mondayChange) {
      expect(mondayChange.newValue as number).toBeLessThanOrEqual(2);
    }
  });
});

describe("autofill — row priority (deadline sort)", () => {
  it("fills earlier-deadline row first when engineers compete for capacity", () => {
    const earlyRow = row({
      scope: { id: "s1", label: "Early" },
      plannedHrs: 8,
      scopeEndDate: "2026-01-09", // this week
    });
    const lateRow = row({
      scope: { id: "s2", label: "Late" },
      plannedHrs: 8,
      scopeEndDate: "2026-03-27",
    });

    // maxDailyHours = 8 → only one row can fill each day fully
    const result = autofill({
      rows: [lateRow, earlyRow], // intentionally reversed — sort should fix this
      dateColFields: WEEK1,
      currentValues: {},
      bankHolidays: new Set(),
    });

    const earlyTotal = result.changes
      .filter((c) => c.rowId === "s1-e1")
      .reduce((s, c) => s + (c.newValue as number), 0);

    // Early deadline row should have gotten its full 8h
    expect(earlyTotal).toBe(8);
  });
});

describe("autofill — targetRowIds / targetCells (selection mode)", () => {
  it("only fills rows in targetRowIds", () => {
    const r1 = row({ scope: { id: "s1", label: "S1" }, plannedHrs: 8 });
    const r2 = row({ scope: { id: "s2", label: "S2" }, plannedHrs: 8 });

    const result = autofill({
      rows: [r1, r2],
      dateColFields: WEEK1,
      currentValues: {},
      bankHolidays: new Set(),
      targetRowIds: new Set(["s1-e1"]),
    });

    const rowIds = new Set(result.changes.map((c) => c.rowId));
    expect(rowIds.has("s1-e1")).toBe(true);
    expect(rowIds.has("s2-e1")).toBe(false);
  });

  it("only fills cells in targetCells", () => {
    const result = autofill({
      rows: [row({ plannedHrs: 40 })],
      dateColFields: WEEK1,
      currentValues: {},
      bankHolidays: new Set(),
      targetCells: new Set(["s1-e1:2026-01-05", "s1-e1:2026-01-06"]),
    });

    expect(result.changes.every((c) => ["2026-01-05", "2026-01-06"].includes(c.field))).toBe(true);
  });
});

describe("autofill — warnings", () => {
  it("warns when hours cannot be fully allocated due to capacity", () => {
    // Only 1 working day available (WEEK1[0]) with maxDailyHours=4,
    // but plannedHrs=8 — can only fill 4h
    const result = autofill({
      rows: [row({ plannedHrs: 8, maxDailyHours: 4 })],
      dateColFields: ["2026-01-05"], // single day
      currentValues: {},
      bankHolidays: new Set(),
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/unallocated/i);
  });

  it("emits no warnings when all hours are allocated", () => {
    const result = autofill({
      rows: [row({ plannedHrs: 8 })],
      dateColFields: WEEK1,
      currentValues: {},
      bankHolidays: new Set(),
    });
    expect(result.warnings).toHaveLength(0);
  });
});
