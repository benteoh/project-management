# CSV Import for Programme Scopes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow PMs to upload a Primavera P6 tab-separated CSV to set up or update a programme tree — merging by Activity ID, preserving engineer allocations.

**Architecture:** Two pure parsing modules (`csvParser.ts`, `csvMerge.ts`) are tested in isolation. A modal component (`CsvImportModal.tsx`) owns the upload → preview → confirm flow. `ProgrammeTab.tsx` wires the modal and commits the merged tree via its existing `commit()` + save pipeline.

**Tech Stack:** Next.js 15, TypeScript strict, Vitest (`npm test`), shadcn/ui design tokens, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-09-csv-import-scope-design.md`

---

## File Map

| Action | Path                                                | Responsibility                                 |
| ------ | --------------------------------------------------- | ---------------------------------------------- |
| Create | `src/components/programme/csvParser.ts`             | CSV string → `ParsedRow[]`; no tree knowledge  |
| Create | `src/components/programme/csvParser.test.ts`        | Unit tests for csvParser                       |
| Create | `src/components/programme/csvMerge.ts`              | `ParsedRow[]` + tree → `{ updatedTree, diff }` |
| Create | `src/components/programme/csvMerge.test.ts`         | Unit tests for csvMerge                        |
| Create | `src/components/programme/CsvImportModal.tsx`       | Modal UI: upload → preview → confirm/cancel    |
| Modify | `src/components/programme/ProgrammeTableHeader.tsx` | Add `onImportCsv` prop + Import button         |
| Modify | `src/components/programme/ProgrammeTab.tsx`         | Wire modal state + confirm handler             |

---

## Task 1: Write failing tests for `csvParser.ts`

**Files:**

- Create: `src/components/programme/csvParser.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/components/programme/csvParser.test.ts
import { describe, it, expect } from "vitest";
import { parseCsv } from "./csvParser";

const HDR = "Activity ID\tActivity Name\tStart\tFinish\tActivity Status";

describe("parseCsv - header validation", () => {
  it("throws when a required column is missing", () => {
    expect(() =>
      parseCsv("Wrong Header\tActivity Name\tStart\tFinish\tActivity Status\nA1000\tFoo\t\t\t")
    ).toThrow("Missing required columns: Activity ID");
  });

  it("throws on empty file", () => {
    expect(() => parseCsv("   ")).toThrow("File is empty");
  });
});

describe("parseCsv - row type detection", () => {
  it("skips project header row (no Activity ID, no number prefix)", () => {
    const csv = `${HDR}\n\tDSP HS2 Euston Design\t\t\t`;
    expect(parseCsv(csv)[0].rowType).toBe("skip");
  });

  it("identifies scope row by '1. ' pattern", () => {
    const csv = `${HDR}\n\t1. GMA Scoping\t12/05/2025 9:00\t01-Sep-25 16:00 A\t`;
    expect(parseCsv(csv)[0].rowType).toBe("scope");
  });

  it("identifies task row by '1.1 ' pattern", () => {
    const csv = `${HDR}\n\t1.1 Phase 2 report\t25/06/2025 09:00\t01-Sep-25 16:00 A\t`;
    expect(parseCsv(csv)[0].rowType).toBe("task");
  });

  it("identifies subtask row by '1.1.1 ' pattern", () => {
    const csv = `${HDR}\n\t1.1.1 Sub-item\t25/06/2025 09:00\t01-Sep-25 16:00 A\t`;
    expect(parseCsv(csv)[0].rowType).toBe("subtask");
  });

  it("identifies activity row when Activity ID is present", () => {
    const csv = `${HDR}\nA1000\tCollect info\t12/05/2025 9:00\t26/05/2025 09:00\tCompleted`;
    const row = parseCsv(csv)[0];
    expect(row.rowType).toBe("activity");
    expect(row.activityId).toBe("A1000");
    expect(row.status).toBe("Completed");
  });
});

