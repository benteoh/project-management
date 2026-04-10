// src/components/programme/csvMerge.test.ts
import { describe, it, expect } from "vitest";
import type { ProgrammeNode } from "@/components/programme/types";
import type { ParsedRow } from "./csvParser";
import { mergeParsedRows } from "./csvMerge";

// --- helpers ---

function scope(id: string, name: string, children: ProgrammeNode[] = []): ProgrammeNode {
  return {
    id,
    name,
    type: "scope",
    totalHours: null,
    start: "12-May-25",
    finish: "01-Sep-25",
    status: "",
    children,
    engineers: [],
  };
}

function task(id: string, name: string, children: ProgrammeNode[] = []): ProgrammeNode {
  return {
    id,
    name,
    type: "task",
    totalHours: null,
    start: "25-Jun-25",
    finish: "01-Sep-25",
    status: "",
    children,
  };
}

function activity(
  id: string,
  actId: string,
  name: string,
  extra: Partial<ProgrammeNode> = {}
): ProgrammeNode {
  return {
    id,
    activityId: actId,
    name,
    type: "activity",
    totalHours: 10,
    start: "12-May-25",
    finish: "26-May-25",
    status: "Not Started",
    children: [],
    ...extra,
  };
}

// --- tests ---

describe("mergeParsedRows - activity reparent", () => {
  it("moves an existing activity when CSV places it under a different task or scope", () => {
    const tree = [
      scope("s1", "1. GMA", [
        activity("a1", "A1000", "Act", {}),
        task("t1", "1.1 Phase 2 report", []),
      ]),
    ];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      { rowType: "task", name: "1.1 Phase 2 report" },
      {
        rowType: "activity",
        name: "Act",
        activityId: "A1000",
        start: "12-May-25",
        finish: "26-May-25",
        status: "Not Started",
      },
    ];
    const { updatedTree, diff } = mergeParsedRows(rows, tree);
    const scopeNode = updatedTree[0];
    expect(scopeNode.children).toHaveLength(1);
    const taskNode = scopeNode.children[0];
    expect(taskNode.type).toBe("task");
    const actUnderScope = scopeNode.children.find((c) => c.type === "activity");
    expect(actUnderScope).toBeUndefined();
    expect(taskNode.children).toHaveLength(1);
    expect(taskNode.children[0].activityId).toBe("A1000");
    expect(diff.updatedActivities.some((u) => u.changedFields.includes("parent"))).toBe(true);
    expect(diff.updatedActivities.find((u) => u.activityId === "A1000")?.newParentName).toContain(
      "Phase 2"
    );
  });
});

describe("mergeParsedRows - activity update", () => {
  it("updates name, start, finish and status when Activity ID matches", () => {
    const tree = [scope("s1", "1. GMA", [activity("a1", "A1000", "Old Name")])];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      {
        rowType: "activity",
        name: "New Name",
        activityId: "A1000",
        start: "12-May-25",
        finish: "28-May-25",
        status: "Completed",
      },
    ];
    const { updatedTree, diff } = mergeParsedRows(rows, tree);
    const act = updatedTree[0].children[0];
    expect(act.name).toBe("New Name");
    expect(act.finish).toBe("28-May-25");
    expect(act.status).toBe("Completed");
    expect(act.totalHours).toBe(10); // preserved
    expect(diff.updatedActivities).toHaveLength(1);
    expect(diff.updatedActivities[0].changedFields).toContain("name");
    expect(diff.updatedActivities[0].changedFields).toContain("finish");
  });

  it("does not record update when nothing changed", () => {
    const tree = [scope("s1", "1. GMA", [activity("a1", "A1000", "Same")])];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      {
        rowType: "activity",
        name: "Same",
        activityId: "A1000",
        start: "12-May-25",
        finish: "26-May-25",
        status: "Not Started",
      },
    ];
    const { diff } = mergeParsedRows(rows, tree);
    expect(diff.updatedActivities).toHaveLength(0);
  });

  it("preserves engineer allocations on existing activity's parent scope", () => {
    const scopeWithEng: ProgrammeNode = {
      ...scope("s1", "1. GMA"),
      engineers: [
        {
          engineerId: "eng-1",
          isLead: true,
          plannedHrs: 100,
          weeklyScopeLimitHrs: null,
          rate: "A",
        },
      ],
    };
    const tree = [{ ...scopeWithEng, children: [activity("a1", "A1000", "Act")] }];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      {
        rowType: "activity",
        name: "Act Updated",
        activityId: "A1000",
        start: "12-May-25",
        finish: "28-May-25",
        status: "In Progress",
      },
    ];
    const { updatedTree } = mergeParsedRows(rows, tree);
    expect(updatedTree[0].engineers).toHaveLength(1);
    expect(updatedTree[0].engineers![0].engineerId).toBe("eng-1");
  });
});

