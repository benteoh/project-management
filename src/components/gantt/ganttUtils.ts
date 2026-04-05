import {
  parseProgrammeDate,
  formatProgrammeDate,
  MONTH_NAMES,
} from "@/components/programme/dateUtils";
import type { ProgrammeNode } from "@/components/programme/types";

export const DAY_WIDTH = 20; // px per day (default zoom level — one week ≈ 140px)
export const ROW_H = 33; // px — must match programme table row height
export const NAME_COL_W = 280; // px — left name column

export interface GanttRow {
  node: ProgrammeNode;
  depth: number;
}

/** Flatten visible tree into ordered rows, respecting collapse state. */
export function flattenGanttRows(
  nodes: ProgrammeNode[],
  collapsed: Set<string>,
  depth = 0,
  out: GanttRow[] = []
): GanttRow[] {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children.length > 0 && !collapsed.has(node.id)) {
      flattenGanttRows(node.children, collapsed, depth + 1, out);
    }
  }
  return out;
}

function collectAllDates(nodes: ProgrammeNode[]): string[] {
  return nodes.flatMap((n) => [n.start, n.finish, ...collectAllDates(n.children)]);
}

/**
 * Compute timeline start/end from all activities in the tree.
 * Pads by 2 weeks on each side; falls back to current month if no dates found.
 */
export function getTimelineRange(nodes: ProgrammeNode[]): { start: Date; end: Date } {
  const allDates = collectAllDates(nodes);
  const parsedDates = allDates.flatMap((d) => {
    const parsed = parseProgrammeDate(d);
    return parsed ? [parsed] : [];
  });

  const pad = 14; // days
  const now = new Date();
  const start =
    parsedDates.length > 0
      ? new Date(Math.min(...parsedDates.map((d) => d.getTime())) - pad * 86_400_000)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const end =
    parsedDates.length > 0
      ? new Date(Math.max(...parsedDates.map((d) => d.getTime())) + pad * 86_400_000)
      : new Date(now.getFullYear(), now.getMonth() + 3, 0);

  // Snap to Monday / Sunday for clean week boundaries
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  end.setDate(end.getDate() + ((7 - end.getDay()) % 7));

  return { start, end };
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function dateToX(date: Date, timelineStart: Date, dayWidth = DAY_WIDTH): number {
  return daysBetween(timelineStart, date) * dayWidth;
}

export function xToDate(x: number, timelineStart: Date, dayWidth = DAY_WIDTH): Date {
  const days = Math.round(x / dayWidth);
  return new Date(timelineStart.getTime() + days * 86_400_000);
}

export { formatProgrammeDate, parseProgrammeDate };

/**
 * Compute the effective date range for any node.
 * - Activity: uses staged dates if available, otherwise node dates.
 * - Parent nodes (scope/task/subtask): rolls up min-start / max-finish from all descendants.
 */
export function computeRollupDates(
  node: ProgrammeNode,
  staged: Record<string, { start: string; finish: string }>
): { start: Date | null; end: Date | null } {
  if (node.type === "activity") {
    const s = staged[node.id]?.start ?? node.start;
    const f = staged[node.id]?.finish ?? node.finish;
    return { start: parseProgrammeDate(s), end: parseProgrammeDate(f) };
  }
  let min: Date | null = null;
  let max: Date | null = null;
  for (const child of node.children) {
    const { start, end } = computeRollupDates(child, staged);
    if (start && (!min || start < min)) min = start;
    if (end && (!max || end > max)) max = end;
  }
  return { start: min, end: max };
}

/** Build month header segments for the ruler. */
export interface MonthSegment {
  label: string;
  x: number;
  width: number;
}

export function buildMonthSegments(start: Date, end: Date, dayWidth = DAY_WIDTH): MonthSegment[] {
  const segments: MonthSegment[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const segStart = cursor < start ? start : cursor;
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const segEnd = nextMonth > end ? end : nextMonth;

    segments.push({
      label: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`,
      x: dateToX(segStart, start, dayWidth),
      width: daysBetween(segStart, segEnd) * dayWidth,
    });

    cursor = nextMonth;
  }
  return segments;
}

/** Build week tick marks (Monday of each week). */
export interface WeekTick {
  x: number;
  label: string; // day number
}

export function buildWeekTicks(start: Date, end: Date, dayWidth = DAY_WIDTH): WeekTick[] {
  const ticks: WeekTick[] = [];
  const cursor = new Date(start);
  // advance to first Monday
  cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7));

  while (cursor <= end) {
    ticks.push({
      x: dateToX(cursor, start, dayWidth),
      label: `${cursor.getDate()} ${MONTH_NAMES[cursor.getMonth()]}`,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return ticks;
}