describe("parseCsv - date normalisation", () => {
  it("normalises DD/MM/YYYY HH:mm to dd-Mon-yy", () => {
    const csv = `${HDR}\nA1000\tFoo\t12/05/2025 9:00\t26/05/2025 09:00\t`;
    const row = parseCsv(csv)[0];
    expect(row.start).toBe("12-May-25");
    expect(row.finish).toBe("26-May-25");
  });

  it("normalises DD-Mon-YY HH:mm A to dd-Mon-yy", () => {
    const csv = `${HDR}\nA1000\tFoo\t01-Sep-25 16:00 A\t23-May-25 16:00 A\t`;
    const row = parseCsv(csv)[0];
    expect(row.start).toBe("01-Sep-25");
    expect(row.finish).toBe("23-May-25");
  });

  it("returns undefined and stores startRaw for unparseable date", () => {
    const csv = `${HDR}\nA1000\tFoo\tnot-a-date\t26/05/2025 09:00\t`;
    const row = parseCsv(csv)[0];
    expect(row.start).toBeUndefined();
    expect(row.startRaw).toBe("not-a-date");
  });

  it("omits start/finish and startRaw/finishRaw when date cells are empty", () => {
    const csv = `${HDR}\nA1000\tFoo\t\t\t`;
    const row = parseCsv(csv)[0];
    expect(row.start).toBeUndefined();
    expect(row.startRaw).toBeUndefined();
    expect(row.finish).toBeUndefined();
    expect(row.finishRaw).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
npm test -- csvParser
```

Expected: `Error: Cannot find module './csvParser'`

---

## Task 2: Implement `csvParser.ts`

**Files:**

- Create: `src/components/programme/csvParser.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/components/programme/csvParser.ts
import type { ActivityStatus } from "@/types/programme-node";

export type ParsedRowType = "skip" | "scope" | "task" | "subtask" | "activity";

export interface ParsedRow {
  rowType: ParsedRowType;
  name: string;
  activityId?: string;
  /** Normalised "dd-Mon-yy". Undefined when cell is empty or unparseable. */
  start?: string;
  finish?: string;
  status?: ActivityStatus;
  /** Original value when start could not be parsed (for warnings). */
  startRaw?: string;
  finishRaw?: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const VALID_STATUSES = new Set<string>(["Not Started", "In Progress", "Completed", ""]);
const REQUIRED_COLUMNS = [
  "Activity ID",
  "Activity Name",
  "Start",
  "Finish",
  "Activity Status",
] as const;

function parseDate(raw: string): string | undefined {
  if (!raw.trim()) return undefined;

  // "01-Sep-25 16:00 A" → "01-Sep-25"
  const monMatch = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})/);
  if (monMatch) {
    return `${monMatch[1].padStart(2, "0")}-${monMatch[2]}-${monMatch[3]}`;
  }

  // "12/05/2025 9:00" → "12-May-25"
  const dmyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = MONTHS[parseInt(dmyMatch[2], 10) - 1];
    const year = dmyMatch[3].slice(2);
    if (!month) return undefined;
    return `${day}-${month}-${year}`;
  }

  return undefined;
}

function parseStatus(raw: string): ActivityStatus | undefined {
  const s = raw.trim();
  return VALID_STATUSES.has(s) ? (s as ActivityStatus) : undefined;
}

function detectRowType(activityId: string, name: string): ParsedRowType {
  if (activityId.trim()) return "activity";
  const t = name.trim();
  if (/^\d+\.\d+\.\d+/.test(t)) return "subtask";
  if (/^\d+\.\d+/.test(t)) return "task";
  if (/^\d+\.\s/.test(t)) return "scope";
  return "skip";
}

export function parseCsv(csvString: string): ParsedRow[] {
  const lines = csvString.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) throw new Error("File is empty");

  const headers = lines[0].split("\t");
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) throw new Error(`Missing required columns: ${missing.join(", ")}`);

  const idx = {
    id: headers.indexOf("Activity ID"),
    name: headers.indexOf("Activity Name"),
    start: headers.indexOf("Start"),
    finish: headers.indexOf("Finish"),
    status: headers.indexOf("Activity Status"),
  };

  return lines.slice(1).map((line): ParsedRow => {
    const cols = line.split("\t");
    const activityId = cols[idx.id]?.trim() ?? "";
    const name = cols[idx.name]?.trim() ?? "";
    const startRaw = cols[idx.start]?.trim() ?? "";
    const finishRaw = cols[idx.finish]?.trim() ?? "";
    const statusRaw = cols[idx.status]?.trim() ?? "";

    const rowType = detectRowType(activityId, name);
    const start = parseDate(startRaw);
    const finish = parseDate(finishRaw);
    const status = parseStatus(statusRaw);

    return {
      rowType,
      name,
      ...(activityId ? { activityId } : {}),
      ...(start !== undefined ? { start } : {}),
      ...(finish !== undefined ? { finish } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(start === undefined && startRaw ? { startRaw } : {}),
      ...(finish === undefined && finishRaw ? { finishRaw } : {}),
    };
  });
}
```

- [ ] **Step 2: Run tests — expect pass**

```bash
npm test -- csvParser
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/programme/csvParser.ts src/components/programme/csvParser.test.ts
git commit -m "add csvParser: P6 CSV → ParsedRow[] with date normalisation"
```

---

## Task 3: Write failing tests for `csvMerge.ts`

**Files:**

- Create: `src/components/programme/csvMerge.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
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
      engineers: [{ engineerId: "eng-1", isLead: true, plannedHrs: 100, rate: "A" }],
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
    expect(updatedTree[0].children[0].name).toBe("Phase 2 report"); // name unchanged
    expect(diff.updatedStructural[0].name).toBe("Phase 2 report");
  });

  it("creates new task stored without number prefix", () => {
    const tree = [scope("s1", "1. GMA")];
    const rows: ParsedRow[] = [
      { rowType: "scope", name: "1. GMA" },
      { rowType: "task", name: "1.1 New Task", start: "25-Jun-25", finish: "01-Sep-25" },
    ];
    const { updatedTree, diff } = mergeParsedRows(rows, tree);
    expect(updatedTree[0].children[0].name).toBe("New Task");
    expect(diff.addedStructural[0].name).toBe("New Task");
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
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
npm test -- csvMerge
```

Expected: `Error: Cannot find module './csvMerge'`

---

## Task 4: Implement `csvMerge.ts`

**Files:**

- Create: `src/components/programme/csvMerge.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/components/programme/csvMerge.ts
import type { ProgrammeNode } from "@/components/programme/types";
import type { ParsedRow } from "./csvParser";

export interface ActivityChange {
  activityId: string;
  name: string;
  changedFields: Array<"name" | "start" | "finish" | "status">;
}

export interface NewActivity {
  activityId: string;
  name: string;
  parentName: string;
}

export interface StructuralChange {
  name: string;
  type: "scope" | "task" | "subtask";
}

export interface ImportWarning {
  rowIndex: number;
  message: string;
}

export interface ImportDiff {
  updatedActivities: ActivityChange[];
  addedActivities: NewActivity[];
  updatedStructural: StructuralChange[];
  addedStructural: StructuralChange[];
  warnings: ImportWarning[];
}

function stripNumberPrefix(name: string): string {
  return name.replace(/^\s*[\d.]+\s+/, "").trim();
}

function deepClone(nodes: ProgrammeNode[]): ProgrammeNode[] {
  return nodes.map((n) => ({
    ...n,
    children: deepClone(n.children),
    engineers: n.engineers ? [...n.engineers] : undefined,
  }));
}

function buildActivityMap(
  nodes: ProgrammeNode[],
  map = new Map<string, ProgrammeNode>()
): Map<string, ProgrammeNode> {
  for (const n of nodes) {
    if (n.activityId) map.set(n.activityId, n);
    buildActivityMap(n.children, map);
  }
  return map;
}

function applyDates(node: ProgrammeNode, row: ParsedRow): boolean {
  let changed = false;
  if (row.start !== undefined && row.start !== node.start) {
    node.start = row.start;
    changed = true;
  }
  if (row.finish !== undefined && row.finish !== node.finish) {
    node.finish = row.finish;
    changed = true;
  }
  return changed;
}

function makeStructuralNode(
  name: string,
  type: "scope" | "task" | "subtask",
  row: ParsedRow
): ProgrammeNode {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    totalHours: null,
    start: row.start ?? "",
    finish: row.finish ?? "",
    status: "",
    children: [],
    ...(type === "scope" ? { engineers: [] } : {}),
  };
}

export function mergeParsedRows(
  rows: ParsedRow[],
  tree: ProgrammeNode[]
): { updatedTree: ProgrammeNode[]; diff: ImportDiff } {
  const root = deepClone(tree);
  const activityMap = buildActivityMap(root);

  const diff: ImportDiff = {
    updatedActivities: [],
    addedActivities: [],
    updatedStructural: [],
    addedStructural: [],
    warnings: [],
  };

  let currentScope: ProgrammeNode | null = null;
  let currentTask: ProgrammeNode | null = null;
  let currentSubtask: ProgrammeNode | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.rowType === "skip") continue;

    if (row.rowType === "scope") {
      let node = root.find((n) => n.name === row.name && n.type === "scope") ?? null;
      if (node) {
        if (applyDates(node, row)) diff.updatedStructural.push({ name: row.name, type: "scope" });
      } else {
        node = makeStructuralNode(row.name, "scope", row);
        root.push(node);
        diff.addedStructural.push({ name: row.name, type: "scope" });
      }
      currentScope = node;
      currentTask = null;
      currentSubtask = null;
      continue;
    }

    if (row.rowType === "task") {
      if (!currentScope) {
        diff.warnings.push({
          rowIndex: i,
          message: `Task "${row.name}" has no parent scope, skipped`,
        });
        continue;
      }
      const stripped = stripNumberPrefix(row.name);
      let node =
        currentScope.children.find((n) => n.name === stripped && n.type === "task") ?? null;
      if (node) {
        if (applyDates(node, row)) diff.updatedStructural.push({ name: stripped, type: "task" });
      } else {
        node = makeStructuralNode(stripped, "task", row);
        currentScope.children.push(node);
        diff.addedStructural.push({ name: stripped, type: "task" });
      }
      currentTask = node;
      currentSubtask = null;
      continue;
    }

    if (row.rowType === "subtask") {
      const parent = currentTask ?? currentScope;
      if (!parent) {
        diff.warnings.push({
          rowIndex: i,
          message: `Subtask "${row.name}" has no parent, skipped`,
        });
        continue;
      }
      const stripped = stripNumberPrefix(row.name);
      let node = parent.children.find((n) => n.name === stripped && n.type === "subtask") ?? null;
      if (node) {
        if (applyDates(node, row)) diff.updatedStructural.push({ name: stripped, type: "subtask" });
      } else {
        node = makeStructuralNode(stripped, "subtask", row);
        parent.children.push(node);
        diff.addedStructural.push({ name: stripped, type: "subtask" });
      }
      currentSubtask = node;
      continue;
    }

    if (row.rowType === "activity") {
      if (!row.activityId) continue;
      const currentParent = currentSubtask ?? currentTask ?? currentScope;

      if (row.startRaw)
        diff.warnings.push({
          rowIndex: i,
          message: `Unrecognised start date "${row.startRaw}" on ${row.activityId}`,
        });
      if (row.finishRaw)
        diff.warnings.push({
          rowIndex: i,
          message: `Unrecognised finish date "${row.finishRaw}" on ${row.activityId}`,
        });

      const existing = activityMap.get(row.activityId);
      if (existing) {
        const changedFields: ActivityChange["changedFields"] = [];
        if (row.name && row.name !== existing.name) {
          existing.name = row.name;
          changedFields.push("name");
        }
        if (row.start !== undefined && row.start !== existing.start) {
          existing.start = row.start;
          changedFields.push("start");
        }
        if (row.finish !== undefined && row.finish !== existing.finish) {
          existing.finish = row.finish;
          changedFields.push("finish");
        }
        if (row.status !== undefined && row.status !== existing.status) {
          existing.status = row.status;
          changedFields.push("status");
        }
        if (changedFields.length > 0) {
          diff.updatedActivities.push({
            activityId: row.activityId,
            name: existing.name,
            changedFields,
          });
        }
      } else {
        if (!currentParent) {
          diff.warnings.push({
            rowIndex: i,
            message: `Activity ${row.activityId} has no parent scope, skipped`,
          });
          continue;
        }
        const newNode: ProgrammeNode = {
          id: crypto.randomUUID(),
          activityId: row.activityId,
          name: row.name,
          type: "activity",
          totalHours: null,
          start: row.start ?? "",
          finish: row.finish ?? "",
          status: row.status ?? "Not Started",
          children: [],
        };
        currentParent.children.push(newNode);
        activityMap.set(row.activityId, newNode);
        diff.addedActivities.push({
          activityId: row.activityId,
          name: row.name,
          parentName: currentParent.name,
        });
      }
    }
  }

  return { updatedTree: root, diff };
}
```

- [ ] **Step 2: Run tests — expect pass**

```bash
npm test -- csvMerge
```

Expected: All tests pass.

- [ ] **Step 3: Run all tests to confirm nothing broken**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/programme/csvMerge.ts src/components/programme/csvMerge.test.ts
git commit -m "add csvMerge: ParsedRow[] + tree → { updatedTree, diff }"
```