describe("mergeParsedRows - adding activities", () => {
  it("adds new activity under current scope", () => {
    const tree = [scope("s1", "1. GMA")];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      {
        rowType: "activity",
        name: "New Act",
        activityId: "A9999",
        start: "12-May-25",
        finish: "26-May-25",
        status: "Not Started",
      },
    ];
    const { updatedTree, diff } = mergeParsedRows(rows, tree);
    expect(updatedTree[0].children).toHaveLength(1);
    expect(updatedTree[0].children[0].activityId).toBe("A9999");
    expect(diff.addedActivities[0].parentName).toBe("1. GMA");
  });

  it("adds new activity under current task when task is active", () => {
    const tree = [scope("s1", "1. GMA", [task("t1", "Phase 2 report")])];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      { rowType: "task", name: "1.1 Phase 2 report" },
      {
        rowType: "activity",
        name: "Draft",
        activityId: "A1070",
        start: "25-Jun-25",
        finish: "15-Jul-25",
        status: "Not Started",
      },
    ];
    const { updatedTree } = mergeParsedRows(rows, tree);
    expect(updatedTree[0].children[0].children).toHaveLength(1);
    expect(updatedTree[0].children[0].children[0].activityId).toBe("A1070");
  });
});

describe("mergeParsedRows - structural nodes", () => {
  it("updates scope start and finish when matched by full name", () => {
    const tree = [scope("s1", "1. GMA")];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA", start: "12-May-25", finish: "15-Oct-25" },
    ];
    const { updatedTree, diff } = mergeParsedRows(rows, tree);
    expect(updatedTree[0].finish).toBe("15-Oct-25");
    expect(diff.updatedStructural).toHaveLength(1);
    expect(diff.updatedStructural[0].type).toBe("scope");
  });

  it("matches scope by WBS number only — same scope when title text changes", () => {
    const tree = [scope("s1", "1. GMA Scoping")];
    const rows: ParsedRow[] = [
      {
        rowType: "scope",
        name: "1. GMA Scoping — updated title",
        start: "12-May-25",
        finish: "01-Sep-25",
      },
    ];
    const { updatedTree, diff } = mergeParsedRows(rows, tree);
    expect(updatedTree).toHaveLength(1);
    expect(updatedTree[0].id).toBe("s1");
    expect(updatedTree[0].name).toBe("1. GMA Scoping — updated title");
    expect(diff.addedStructural).toHaveLength(0);
    expect(diff.updatedStructural).toHaveLength(1);
  });

  it("creates new scope when not found in tree", () => {
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "3. New Scope", start: "12-May-25", finish: "01-Sep-25" },
    ];
    const { updatedTree, diff } = mergeParsedRows(rows, []);
    expect(updatedTree[0].name).toBe("3. New Scope");
    expect(updatedTree[0].type).toBe("scope");
    expect(updatedTree[0].engineers).toEqual([]);
    expect(diff.addedStructural[0].name).toBe("3. New Scope");
  });

  it("strips number prefix when matching task by name", () => {
    const tree = [scope("s1", "1. GMA", [task("t1", "Phase 2 report")])];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      { rowType: "task", name: "1.1 Phase 2 report", start: "25-Jun-25", finish: "15-Oct-25" },
    ];
    const { updatedTree, diff } = mergeParsedRows(rows, tree);
    expect(updatedTree[0].children[0].finish).toBe("15-Oct-25");
    expect(updatedTree[0].children[0].name).toBe("1.1 Phase 2 report");
    expect(diff.updatedStructural[0].name).toBe("1.1 Phase 2 report");
  });

  it("creates new task with full WBS label in name", () => {
    const tree = [scope("s1", "1. GMA")];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      { rowType: "task", name: "1.1 New Task", start: "25-Jun-25", finish: "01-Sep-25" },
    ];
    const { updatedTree, diff } = mergeParsedRows(rows, tree);
    expect(updatedTree[0].children[0].name).toBe("1.1 New Task");
    expect(diff.addedStructural[0].name).toBe("1.1 New Task");
  });

  it("resets task context when a new scope is encountered", () => {
    const tree = [scope("s1", "1. GMA"), scope("s2", "2. Building Impact")];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      { rowType: "task", name: "1.1 Phase 2" },
      { rowType: "scope", name: "2. Building Impact" },
      {
        rowType: "activity",
        name: "New Act",
        activityId: "A9999",
        start: "01-Jun-25",
        finish: "01-Jul-25",
        status: "Not Started",
      },
    ];
    const { updatedTree } = mergeParsedRows(rows, tree);
    // activity should be under scope 2, not under the task in scope 1
    expect(updatedTree[1].children).toHaveLength(1);
    expect(updatedTree[1].children[0].activityId).toBe("A9999");
    expect(updatedTree[0].children[0].children).toHaveLength(0);
  });
});

describe("mergeParsedRows - warnings", () => {
  it("adds warning for activity with unparseable start date", () => {
    const tree = [scope("s1", "1. GMA")];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      { rowType: "activity", name: "Act", activityId: "A1000", startRaw: "bad-date" },
    ];
    const { diff } = mergeParsedRows(rows, tree);
    expect(diff.warnings.some((w) => w.message.includes("bad-date"))).toBe(true);
  });
});
