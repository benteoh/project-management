import { ProgrammeNode, NodeType, FlatNode } from "./types";

/** Leading "12." from scope titles like "12. NR Boiler Room". */
export function getScopeNumberFromName(scopeName: string): string {
  const m = scopeName.match(/^(\d+)\./);
  return m ? m[1] : "";
}

export type AddOptions = { label: string; type: NodeType }[];

export function getAddOptions(nodeType: NodeType): AddOptions {
  if (nodeType === "scope")
    return [
      { label: "Add Task", type: "task" },
      { label: "Add Activity", type: "activity" },
    ];
  if (nodeType === "task")
    return [
      { label: "Add Subtask", type: "subtask" },
      { label: "Add Activity", type: "activity" },
    ];
  if (nodeType === "subtask") return [{ label: "Add Activity", type: "activity" }];
  return [];
}

export function updateNodeInTree(
  nodes: ProgrammeNode[],
  nodeId: string,
  field: keyof ProgrammeNode,
  value: ProgrammeNode[keyof ProgrammeNode]
): ProgrammeNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, [field]: value };
    return { ...n, children: updateNodeInTree(n.children, nodeId, field, value) };
  });
}

export function addNodeToTree(
  nodes: ProgrammeNode[],
  parentId: string,
  newNode: ProgrammeNode
): ProgrammeNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, newNode] };
    return { ...n, children: addNodeToTree(n.children, parentId, newNode) };
  });
}

/** Append a new root-level scope (programme tree roots are scopes). */
export function addScopeToRoot(nodes: ProgrammeNode[], newNode: ProgrammeNode): ProgrammeNode[] {
  return [...nodes, newNode];
}

export function deleteNodeFromTree(nodes: ProgrammeNode[], nodeId: string): ProgrammeNode[] {
  return nodes
    .filter((n) => n.id !== nodeId)
    .map((n) => ({ ...n, children: deleteNodeFromTree(n.children, nodeId) }));
}

export function findNodeInTree(nodes: ProgrammeNode[], nodeId: string): ProgrammeNode | null {
  for (const n of nodes) {
    if (n.id === nodeId) return n;
    const found = findNodeInTree(n.children, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Returns all visible nodes in render order (respects collapse state).
 * Used to compute ranges for shift-click / drag-to-select.
 */
export function flattenVisibleNodes(
  nodes: ProgrammeNode[],
  collapsed: Set<string>,
  parentId: string | null = null,
  depth = 0,
  out: FlatNode[] = []
): FlatNode[] {
  for (const node of nodes) {
    out.push({ node, depth, parentId });
    if (node.children.length > 0 && !collapsed.has(node.id)) {
      flattenVisibleNodes(node.children, collapsed, node.id, depth + 1, out);
    }
  }
  return out;
}

/**
 * Move `dragId` to be a sibling of `targetId`, inserting before or after it.
 * Only works when drag and target share the same parent. Returns tree unchanged if not.
 */
export function reorderSiblings(
  nodes: ProgrammeNode[],
  dragId: string,
  targetId: string,
  position: "before" | "after"
): ProgrammeNode[] {
  return reorderInSubtree(nodes, dragId, targetId, position) ?? nodes;
}

function reorderInSubtree(
  nodes: ProgrammeNode[],
  dragId: string,
  targetId: string,
  position: "before" | "after"
): ProgrammeNode[] | null {
  const dragIdx = nodes.findIndex((n) => n.id === dragId);
  const targetIdx = nodes.findIndex((n) => n.id === targetId);

  // Both are siblings at this level — reorder here
  if (dragIdx !== -1 && targetIdx !== -1) {
    const next = nodes.filter((n) => n.id !== dragId);
    const insertAt = next.findIndex((n) => n.id === targetId);
    const offset = position === "after" ? 1 : 0;
    next.splice(insertAt + offset, 0, nodes[dragIdx]);
    return next;
  }

  // Recurse into children
  let changed = false;
  const result = nodes.map((n) => {
    const newChildren = reorderInSubtree(n.children, dragId, targetId, position);
    if (newChildren) {
      changed = true;
      return { ...n, children: newChildren };
    }
    return n;
  });
  return changed ? result : null;
}

/**
 * Serialise a set of nodes to TSV rows (spreadsheet-compatible clipboard format).
 * Columns: Name, Activity ID, Total Hours, Start, Finish, Forecast Hours, Status
 */
export function nodesToTsv(nodes: ProgrammeNode[]): string {
  const header = [
    "Name",
    "Activity ID",
    "Total Hours",
    "Start",
    "Finish",
    "Forecast Hours",
    "Status",
  ].join("\t");
  const rows = nodes.map((n) =>
    [
      n.name,
      n.activityId ?? "",
      n.totalHours ?? "",
      n.start,
      n.finish,
      n.forecastTotalHours ?? "",
      n.status,
    ].join("\t")
  );
  return [header, ...rows].join("\n");
}

/** Deep-clone a node tree assigning fresh IDs throughout. */
export function cloneNodesWithNewIds(nodes: ProgrammeNode[]): ProgrammeNode[] {
  return nodes.map((n) => ({
    ...n,
    id: crypto.randomUUID(),
    children: cloneNodesWithNewIds(n.children),
  }));
}
