import type { ActivityStatus, ProgrammeNode } from "@/components/programme/types";

/** Map empty / unset to Not Started when aggregating child rows. */
function normalizeForRollup(s: ActivityStatus): "Not Started" | "In Progress" | "Completed" {
  if (s === "Completed") return "Completed";
  if (s === "In Progress") return "In Progress";
  return "Not Started";
}

/**
 * Roll up child statuses for scope / task / subtask rows.
 * - All Completed → Completed
 * - All Not Started (including "") → Not Started
 * - Any other mix → In Progress
 */
export function rollupStatusesFromChildren(childStatuses: ActivityStatus[]): ActivityStatus {
  if (childStatuses.length === 0) return "";
  const normalized = childStatuses.map(normalizeForRollup);
  if (normalized.every((x) => x === "Completed")) return "Completed";
  if (normalized.every((x) => x === "Not Started")) return "Not Started";
  return "In Progress";
}

/**
 * Sets `status` on scope / task / subtask from children's effective statuses (after processing
 * children). Activities keep stored values. Parents with no children get `""`.
 */
export function rollupStatusInTree(nodes: ProgrammeNode[]): ProgrammeNode[] {
  return nodes.map(rollupNode);
}

function rollupNode(node: ProgrammeNode): ProgrammeNode {
  const children = node.children.map(rollupNode);
  const next: ProgrammeNode = { ...node, children };

  if (node.type === "activity") return next;
  if (children.length === 0) return { ...next, status: "" };

  return {
    ...next,
    status: rollupStatusesFromChildren(children.map((c) => c.status)),
  };
}
