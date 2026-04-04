import { ProgrammeNode, NodeType } from "./types";

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

export function findNodeInTree(nodes: ProgrammeNode[], nodeId: string): ProgrammeNode | null {
  for (const n of nodes) {
    if (n.id === nodeId) return n;
    const found = findNodeInTree(n.children, nodeId);
    if (found) return found;
  }
  return null;
}
