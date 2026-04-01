import type { ActivityStatus, ProgrammeNode } from "./types";
import { parseFlexibleActivityDate } from "./dateUtils";

export type ActivitySort =
  | "none"
  | "totalAsc"
  | "totalDesc"
  | "startAsc"
  | "startDesc"
  | "finishAsc"
  | "finishDesc";
export type ActivityStatusValue = Exclude<ActivityStatus, "">;

export type ActivityQueryState = {
  statuses: Set<ActivityStatusValue> | null;
  sort: ActivitySort;
};

export type ActivityQueryItem = {
  id: string;
  status: ActivityStatus;
  totalHours: number;
  start: string;
  finish: string;
};

export const DEFAULT_ACTIVITY_QUERY: ActivityQueryState = {
  statuses: null,
  sort: "none",
};

type ActivityQueryColumnDefinition = {
  id: "status";
  passes: (item: ActivityQueryItem, query: ActivityQueryState) => boolean;
};

const QUERY_COLUMNS: ActivityQueryColumnDefinition[] = [
  {
    id: "status",
    passes: (item, query) =>
      !query.statuses || query.statuses.has(item.status as ActivityStatusValue),
  },
];

function finishTimeValue(value: string): number {
  const parsed = parseFlexibleActivityDate(value);
  if (!parsed) return Number.POSITIVE_INFINITY;
  return parsed.getTime();
}

function startTimeValue(value: string): number {
  const parsed = parseFlexibleActivityDate(value);
  if (!parsed) return Number.POSITIVE_INFINITY;
  return parsed.getTime();
}

export function isActivityQueryActive(query: ActivityQueryState): boolean {
  return query.statuses !== null || query.sort !== "none";
}

export function collectActivityQueryItems(tree: ProgrammeNode[]): ActivityQueryItem[] {
  const items: ActivityQueryItem[] = [];

  const walk = (nodes: ProgrammeNode[]) => {
    nodes.forEach((node) => {
      if (node.type === "activity") {
        items.push({
          id: node.id,
          status: node.status,
          totalHours: node.totalHours ?? 0,
          start: node.start,
          finish: node.finish,
        });
      }
      if (node.children.length > 0) walk(node.children);
    });
  };

  walk(tree);
  return items;
}

export function applyActivityQuery(
  items: ActivityQueryItem[],
  query: ActivityQueryState,
  baseIds: ReadonlySet<string> | null
): string[] {
  const filtered = items.filter((item) => {
    if (baseIds && !baseIds.has(item.id)) return false;
    return QUERY_COLUMNS.every((column) => column.passes(item, query));
  });

  if (query.sort === "finishAsc") {
    filtered.sort((a, b) => finishTimeValue(a.finish) - finishTimeValue(b.finish));
  } else if (query.sort === "finishDesc") {
    filtered.sort((a, b) => finishTimeValue(b.finish) - finishTimeValue(a.finish));
  } else if (query.sort === "totalAsc") {
    filtered.sort((a, b) => a.totalHours - b.totalHours);
  } else if (query.sort === "totalDesc") {
    filtered.sort((a, b) => b.totalHours - a.totalHours);
  } else if (query.sort === "startAsc") {
    filtered.sort((a, b) => startTimeValue(a.start) - startTimeValue(b.start));
  } else if (query.sort === "startDesc") {
    filtered.sort((a, b) => startTimeValue(b.start) - startTimeValue(a.start));
  }

  return filtered.map((item) => item.id);
}
