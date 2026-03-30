import type { ProgrammeNode } from "@/components/programme/types";
import type { ProgrammeNodeDbRow } from "@/types/programme-node";
import type { ScopeEngineerDbRow, ScopeEngineerInsertRow } from "@/types/scope-engineer";

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
      total_hours: node.totalHours,
      start_date: node.start || null,
      finish_date: node.finish || null,
      forecast_total_hours: node.forecastTotalHours,
      status: node.status,
      parent_id: parentId,
      position,
    });

    if (node.type === "scope" && node.engineers?.length) {
      node.engineers.forEach((eng, i) => {
        engineerRows.push({
          scope_id: node.id,
          engineer_code: eng.code,
          is_lead: eng.isLead,
          planned_hrs: eng.plannedHrs,
          forecast_hrs: eng.forecastHrs,
          position: i,
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
      forecastTotalHours: r.forecast_total_hours !== null ? Number(r.forecast_total_hours) : null,
      status: r.status,
      children: [],
    };

    if (r.type === "scope") {
      const eng = engineerRows
        .filter((e) => e.scope_id === r.id)
        .sort((a, b) => a.position - b.position);
      node.engineers = eng.map((e) => ({
        code: e.engineer_code,
        isLead: e.is_lead,
        plannedHrs: e.planned_hrs !== null ? Number(e.planned_hrs) : null,
        forecastHrs: e.forecast_hrs !== null ? Number(e.forecast_hrs) : null,
      }));
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
  return rootRows.map((r) => attachChildren(byId.get(r.id)!));
}
