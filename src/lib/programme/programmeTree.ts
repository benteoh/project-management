import type { ProgrammeNode } from "@/components/programme/types";
import type { ProgrammeNodeDbRow } from "@/types/programme-node";
import type { ScopeEngineerDbRow, ScopeEngineerInsertRow } from "@/types/scope-engineer";

import { applyProgrammeRollups } from "./applyProgrammeRollups";
import { isRollupTotalHoursParent } from "./totalHoursRollup";

export function flattenTree(
  nodes: ProgrammeNode[],
  projectId: string,
  parentId: string | null = null
): { nodeRows: ProgrammeNodeDbRow[]; engineerRows: ScopeEngineerInsertRow[] } {
  const nodeRows: ProgrammeNodeDbRow[] = [];
  const engineerRows: ScopeEngineerInsertRow[] = [];

  nodes.forEach((node, position) => {
    nodeRows.push({
      id: node.id,
      project_id: projectId,
      activity_id: node.activityId ?? null,
      name: node.name,
      type: node.type,
      total_hours: isRollupTotalHoursParent(node) ? 0 : node.totalHours,
      start_date: node.start || null,
      finish_date: node.finish || null,
      status: node.type === "activity" ? node.status : "",
      parent_id: parentId,
      position,
      quoted_amount: node.type === "scope" ? (node.quotedAmount ?? null) : null,
      quotation_warning_amount:
        node.type === "scope" ? (node.quotationWarningAmount ?? null) : null,
    });

    if (node.type === "scope" && node.engineers?.length) {
      node.engineers.forEach((eng, i) => {
        engineerRows.push({
          scope_id: node.id,
          engineer_id: eng.engineerId,
          is_lead: eng.isLead,
          planned_hrs: eng.plannedHrs,
          weekly_limit_hrs: eng.weeklyScopeLimitHrs ?? null,
          position: i,
          rate: eng.rate,
        });
      });
    }

    if (node.children.length > 0) {
      const nested = flattenTree(node.children, projectId, node.id);
      nodeRows.push(...nested.nodeRows);
      engineerRows.push(...nested.engineerRows);
    }
  });

  return { nodeRows, engineerRows };
}

export function collectScopeIds(nodes: ProgrammeNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: ProgrammeNode[]) => {
    for (const n of list) {
      if (n.type === "scope") ids.push(n.id);
      walk(n.children);
    }
  };
  walk(nodes);
  return ids;
}

export function collectScopeNames(nodes: ProgrammeNode[]): string[] {
  const names: string[] = [];
  const walk = (list: ProgrammeNode[]) => {
    for (const n of list) {
      if (n.type === "scope") names.push(n.name);
      walk(n.children);
    }
  };
  walk(nodes);
  return names;
}

/** Find any programme node by id (depth-first). */
export function findProgrammeNodeById(nodes: ProgrammeNode[], id: string): ProgrammeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const d = findProgrammeNodeById(n.children, id);
    if (d) return d;
  }
  return null;
}

/** Activity nodes nested under a scope (recursive under `scope.children`). */
export function collectActivityNodesUnderScopeId(
  roots: ProgrammeNode[],
  scopeId: string
): ProgrammeNode[] {
  const scope = findProgrammeNodeById(roots, scopeId);
  if (!scope || scope.type !== "scope") return [];
  const out: ProgrammeNode[] = [];
  const walk = (list: ProgrammeNode[]) => {
    for (const n of list) {
      if (n.type === "activity") out.push(n);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(scope.children);
  return out;
}

/**
 * Map activity node id and activity code (incl. lowercase) to the **name** of the containing scope.
 */
export function buildActivityScopeNameMap(roots: ProgrammeNode[]): Map<string, string> {
  const m = new Map<string, string>();
  const registerUnderScope = (scopeName: string, list: ProgrammeNode[]) => {
    const walk = (nodes: ProgrammeNode[]) => {
      for (const n of nodes) {
        if (n.type === "activity") {
          m.set(n.id, scopeName);
          const code = n.activityId?.trim();
          if (code) {
            m.set(code, scopeName);
            m.set(code.toLowerCase(), scopeName);
          }
        }
        if (n.children.length > 0) walk(n.children);
      }
    };
    walk(list);
  };
  const walkRoots = (nodes: ProgrammeNode[]) => {
    for (const n of nodes) {
      if (n.type === "scope") registerUnderScope(n.name, n.children);
      if (n.children.length > 0) walkRoots(n.children);
    }
  };
  walkRoots(roots);
  return m;
}

/** All scope nodes in the tree as `{ id, name }` pairs, in tree order. */
export function collectScopeNodes(nodes: ProgrammeNode[]): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = [];
  const walk = (list: ProgrammeNode[]) => {
    for (const n of list) {
      if (n.type === "scope") result.push({ id: n.id, name: n.name });
      walk(n.children);
    }
  };
  walk(nodes);
  return result;
}

export function buildTreeFromRows(
  rows: ProgrammeNodeDbRow[],
  engineerRows: ScopeEngineerDbRow[]
): ProgrammeNode[] {
  const byId = new Map<string, ProgrammeNode>();

  for (const r of rows) {
    const node: ProgrammeNode = {
      id: r.id,
      activityId: r.activity_id ?? undefined,
      name: r.name,
      type: r.type,
      totalHours: r.total_hours !== null ? Number(r.total_hours) : null,
      start: r.start_date ?? "",
      finish: r.finish_date ?? "",
      status: r.status,
      children: [],
    };

    if (r.type === "scope") {
      const eng = engineerRows
        .filter((e) => e.scope_id === r.id)
        .sort((a, b) => a.position - b.position);
      node.engineers = eng.map((e) => {
        const rawWeekly =
          e.weekly_limit_hrs ??
          (e as ScopeEngineerDbRow & { weekly_scope_limit_hrs?: number | null })
            .weekly_scope_limit_hrs;
        return {
          engineerId: e.engineer_id,
          isLead: e.is_lead,
          plannedHrs: e.planned_hrs !== null ? Number(e.planned_hrs) : null,
          weeklyScopeLimitHrs:
            rawWeekly !== null && rawWeekly !== undefined ? Number(rawWeekly) : null,
          rate: e.rate,
        };
      });
      node.quotedAmount =
        r.quoted_amount !== null && r.quoted_amount !== undefined ? Number(r.quoted_amount) : null;
      node.quotationWarningAmount =
        r.quotation_warning_amount !== null && r.quotation_warning_amount !== undefined
          ? Number(r.quotation_warning_amount)
          : null;
    }

    byId.set(r.id, node);
  }

  const childrenByParent = new Map<string | null, ProgrammeNodeDbRow[]>();
  for (const r of rows) {
    const p = r.parent_id;
    if (!childrenByParent.has(p)) childrenByParent.set(p, []);
    childrenByParent.get(p)!.push(r);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  function attachChildren(node: ProgrammeNode): ProgrammeNode {
    const kids = childrenByParent.get(node.id) ?? [];
    return {
      ...node,
      children: kids.map((k) => attachChildren(byId.get(k.id)!)),
    };
  }

  const rootRows = childrenByParent.get(null) ?? [];
  rootRows.sort((a, b) => a.position - b.position);
  return applyProgrammeRollups(rootRows.map((r) => attachChildren(byId.get(r.id)!)));
}
