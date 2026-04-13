import type { ProgrammeNode } from "@/components/programme/types";

/**
 * Deep-clone a programme tree with every node id prefixed — used to duplicate seed WBS
 * for another project without primary key collisions on `programme_nodes.id`.
 */
export function programmeNodesWithPrefixedIds(
  nodes: ProgrammeNode[],
  prefix: string
): ProgrammeNode[] {
  return nodes.map((n) => ({
    ...n,
    id: `${prefix}${n.id}`,
    children: programmeNodesWithPrefixedIds(n.children, prefix),
    engineers: n.engineers?.map((e) => ({ ...e })),
  }));
}
