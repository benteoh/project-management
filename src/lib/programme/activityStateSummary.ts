import {
  atStartOfDay,
  parseFlexibleActivityDateStartOfDay,
} from "@/components/programme/dateUtils";
import type { ActivityStatus, ProgrammeNode } from "@/components/programme/types";

export type ActivityStateSummary = {
  upcoming: number;
  inProgress: number;
  warning: number;
  late: number;
};

export type ActivityStateRow = {
  id: string;
  code: string;
  title: string;
  parentLabel: string | null;
  hours: number | null;
  start: string;
  finish: string;
  status: ActivityStatus;
};

export type ActivityStateBuckets = {
  upcoming: ActivityStateRow[];
  inProgress: ActivityStateRow[];
  warning: ActivityStateRow[];
  late: ActivityStateRow[];
};

function dayDiff(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function isWarningWindow(
  start: Date | null,
  finish: Date | null,
  status: ActivityStatus,
  today: Date
): boolean {
  if (!start || !finish) return false;
  if (status === "Completed") return false;

  const totalDurationDays = Math.max(1, dayDiff(start, finish));
  const elapsedDays = dayDiff(start, today);
  const progress = elapsedDays / totalDurationDays;
  const daysLeft = dayDiff(today, finish);

  const atLeastNinetyPercentElapsed = elapsedDays >= 0 && progress >= 0.9;
  const oneDayOrLessRemaining = daysLeft >= 0 && daysLeft <= 1;

  return atLeastNinetyPercentElapsed || oneDayOrLessRemaining;
}

function buildParentLabel(ancestors: ProgrammeNode[]): string | null {
  if (ancestors.length === 0) return null;
  return ancestors[ancestors.length - 1].name;
}

export function buildActivityStateSummary(tree: ProgrammeNode[]): ActivityStateSummary {
  const buckets = buildActivityStateBuckets(tree);
  return {
    upcoming: buckets.upcoming.length,
    inProgress: buckets.inProgress.length,
    warning: buckets.warning.length,
    late: buckets.late.length,
  };
}

export function buildActivityStateBuckets(tree: ProgrammeNode[]): ActivityStateBuckets {
  const today = atStartOfDay(new Date());
  const buckets: ActivityStateBuckets = {
    upcoming: [],
    inProgress: [],
    warning: [],
    late: [],
  };

  const walk = (nodes: ProgrammeNode[], ancestors: ProgrammeNode[]) => {
    nodes.forEach((node) => {
      if (node.type === "activity") {
        const start = parseFlexibleActivityDateStartOfDay(node.start);
        const finish = parseFlexibleActivityDateStartOfDay(node.finish);
        const status = node.status;
        const row: ActivityStateRow = {
          id: node.id,
          code: node.activityId ?? node.id,
          title: node.name,
          parentLabel: buildParentLabel(ancestors),
          hours: node.totalHours,
          start: node.start,
          finish: node.finish,
          status,
        };

        if (status === "Not Started" && start) {
          const daysUntilStart = dayDiff(today, start);
          if (daysUntilStart >= 0 && daysUntilStart <= 5) {
            buckets.upcoming.push(row);
          }
        }

        if (status === "In Progress") {
          buckets.inProgress.push(row);
        }

        const isLate =
          finish !== null &&
          finish < today &&
          (status === "Not Started" || status === "In Progress");

        if (!isLate && isWarningWindow(start, finish, status, today)) {
          buckets.warning.push(row);
        }

        if (isLate) {
          buckets.late.push(row);
        }
      }

      if (node.children.length > 0) walk(node.children, [...ancestors, node]);
    });
  };

  walk(tree, []);
  return {
    upcoming: buckets.upcoming.sort((a, b) => a.start.localeCompare(b.start)),
    inProgress: buckets.inProgress.sort((a, b) => a.finish.localeCompare(b.finish)),
    warning: buckets.warning.sort((a, b) => a.finish.localeCompare(b.finish)),
    late: buckets.late.sort((a, b) => a.finish.localeCompare(b.finish)),
  };
}
