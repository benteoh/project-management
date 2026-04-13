import type { ProgrammeNode } from "@/components/programme/types";
import type { ForecastHoursByScopeRecord } from "@/types/forecast-scope";

import type { TimesheetActualEntry } from "./timesheetActualsDb";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface EngineerActualsRow {
  engineerId: string;
  actualHours: number;
  /** null when no forecast data exists for the project at all */
  forecastHours: number | null;
  /** From the scope's EngineerAllocation.plannedHrs */
  plannedHrs: number | null;
}

export interface ScopeActualsRow {
  scopeId: string;
  scopeName: string;
  /** From ProgrammeNode.totalHours; null when not set */
  budgetHours: number | null;
  /** null when no forecast data exists for the project at all */
  forecastHours: number | null;
  actualHours: number;
  /** actualHours − budgetHours; null when budgetHours is null */
  delta: number | null;
  engineers: EngineerActualsRow[];
}

export interface EngineerSummaryRow {
  engineerId: string;
  actualHours: number;
  forecastHours: number | null;
  /** Sum of plannedHrs across all scope allocations */
  plannedHrs: number | null;
  scopes: { scopeId: string; scopeName: string; actualHours: number }[];
}

export interface ActualsVsPlannedSummary {
  totalBudget: number;
  /** null when no forecast data exists for the project */
  totalForecast: number | null;
  totalActuals: number;
  scopes: ScopeActualsRow[];
  engineers: EngineerSummaryRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function collectScopeNodes(nodes: ProgrammeNode[]): ProgrammeNode[] {
  const result: ProgrammeNode[] = [];
  function walk(node: ProgrammeNode) {
    if (node.type === "scope") result.push(node);
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

export function buildActualsVsPlanned(
  entries: TimesheetActualEntry[],
  programmeTree: ProgrammeNode[],
  forecastByScope: ForecastHoursByScopeRecord
): ActualsVsPlannedSummary {
  const scopes = collectScopeNodes(programmeTree);
  const hasForecast = Object.keys(forecastByScope).length > 0;

  // Accumulate actual hours: scopeId → engineerId → hours
  const actualMap = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    if (!entry.scopeId || !entry.hours || entry.hours <= 0) continue;
    if (!actualMap.has(entry.scopeId)) actualMap.set(entry.scopeId, new Map());
    const eid = entry.engineerId ?? "__unknown__";
    const em = actualMap.get(entry.scopeId)!;
    em.set(eid, (em.get(eid) ?? 0) + entry.hours);
  }

  let totalBudget = 0;
  let totalForecast: number | null = hasForecast ? 0 : null;
  let totalActuals = 0;

  const scopeRows: ScopeActualsRow[] = scopes.map((scope) => {
    const em = actualMap.get(scope.id) ?? new Map<string, number>();
    const actualHours = [...em.values()].reduce((s, h) => s + h, 0);
    const budgetHours = scope.totalHours ?? null;
    const forecastList = forecastByScope[scope.id] ?? null;
    const forecastHours =
      forecastList && forecastList.length > 0
        ? forecastList.reduce((s, f) => s + f.hours, 0)
        : hasForecast
          ? 0
          : null;

    totalBudget += budgetHours ?? 0;
    if (totalForecast !== null) totalForecast += forecastHours ?? 0;
    totalActuals += actualHours;

    // All engineer IDs that have any data for this scope
    const allEngIds = new Set<string>();
    for (const k of em.keys()) {
      if (k !== "__unknown__") allEngIds.add(k);
    }
    forecastList?.forEach((f) => allEngIds.add(f.engineerId));
    scope.engineers?.forEach((a) => allEngIds.add(a.engineerId));

    const engineers: EngineerActualsRow[] = [...allEngIds]
      .map((eid) => {
        const actual = em.get(eid) ?? 0;
        const fc = forecastList?.find((f) => f.engineerId === eid);
        const alloc = scope.engineers?.find((a) => a.engineerId === eid);
        return {
          engineerId: eid,
          actualHours: round1(actual),
          forecastHours: fc ? round1(fc.hours) : hasForecast ? 0 : null,
          plannedHrs: alloc?.plannedHrs ?? null,
        };
      })
      .filter((e) => e.actualHours > 0 || (e.forecastHours ?? 0) > 0);

    return {
      scopeId: scope.id,
      scopeName: scope.name,
      budgetHours,
      forecastHours: forecastHours !== null ? round1(forecastHours) : null,
      actualHours: round1(actualHours),
      delta: budgetHours !== null ? round1(actualHours - budgetHours) : null,
      engineers,
    };
  });

  // Build per-engineer summary (for the by-engineer toggle view)
  const engDataMap = new Map<
    string,
    {
      actualByScope: Map<string, number>;
      forecastByScope: Map<string, number>;
      plannedByScope: Map<string, number>;
    }
  >();

  for (const scope of scopeRows) {
    for (const eng of scope.engineers) {
      if (!engDataMap.has(eng.engineerId)) {
        engDataMap.set(eng.engineerId, {
          actualByScope: new Map(),
          forecastByScope: new Map(),
          plannedByScope: new Map(),
        });
      }
      const ed = engDataMap.get(eng.engineerId)!;
      if (eng.actualHours > 0) ed.actualByScope.set(scope.scopeId, eng.actualHours);
      if ((eng.forecastHours ?? 0) > 0) ed.forecastByScope.set(scope.scopeId, eng.forecastHours!);
      if ((eng.plannedHrs ?? 0) > 0) ed.plannedByScope.set(scope.scopeId, eng.plannedHrs!);
    }
  }

  const engineerRows: EngineerSummaryRow[] = [...engDataMap.entries()]
    .map(([eid, ed]) => {
      const actualHours = round1([...ed.actualByScope.values()].reduce((s, h) => s + h, 0));
      const forecastHours = hasForecast
        ? round1([...ed.forecastByScope.values()].reduce((s, h) => s + h, 0))
        : null;
      const plannedHrs =
        ed.plannedByScope.size > 0
          ? round1([...ed.plannedByScope.values()].reduce((s, h) => s + h, 0))
          : null;
      const scopes = scopeRows
        .filter((s) => (ed.actualByScope.get(s.scopeId) ?? 0) > 0)
        .map((s) => ({
          scopeId: s.scopeId,
          scopeName: s.scopeName,
          actualHours: ed.actualByScope.get(s.scopeId)!,
        }));
      return { engineerId: eid, actualHours, forecastHours, plannedHrs, scopes };
    })
    .sort((a, b) => b.actualHours - a.actualHours);

  return {
    totalBudget: round1(totalBudget),
    totalForecast: totalForecast !== null ? round1(totalForecast) : null,
    totalActuals: round1(totalActuals),
    scopes: scopeRows.filter((s) => s.actualHours > 0 || (s.budgetHours ?? 0) > 0),
    engineers: engineerRows,
  };
}
