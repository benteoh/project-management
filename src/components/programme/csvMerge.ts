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

/**
 * Merges parsed CSV rows into an existing programme tree.
 *
 * Activities matched by `activityId` are updated in place — they are NOT
 * reparented even if their position in the CSV implies a different parent.
 * The diff records field changes only; the caller should not imply reparenting
 * in any preview UI.
 */
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
      // csvParser guarantees activityId presence on "activity" rows;
      // guard retained for robustness in direct test construction.
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
