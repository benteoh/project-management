import type { ProgrammeNode } from "@/components/programme/types";

/**
 * Scope / task / subtask rows that have children do not store their own total — DB uses 0;
 * display is the sum of children's hours (funnels up to scope).
 */
export function isRollupTotalHoursParent(node: ProgrammeNode): boolean {
  return (
    (node.type === "scope" || node.type === "task" || node.type === "subtask") &&
    node.children.length > 0
  );
}

/** Minimal shape for bottom-up hour rollups (seed tree or live {@link ProgrammeNode}). */
export type TotalHoursRollupNode = {
  type: string;
  totalHours?: number | null;
  children: TotalHoursRollupNode[];
};

/**
 * Sets `totalHours` on parent scope/tasks/subtasks to the sum of children's `totalHours` (after
 * processing children). Activities and leaf task/subtask keep stored values.
 */
export function rollupTotalHoursForSeedNodes<T extends TotalHoursRollupNode>(nodes: T[]): T[] {
  return nodes.map(function roll(n: T): T {
    const children = rollupTotalHoursForSeedNodes(n.children as T[]) as T[];
    const next = { ...n, children };
    if ((n.type === "scope" || n.type === "task" || n.type === "subtask") && children.length > 0) {
      const sum = children.reduce((s, c) => s + (c.totalHours ?? 0), 0);
      return { ...next, totalHours: Math.round(sum * 100) / 100 };
    }
    return next;
  });
}

export function rollupTotalHoursInTree(nodes: ProgrammeNode[]): ProgrammeNode[] {
  return rollupTotalHoursForSeedNodes(nodes);
}