---

## Task 5: Implement `CsvImportModal.tsx`

**Files:**

- Create: `src/components/programme/CsvImportModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
// src/components/programme/CsvImportModal.tsx
"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

import type { ProgrammeNode } from "./types";
import { parseCsv } from "./csvParser";
import { mergeParsedRows, type ImportDiff } from "./csvMerge";

interface CsvImportModalProps {
  tree: ProgrammeNode[];
  onConfirm: (updatedTree: ProgrammeNode[]) => void;
  onClose: () => void;
}

type Step = "upload" | "preview";

export function CsvImportModal({ tree, onConfirm, onClose }: CsvImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [pendingTree, setPendingTree] = useState<ProgrammeNode[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasChanges = diff
    ? diff.updatedActivities.length > 0 ||
      diff.addedActivities.length > 0 ||
      diff.updatedStructural.length > 0 ||
      diff.addedStructural.length > 0
    : false;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCsv(ev.target?.result as string);
        const result = mergeParsedRows(rows, tree);
        setDiff(result.diff);
        setPendingTree(result.updatedTree);
        setError(null);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  }

  function handleBack() {
    setStep("upload");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card shadow-overlay w-full max-w-lg rounded-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">Import CSV</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Upload a Primavera P6 tab-separated CSV export. Activities are merged by Activity ID.
              Engineer allocations and hours are preserved.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="text-muted-foreground block w-full text-sm"
            />
            {error && <p className="text-status-critical text-sm">{error}</p>}
          </div>
        )}

        {step === "preview" && diff && (
          <div className="space-y-4">
            <div className="max-h-72 space-y-3 overflow-y-auto text-sm">
              {!hasChanges && <p className="text-muted-foreground">No changes detected.</p>}
              <DiffSection
                count={diff.addedStructural.length}
                label="scope/task(s) created"
                items={diff.addedStructural.map((s) => s.name)}
              />
              <DiffSection
                count={diff.updatedStructural.length}
                label="scope/task(s) updated"
                items={diff.updatedStructural.map((s) => s.name)}
              />
              <DiffSection
                count={diff.addedActivities.length}
                label={diff.addedActivities.length === 1 ? "activity added" : "activities added"}
                items={diff.addedActivities.map((a) => `${a.activityId} – ${a.name}`)}
              />
              <DiffSection
                count={diff.updatedActivities.length}
                label={
                  diff.updatedActivities.length === 1 ? "activity updated" : "activities updated"
                }
                items={diff.updatedActivities.map((a) => `${a.activityId} – ${a.name}`)}
              />
              {diff.warnings.length > 0 && (
                <div>
                  <p className="text-status-warning font-medium">
                    {diff.warnings.length} warning(s)
                  </p>
                  <ul className="text-muted-foreground mt-1 space-y-0.5 pl-3">
                    {diff.warnings.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ← Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="border-border text-foreground hover:bg-background rounded-md border px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => pendingTree && onConfirm(pendingTree)}
                  disabled={!hasChanges}
                  className="bg-foreground text-background rounded-md px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DiffSection({ count, label, items }: { count: number; label: string; items: string[] }) {
  if (count === 0) return null;
  return (
    <div>
      <p className="text-foreground font-medium">
        {count} {label}
      </p>
      <ul className="text-muted-foreground mt-1 space-y-0.5 pl-3">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Check build passes**

```bash
npm run build
```

Expected: No type errors related to CsvImportModal.

- [ ] **Step 3: Commit**

```bash
git add src/components/programme/CsvImportModal.tsx
git commit -m "add CsvImportModal: upload → diff preview → confirm"
```

---

## Task 6: Add Import button to `ProgrammeTableHeader`

**Files:**

- Modify: `src/components/programme/ProgrammeTableHeader.tsx`

Current props type (lines 22–28):

```typescript
type ProgrammeTableHeaderProps = {
  sort: ActivitySort;
  statusFilterActive: boolean;
  onSort: (column: ProgrammeSortColumn) => void;
  onStatusFilterClick: (e: MouseEvent<HTMLElement>) => void;
  onAddScope?: () => void;
};
```

- [ ] **Step 1: Add `onImportCsv` prop to the type and destructure it**

Replace the type block and function signature:

```typescript
type ProgrammeTableHeaderProps = {
  sort: ActivitySort;
  statusFilterActive: boolean;
  onSort: (column: ProgrammeSortColumn) => void;
  onStatusFilterClick: (e: MouseEvent<HTMLElement>) => void;
  onAddScope?: () => void;
  onImportCsv?: () => void;
};

