import type { ProgrammeNode } from "@/components/programme/types";
import type { Project } from "@/types/project";

import type { ExportColumn, ExportSheet } from "./exportBuilder";

// ---------------------------------------------------------------------------
// Flat row type — one row per WBS node
// ---------------------------------------------------------------------------

type ProgrammeFlatRow = {
  level: string;
  type: string;
  activityId: string;
  name: string;
  totalHours: number | null;
  forecastTotalHours: number | null;
  start: string;
  finish: string;
  status: string;
};

// ---------------------------------------------------------------------------
// Tree flattening — no scope engineer data included
// ---------------------------------------------------------------------------

function flattenNodes(nodes: ProgrammeNode[], prefix: string): ProgrammeFlatRow[] {
  const rows: ProgrammeFlatRow[] = [];
  nodes.forEach((node, i) => {
    const level = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
    rows.push({
      level,
      type: node.type,
      activityId: node.activityId ?? "",
      name: node.name,
      totalHours: node.totalHours,
      forecastTotalHours: node.forecastTotalHours,
      start: node.start,
      finish: node.finish,
      status: node.status,
    });
    if (node.children.length > 0) {
      rows.push(...flattenNodes(node.children, level));
    }
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const PROGRAMME_COLUMNS: ExportColumn<ProgrammeFlatRow>[] = [
  { header: "Level", width: 10, getValue: (r) => r.level },
  { header: "Type", width: 12, getValue: (r) => r.type },
  { header: "Activity ID", width: 14, getValue: (r) => r.activityId },
  { header: "Name", width: 50, getValue: (r) => r.name },
  { header: "Total Hours", width: 14, getValue: (r) => r.totalHours },
  { header: "Forecast Hours", width: 16, getValue: (r) => r.forecastTotalHours },
  { header: "Start Date", width: 14, getValue: (r) => r.start },
  { header: "End Date", width: 14, getValue: (r) => r.finish },
  { header: "Status", width: 18, getValue: (r) => r.status },
];

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function getProgrammeSheet(
  tree: ProgrammeNode[],
  project: Project
): ExportSheet<ProgrammeFlatRow> {
  const fixedFeeFormatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(project.fixedFee);

  return {
    title: `${project.name}  ·  ${project.client}  ·  Fixed Fee: ${fixedFeeFormatted}`,
    columns: PROGRAMME_COLUMNS,
    rows: flattenNodes(tree, ""),
    isHighlighted: (row) => row.type === "scope",
  };
}
