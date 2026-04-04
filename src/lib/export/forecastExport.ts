import type { ProgrammeNode } from "@/components/programme/types";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { Project } from "@/types/project";

import type { ExportColumn, ExportSheet } from "./exportBuilder";

// ---------------------------------------------------------------------------
// Flat row type — one row per scope × engineer allocation
// ---------------------------------------------------------------------------

type ForecastFlatRow = {
  scopeName: string;
  engineerCode: string;
  engineerName: string;
  plannedHrs: number | null;
  forecastHrs: number | null;
};

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const FORECAST_COLUMNS: ExportColumn<ForecastFlatRow>[] = [
  { header: "Scope", width: 40, getValue: (r) => r.scopeName },
  { header: "Engineer Code", width: 16, getValue: (r) => r.engineerCode },
  { header: "Engineer Name", width: 24, getValue: (r) => r.engineerName },
  { header: "Planned Hours", width: 16, getValue: (r) => r.plannedHrs },
  { header: "Forecast Hours", width: 16, getValue: (r) => r.forecastHrs },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEngineerName(engineerId: string, pool: EngineerPoolEntry[]): string {
  const entry = pool.find((p) => p.id === engineerId);
  if (!entry) return engineerId;
  const full = [entry.firstName, entry.lastName].filter(Boolean).join(" ");
  return full || entry.code;
}

function resolveEngineerCode(engineerId: string, pool: EngineerPoolEntry[]): string {
  return pool.find((p) => p.id === engineerId)?.code ?? engineerId;
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function getForecastSheet(
  tree: ProgrammeNode[],
  engineerPool: EngineerPoolEntry[],
  project: Project
): ExportSheet<ForecastFlatRow> {
  const rows: ForecastFlatRow[] = [];

  for (const node of tree) {
    if (node.type !== "scope") continue;
    const allocations = node.engineers ?? [];

    if (allocations.length === 0) {
      rows.push({
        scopeName: node.name,
        engineerCode: "",
        engineerName: "",
        plannedHrs: null,
        forecastHrs: null,
      });
    } else {
      for (const alloc of allocations) {
        rows.push({
          scopeName: node.name,
          engineerCode: resolveEngineerCode(alloc.engineerId, engineerPool),
          engineerName: resolveEngineerName(alloc.engineerId, engineerPool),
          plannedHrs: alloc.plannedHrs,
          forecastHrs: alloc.forecastHrs,
        });
      }
    }
  }

  return {
    title: `DEMAND FORECAST: ${project.name}`,
    columns: FORECAST_COLUMNS,
    rows,
  };
}