export function ProgrammeTableHeader({
  sort,
  statusFilterActive,
  onSort,
  onStatusFilterClick,
  onAddScope,
  onImportCsv,
}: ProgrammeTableHeaderProps) {
```

- [ ] **Step 2: Add Import button next to the Scope button (inside the `h.type === "name"` block)**

The existing Scope button block (lines 49–58) currently reads:

```tsx
{
  onAddScope && (
    <button
      type="button"
      onClick={onAddScope}
      className="text-foreground hover:bg-muted border-border inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
    >
      <Plus size={14} className="text-muted-foreground" aria-hidden />
      Scope
    </button>
  );
}
```

Replace it with:

```tsx
<div className="inline-flex shrink-0 items-center gap-1">
  {onImportCsv && (
    <button
      type="button"
      onClick={onImportCsv}
      className="text-foreground hover:bg-muted border-border inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
    >
      Import CSV
    </button>
  )}
  {onAddScope && (
    <button
      type="button"
      onClick={onAddScope}
      className="text-foreground hover:bg-muted border-border inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
    >
      <Plus size={14} className="text-muted-foreground" aria-hidden />
      Scope
    </button>
  )}
</div>
```

- [ ] **Step 3: Check build**

```bash
npm run build
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/programme/ProgrammeTableHeader.tsx
git commit -m "add Import CSV button to ProgrammeTableHeader"
```

---

## Task 7: Wire `CsvImportModal` into `ProgrammeTab`

**Files:**

- Modify: `src/components/programme/ProgrammeTab.tsx`

- [ ] **Step 1: Add the import at the top of `ProgrammeTab.tsx`** (alongside the other local imports)

```typescript
import { CsvImportModal } from "./CsvImportModal";
```

- [ ] **Step 2: Add modal state** (alongside the other `useState` declarations, ~line 80)

```typescript
const [showImportModal, setShowImportModal] = useState(false);
```

- [ ] **Step 3: Add the confirm handler** (alongside `openAddScopeModal`, ~line 299)

```typescript
function handleImportConfirm(importedTree: ProgrammeNode[]) {
  commit(applyProgrammeRollups(importedTree));
  setShowImportModal(false);
}
```

- [ ] **Step 4: Pass `onImportCsv` to `ProgrammeTableHeader`**

Find the existing `<ProgrammeTableHeader` usage and add the prop:

```tsx
<ProgrammeTableHeader
  sort={activityQuery.sort}
  statusFilterActive={Boolean(activityQuery.statuses)}
  onSort={toggleSort}
  onStatusFilterClick={(e) => openFilterFor("status", e)}
  onAddScope={openAddScopeModal}
  onImportCsv={() => setShowImportModal(true)}
/>
```

- [ ] **Step 5: Add the modal to the JSX return** (at the end of the return block, alongside `AddNodeModal` and `EngineerPopup`)

```tsx
{
  showImportModal && (
    <CsvImportModal
      tree={present}
      onConfirm={handleImportConfirm}
      onClose={() => setShowImportModal(false)}
    />
  );
}
```

- [ ] **Step 6: Run full build and all tests**

```bash
npm run build && npm test
```

Expected: Clean build, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/programme/ProgrammeTab.tsx
git commit -m "wire CsvImportModal into ProgrammeTab"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement                      | Task                                       |
| ------------------------------------- | ------------------------------------------ |
| CSV upload (file input, .csv)         | Task 5                                     |
| Preview diff before applying          | Task 5                                     |
| Confirm merges via existing save flow | Task 7                                     |
| Cancel discards                       | Task 5                                     |
| Undoable via undo stack               | Task 7 (commit() handles history)          |
| Match activities by Activity ID       | Task 4                                     |
| Update name, start, finish, status    | Task 4                                     |
| Preserve totalHours, engineers        | Task 4 (deepClone + targeted field update) |
| Scope matched by full name            | Task 4                                     |
| Task matched by stripped name         | Task 4                                     |
| Update scope/task start+finish        | Task 4                                     |
| Create new scope with prefix          | Task 4                                     |
| Create new task without prefix        | Task 4                                     |
| Blocking error: missing columns       | Task 2                                     |
| Warning: unparseable date             | Task 4                                     |
| Import button in toolbar              | Task 6                                     |
| Date DD/MM/YYYY normalisation         | Task 2                                     |
| Date DD-Mon-YY normalisation          | Task 2                                     |
| Activity Status used directly         | Task 2                                     |
| No changes → confirm disabled         | Task 5                                     |

All spec requirements covered. ✓

**Placeholder scan:** None found. ✓

**Type consistency:**

- `ParsedRow` defined in Task 2 (`csvParser.ts`), imported in Tasks 3, 4, 5. ✓
- `ImportDiff` defined in Task 4 (`csvMerge.ts`), imported in Task 5. ✓
- `mergeParsedRows` signature consistent across Tasks 3–5. ✓
- `commit()` called with `ProgrammeNode[]` in Task 7, matching existing usage in `ProgrammeTab`. ✓
