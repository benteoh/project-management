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

/**
 * Sets `totalHours` on parent scope/tasks/subtasks to the sum of children's `totalHours` (after
 * processing children). Activities and leaf task/subtask keep stored values.
 */
export function rollupTotalHoursInTree(nodes: ProgrammeNode[]): ProgrammeNode[] {
  return nodes.map(rollupNode);
}

function rollupNode(node: ProgrammeNode): ProgrammeNode {
  const children = rollupTotalHoursInTree(node.children);
  const next: ProgrammeNode = { ...node, children };
  if (isRollupTotalHoursParent(next)) {
    const sum = children.reduce((s, c) => s + (c.totalHours ?? 0), 0);
    return { ...next, totalHours: Math.round(sum * 100) / 100 };
  }
  return next;
}
