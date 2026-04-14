import { describe, expect, it } from "vitest";

import { computeTimesheetRowIssues, type TimesheetIssuesContext } from "./timesheetRowIssues";

const baseContext: TimesheetIssuesContext = {
  hoursIdx: 0,
  employeeIdx: -1,
  taskIdIdx: 1,
  activityColIdx: -1,
  notesIdx: -1,
  projectIdx: -1,
  scopeNames: ["Endwalls Design", "Boiler Room"],
  knownEmployees: new Set(),
  project: null,
  scopeMappings: new Map(),
  programmeTree: [],
};

describe("computeTimesheetRowIssues — scope_unmatched", () => {
  it("flags scope_unmatched when text has no match and no mapping", () => {
    const row = ["7", "totaly rong speling"];
    const issues = computeTimesheetRowIssues(row, baseContext);
    expect(issues.some((i) => i.issueId === "scope_unmatched")).toBe(true);
  });

  it("does not flag scope_unmatched when text fuzzy-matches a scope name", () => {
    const row = ["7", "Endwalls Design"];
    const issues = computeTimesheetRowIssues(row, baseContext);
    expect(issues.some((i) => i.issueId === "scope_unmatched")).toBe(false);
  });

  it("does not flag scope_unmatched when text has an explicit mapping", () => {
    const ctx: TimesheetIssuesContext = {
      ...baseContext,
      scopeMappings: new Map([["totaly rong speling", "scope-uuid-123"]]),
    };
    const row = ["7", "totaly rong speling"];
    const issues = computeTimesheetRowIssues(row, ctx);
    expect(issues.some((i) => i.issueId === "scope_unmatched")).toBe(false);
  });

  it("mapping lookup is case-insensitive", () => {
    const ctx: TimesheetIssuesContext = {
      ...baseContext,
      scopeMappings: new Map([["totaly rong speling", "scope-uuid-123"]]),
    };
    const row = ["7", "TOTALY RONG SPELING"];
    const issues = computeTimesheetRowIssues(row, ctx);
    expect(issues.some((i) => i.issueId === "scope_unmatched")).toBe(false);
  });
});
