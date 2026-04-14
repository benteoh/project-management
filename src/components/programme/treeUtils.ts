import { ProgrammeNode, NodeType, FlatNode } from "./types";

/** Leading "12." from scope titles like "12. NR Boiler Room". */
export function getScopeNumberFromName(scopeName: string): string {
  const m = scopeName.match(/^(\d+)\./);
  return m ? m[1] : "";
}

/**
 * Returns the scope name with the leading index prefix removed for display.
 *
 * "12. NR Boiler Room"  →  "NR Boiler Room"   (index only — strip)
 * "+17mOD impact study" →  "+17mOD impact study"  (number is part of title — keep)
 *
 * Rule: strip only when the name starts with one or more digits followed by
 * ". " (period + space). Numbers embedded elsewhere in the title are preserved.
 */
export function getScopeDisplayName(scopeName: string): string {
  return scopeName.replace(/^\d+\.\s*/, "");
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

export function deleteNodesFromTree(nodes: ProgrammeNode[], nodeIds: Set<string>): ProgrammeNode[] {
  return nodes
    .filter((n) => !nodeIds.has(n.id))
    .map((n) => ({ ...n, children: deleteNodesFromTree(n.children, nodeIds) }));
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
 * Move `dragId` next to `targetId` (before or after), even across parent boundaries.
 * Extracts the drag node from wherever it lives, then splices it adjacent to the target.
 */
export function reorderSiblings(
  nodes: ProgrammeNode[],
  dragId: string,
  targetId: string,
  position: "before" | "after"
): ProgrammeNode[] {
  const dragNode = findNodeInTree(nodes, dragId);
  if (!dragNode) return nodes;
  const withoutDrag = deleteNodeFromTree(nodes, dragId);
  return insertAdjacentToNode(withoutDrag, dragNode, targetId, position) ?? withoutDrag;
}

function insertAdjacentToNode(
  nodes: ProgrammeNode[],
  insert: ProgrammeNode,
  targetId: string,
  position: "before" | "after"
): ProgrammeNode[] | null {
  const targetIdx = nodes.findIndex((n) => n.id === targetId);
  if (targetIdx !== -1) {
    const next = [...nodes];
    const offset = position === "after" ? 1 : 0;
    next.splice(targetIdx + offset, 0, insert);
    return next;
  }
  let changed = false;
  const result = nodes.map((n) => {
    const newChildren = insertAdjacentToNode(n.children, insert, targetId, position);
    if (newChildren) {
      changed = true;
      return { ...n, children: newChildren };
    }
    return n;
  });
  return changed ? result : null;
}

/**
 * Insert `newNodes` immediately after `afterId` at whatever level it lives.
 * Falls back to appending at root if `afterId` is not found.
 */
export function insertNodesAfter(
  nodes: ProgrammeNode[],
  afterId: string,
  newNodes: ProgrammeNode[]
): ProgrammeNode[] {
  const result = insertNodesAfterInList(nodes, afterId, newNodes);
  return result ?? [...nodes, ...newNodes];
}

function insertNodesAfterInList(
  nodes: ProgrammeNode[],
  afterId: string,
  newNodes: ProgrammeNode[]
): ProgrammeNode[] | null {
  const idx = nodes.findIndex((n) => n.id === afterId);
  if (idx !== -1) {
    const next = [...nodes];
    next.splice(idx + 1, 0, ...newNodes);
    return next;
  }
  let changed = false;
  const result = nodes.map((n) => {
    const newChildren = insertNodesAfterInList(n.children, afterId, newNodes);
    if (newChildren) {
      changed = true;
      return { ...n, children: newChildren };
    }
    return n;
  });
  return changed ? result : null;
}

/** Deep-clone a node tree assigning fresh IDs throughout. */
export function cloneNodesWithNewIds(nodes: ProgrammeNode[]): ProgrammeNode[] {
  return nodes.map((n) => ({
    ...n,
    id: crypto.randomUUID(),
    children: cloneNodesWithNewIds(n.children),
  }));
}
