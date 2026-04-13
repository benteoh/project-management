// src/components/programme/csvMerge.ts
import type { ProgrammeNode } from "@/components/programme/types";
import {
  sortProgrammeNodesByWbs,
  wbsKeysEqual,
  wbsSortKeyFromLabel,
} from "@/lib/programme/wbsSort";
import type { ParsedRow } from "./csvParser";

export interface ActivityChange {
  activityId: string;
  name: string;
  changedFields: Array<"name" | "start" | "finish" | "status" | "parent">;
  /** When `parent` is in changedFields — CSV implied parent after import. */
  newParentName?: string;
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

/** Text after leading `1. ` / `1.1 ` style prefix (for legacy nodes saved without WBS in the name). */
function stripLeadingWbsPrefix(name: string): string {
  return name.replace(/^\s*[\d.]+\s+/, "").trim();
}

/**
 * Match structural nodes by WBS numeric segments (1., 1.1, …), not the full title — names can change.
 * If both sides parse to the same key, they match. Otherwise: exact string match, or stripped-title
 * match only when at least one side has no WBS key (legacy task stored as "Phase 2" vs CSV "1.1 Phase 2").
 */
function structuralMatchByWbs(stored: string, csvRow: string): boolean {
  const k1 = wbsSortKeyFromLabel(stored);
  const k2 = wbsSortKeyFromLabel(csvRow);
  if (k1 !== null && k2 !== null) {
    if (wbsKeysEqual(k1, k2)) return true;
    return false;
  }
  if (stored.trim() === csvRow.trim()) return true;
  const s1 = stripLeadingWbsPrefix(stored);
  const s2 = stripLeadingWbsPrefix(csvRow);
  return s1 !== "" && s1 === s2;
}

function applyStructuralFields(node: ProgrammeNode, row: ParsedRow, label: string): boolean {
  let changed = false;
  if (node.name !== label) {
    node.name = label;
    changed = true;
  }
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

function findActivityWithParent(
  list: ProgrammeNode[],
  activityId: string,
  parent: ProgrammeNode | null = null
): { parent: ProgrammeNode | null; node: ProgrammeNode } | null {
  for (const n of list) {
    if (n.type === "activity" && n.activityId === activityId) {
      return { parent, node: n };
    }
    const r = findActivityWithParent(n.children, activityId, n);
    if (r) return r;
  }
  return null;
}

function removeActivityFromParent(
  root: ProgrammeNode[],
  parent: ProgrammeNode | null,
  activityId: string
): void {
  const list = parent ? parent.children : root;
  const idx = list.findIndex((c) => c.type === "activity" && c.activityId === activityId);
  if (idx >= 0) list.splice(idx, 1);
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
    ...(type === "scope"
      ? { engineers: [], quotedAmount: null, quotationWarningAmount: null }
      : {}),
  };
}

/**
 * Merges parsed CSV rows into an existing programme tree.
 *
 * Activities matched by `activityId` are updated in place. If the CSV hierarchy implies a
 * different parent (scope / task / subtask) than the current tree, the activity is moved.
 *
 * After merge, siblings are ordered by WBS numbers in the node name (e.g. 1. before 2.,
 * 1.1 before 1.2). Task/subtask names keep the full CSV label (including "1.1 …") so ordering
 * matches Primavera.
 *
 * Scopes, tasks, and subtasks are matched to existing nodes by **WBS prefix** (numeric segments),
 * not the full title, so renames in Primavera still update the same node.
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
      const label = row.name.trim();
      let node =
        root.find((n) => n.type === "scope" && structuralMatchByWbs(n.name, label)) ?? null;
      if (node) {
        if (applyStructuralFields(node, row, label)) {
          diff.updatedStructural.push({ name: label, type: "scope" });
        }
      } else {
        node = makeStructuralNode(label, "scope", row);
        root.push(node);
        diff.addedStructural.push({ name: label, type: "scope" });
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
      const label = row.name.trim();
      let node =
        currentScope.children.find(
          (n) => n.type === "task" && structuralMatchByWbs(n.name, label)
        ) ?? null;
      if (node) {
        if (applyStructuralFields(node, row, label)) {
          diff.updatedStructural.push({ name: label, type: "task" });
        }
      } else {
        node = makeStructuralNode(label, "task", row);
        currentScope.children.push(node);
        diff.addedStructural.push({ name: label, type: "task" });
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
      const label = row.name.trim();
      let node =
        parent.children.find((n) => n.type === "subtask" && structuralMatchByWbs(n.name, label)) ??
        null;
      if (node) {
        if (applyStructuralFields(node, row, label)) {
          diff.updatedStructural.push({ name: label, type: "subtask" });
        }
      } else {
        node = makeStructuralNode(label, "subtask", row);
        parent.children.push(node);
        diff.addedStructural.push({ name: label, type: "subtask" });
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
        if (currentParent) {
          const loc = findActivityWithParent(root, row.activityId);
          if (loc && loc.parent?.id !== currentParent.id) {
            removeActivityFromParent(root, loc.parent, row.activityId);
            currentParent.children.push(existing);
            changedFields.push("parent");
          }
        }
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
            ...(changedFields.includes("parent") && currentParent
              ? { newParentName: currentParent.name }
              : {}),
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

  return { updatedTree: sortProgrammeNodesByWbs(root), diff };
}
