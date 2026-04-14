import type { ProgrammeNode } from "@/components/programme/types";
import {
  buildActivityScopeNameMap,
  collectActivityNodesUnderScopeId,
} from "@/lib/programme/programmeTree";

import type { TimesheetAllocationRow } from "@/types/allocations";
import type { ForecastHoursByScopeRecord } from "@/types/forecast-scope";

export const ENGINEER_KEY_UNKNOWN = "__unknown_engineer__";

export function engineerKeyFromRow(engineerId: string | null): string {
  return engineerId ?? ENGINEER_KEY_UNKNOWN;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildScopeNameMap(tree: ProgrammeNode[]): Map<string, string> {
  const m = new Map<string, string>();
  const walk = (nodes: ProgrammeNode[]) => {
    for (const n of nodes) {
      if (n.type === "scope") m.set(n.id, n.name);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(tree);
  return m;
}

export function buildActivityLabelMap(tree: ProgrammeNode[]): Map<string, string> {
  const m = new Map<string, string>();
  const walk = (nodes: ProgrammeNode[]) => {
    for (const n of nodes) {
      if (n.type === "activity") {
        const code = n.activityId?.trim();
        const label = code ? `${code} — ${n.name}` : n.name;
        m.set(n.id, label);
        // Timesheet rows sometimes store `activity_id` as the human code (e.g. A1235) instead of the node UUID.
        if (code) {
          if (!m.has(code)) m.set(code, label);
          const lc = code.toLowerCase();
          if (!m.has(lc)) m.set(lc, label);
        }
      }
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(tree);
  return m;
}

/** Resolve display label from `timesheet_entries.activity_id` whether it is a node id or an activity code. */
export function lookupActivityLabel(
  activityNodeIdOrCode: string | null,
  activityLabelMap: Map<string, string>
): string {
  if (!activityNodeIdOrCode) return "No activity linked";
  const direct = activityLabelMap.get(activityNodeIdOrCode);
  if (direct) return direct;
  return activityLabelMap.get(activityNodeIdOrCode.toLowerCase()) ?? "Activity not in programme";
}

/** Whether a timesheet `activity_id` cell refers to this programme activity (node id or activity code). */
export function timesheetActivityIdMatchesProgrammeNode(
  rowActivityId: string | null,
  node: ProgrammeNode
): boolean {
  if (rowActivityId === null) return false;
  if (rowActivityId === node.id) return true;
  const code = node.activityId?.trim();
  if (!code) return false;
  return rowActivityId.trim().toLowerCase() === code.toLowerCase();
}

/**
 * Normalise timesheet activity key to the programme activity node id when it matches a node under
 * the row's scope; otherwise keep the raw value (unknown code or other scope).
 */
export function canonicalActivityKeyForRow(
  row: TimesheetAllocationRow,
  programmeTree: ProgrammeNode[]
): string | null {
  if (row.activityNodeId == null || row.activityNodeId === "") return null;
  if (!row.scopeId) return row.activityNodeId;
  const activities = collectActivityNodesUnderScopeId(programmeTree, row.scopeId);
  for (const node of activities) {
    if (timesheetActivityIdMatchesProgrammeNode(row.activityNodeId, node)) return node.id;
  }
  return row.activityNodeId;
}

export interface NamedHoursRow {
  id: string | null;
  label: string;
  hours: number;
  /** Second line for native tooltips (e.g. parent scope). */
  subtitle?: string;
}

export interface EngineerProjectRollup {
  engineerKey: string;
  engineerId: string | null;
  totalHours: number;
  /** Hours on rows missing engineer or scope (activity may still be set). */
  unmappedHours: number;
  byScope: NamedHoursRow[];
  byActivity: NamedHoursRow[];
}

function scopeLabel(scopeId: string | null, scopeNameMap: Map<string, string>): string {
  if (!scopeId) return "Unmapped scope";
  return scopeNameMap.get(scopeId) ?? "Scope not in programme";
}

function sumMap(map: Map<string | null, number>): number {
  let t = 0;
  for (const v of map.values()) t += v;
  return round1(t);
}

function mapToNamedRows(
  map: Map<string | null, number>,
  labelFor: (id: string | null) => string
): NamedHoursRow[] {
  const rows: NamedHoursRow[] = [];
  for (const [id, hours] of map.entries()) {
    rows.push({ id, label: labelFor(id), hours: round1(hours) });
  }
  rows.sort((a, b) => b.hours - a.hours);
  return rows;
}

function scopeNameForActivityKey(
  activityKey: string | null,
  activityScopeNameMap: Map<string, string>
): string | undefined {
  if (activityKey == null) return undefined;
  return (
    activityScopeNameMap.get(activityKey) ??
    activityScopeNameMap.get(activityKey.toLowerCase()) ??
    undefined
  );
}

export function rollupsForProjectView(
  rows: TimesheetAllocationRow[],
  scopeNameMap: Map<string, string>,
  activityLabelMap: Map<string, string>,
  programmeTree: ProgrammeNode[]
): EngineerProjectRollup[] {
  const activityScopeNameMap = buildActivityScopeNameMap(programmeTree);
  const byEngineer = new Map<string, TimesheetAllocationRow[]>();
  for (const r of rows) {
    const k = engineerKeyFromRow(r.engineerId);
    const list = byEngineer.get(k) ?? [];
    list.push(r);
    byEngineer.set(k, list);
  }

  const out: EngineerProjectRollup[] = [];
  for (const [key, list] of byEngineer.entries()) {
    const engineerId = key === ENGINEER_KEY_UNKNOWN ? null : key;
    let unmapped = 0;
    const scopeAgg = new Map<string | null, number>();
    const activityAgg = new Map<string | null, number>();

    for (const r of list) {
      if (!r.engineerId || !r.scopeId) {
        unmapped += r.hours;
      }
      const sk = r.scopeId;
      scopeAgg.set(sk, (scopeAgg.get(sk) ?? 0) + r.hours);
      const ak = canonicalActivityKeyForRow(r, programmeTree);
      activityAgg.set(ak, (activityAgg.get(ak) ?? 0) + r.hours);
    }

    const byActivity = mapToNamedRows(activityAgg, (id) =>
      lookupActivityLabel(id, activityLabelMap)
    ).map((r) => {
      const scopeName = scopeNameForActivityKey(r.id, activityScopeNameMap);
      return scopeName ? { ...r, subtitle: `Scope: ${scopeName}` } : r;
    });

    out.push({
      engineerKey: key,
      engineerId,
      totalHours: round1(sumMap(scopeAgg)),
      unmappedHours: round1(unmapped),
      byScope: mapToNamedRows(scopeAgg, (id) => scopeLabel(id, scopeNameMap)),
      byActivity,
    });
  }

  out.sort((a, b) => b.totalHours - a.totalHours);
  return out;
}

export interface ScopeEngineerAllocationRow {
  engineerId: string | null;
  label: string;
  /** Timesheet actuals for this scope. */
  actualHours: number;
  /** Sum of demand forecast hours on this scope (`forecast_entries`); null if no forecast for that engineer on this scope. */
  forecastHours: number | null;
}

export interface ScopeViewRollup {
  scopeLabel: string;
  totalHours: number;
  byActivity: NamedHoursRow[];
  byEngineer: ScopeEngineerAllocationRow[];
}

export function rollupForScopeView(
  rows: TimesheetAllocationRow[],
  scopeId: string,
  scopeNameMap: Map<string, string>,
  activityLabelMap: Map<string, string>,
  engineerLabel: (engineerId: string | null) => string,
  programmeTree: ProgrammeNode[],
  forecastHoursByScope: ForecastHoursByScopeRecord
): ScopeViewRollup {
  const filtered = rows.filter((r) => r.scopeId === scopeId);
  const activityAgg = new Map<string | null, number>();
  const engineerAgg = new Map<string | null, number>();
  for (const r of filtered) {
    const ak = canonicalActivityKeyForRow(r, programmeTree);
    activityAgg.set(ak, (activityAgg.get(ak) ?? 0) + r.hours);
    engineerAgg.set(r.engineerId, (engineerAgg.get(r.engineerId) ?? 0) + r.hours);
  }

  const forecastByEngineerId = new Map<string, number>();
  for (const { engineerId, hours } of forecastHoursByScope[scopeId] ?? []) {
    const h = Number(hours);
    if (Number.isNaN(h)) continue;
    forecastByEngineerId.set(engineerId, round1(h));
  }

  const engineerKeys = new Set<string | null>();
  for (const k of engineerAgg.keys()) engineerKeys.add(k);
  for (const eid of forecastByEngineerId.keys()) engineerKeys.add(eid);

  const byEngineer: ScopeEngineerAllocationRow[] = [...engineerKeys].map((eid) => ({
    engineerId: eid,
    label: engineerLabel(eid),
    actualHours: round1(engineerAgg.get(eid) ?? 0),
    forecastHours:
      eid != null && forecastByEngineerId.has(eid) ? (forecastByEngineerId.get(eid) ?? null) : null,
  }));

  byEngineer.sort((a, b) => {
    if (b.actualHours !== a.actualHours) return b.actualHours - a.actualHours;
    const fb = b.forecastHours ?? 0;
    const fa = a.forecastHours ?? 0;
    if (fb !== fa) return fb - fa;
    return a.label.localeCompare(b.label);
  });

  const scopeTitle = scopeNameMap.get(scopeId) ?? "Scope not in programme";
  const byActivity = mapToNamedRows(activityAgg, (id) =>
    lookupActivityLabel(id, activityLabelMap)
  ).map((r) => (r.id != null ? { ...r, subtitle: `Scope: ${scopeTitle}` } : r));

  return {
    scopeLabel: scopeTitle,
    totalHours: round1(sumMap(engineerAgg)),
    byActivity,
    byEngineer,
  };
}

export interface ActivityViewRollup {
  activityLabel: string;
  /** Timesheet hours on this scope for the selected activity (or unmapped). */
  spentHours: number;
  /**
   * Programme scoped hours (`programme_nodes.total_hours`) for this activity.
   * Null for “no activity linked” or when the node has no budget set.
   */
  plannedActivityHours: number | null;
  byEngineer: NamedHoursRow[];
}

export type ActivityViewSelection =
  | { mode: "unmapped" }
  | { mode: "node"; node: ProgrammeNode }
  | { mode: "rawId"; id: string };

export function rollupForActivityView(
  rows: TimesheetAllocationRow[],
  scopeId: string,
  selection: ActivityViewSelection,
  activityDisplayLabel: string,
  engineerLabel: (engineerId: string | null) => string
): ActivityViewRollup {
  const filtered = rows.filter((r) => {
    if (r.scopeId !== scopeId) return false;
    if (selection.mode === "unmapped") return r.activityNodeId === null;
    if (selection.mode === "rawId") return r.activityNodeId === selection.id;
    return timesheetActivityIdMatchesProgrammeNode(r.activityNodeId, selection.node);
  });
  const engineerAgg = new Map<string | null, number>();
  for (const r of filtered) {
    engineerAgg.set(r.engineerId, (engineerAgg.get(r.engineerId) ?? 0) + r.hours);
  }

  const spentHours = round1(sumMap(engineerAgg));
  let plannedActivityHours: number | null = null;
  if (selection.mode === "node") {
    const th = selection.node.totalHours;
    plannedActivityHours = th != null ? round1(th) : null;
  }

  return {
    activityLabel: activityDisplayLabel,
    spentHours,
    plannedActivityHours,
    byEngineer: mapToNamedRows(engineerAgg, engineerLabel),
  };
}
