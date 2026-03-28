import { ProgrammeNode, NodeType } from "./types";

export type AddOptions = { label: string; type: NodeType }[];

export function getAddOptions(nodeType: NodeType): AddOptions {
  if (nodeType === "scope")   return [{ label: "Add Task", type: "task" }, { label: "Add Activity", type: "activity" }];
  if (nodeType === "task")    return [{ label: "Add Subtask", type: "subtask" }, { label: "Add Activity", type: "activity" }];
  if (nodeType === "subtask") return [{ label: "Add Activity", type: "activity" }];
  return [];
}

export function updateNodeInTree(
  nodes: ProgrammeNode[],
  nodeId: string,
  field: keyof ProgrammeNode,
  value: ProgrammeNode[keyof ProgrammeNode],
): ProgrammeNode[] {
  return nodes.map(n => {
    if (n.id === nodeId) return { ...n, [field]: value };
    return { ...n, children: updateNodeInTree(n.children, nodeId, field, value) };
  });
}

export function addNodeToTree(
  nodes: ProgrammeNode[],
  parentId: string,
  newNode: ProgrammeNode,
): ProgrammeNode[] {
  return nodes.map(n => {
    if (n.id === parentId) return { ...n, children: [...n.children, newNode] };
    return { ...n, children: addNodeToTree(n.children, parentId, newNode) };
  });
}

export function deleteNodeFromTree(nodes: ProgrammeNode[], nodeId: string): ProgrammeNode[] {
  return nodes
    .filter(n => n.id !== nodeId)
    .map(n => ({ ...n, children: deleteNodeFromTree(n.children, nodeId) }));
}
