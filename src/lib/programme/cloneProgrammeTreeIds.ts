import { randomUUID } from "node:crypto";

import type { ProgrammeNode } from "@/components/programme/types";

/**
 * Deep-clone a programme tree with new UUIDs on every node (structure and engineer
 * allocations preserved; ids must not collide when copying to another project).
 */
export function cloneProgrammeTreeWithFreshIds(nodes: ProgrammeNode[]): ProgrammeNode[] {
  function cloneNode(n: ProgrammeNode): ProgrammeNode {
    return {
      ...n,
      id: randomUUID(),
      children: n.children.map(cloneNode),
      engineers: n.engineers?.map((e) => ({ ...e })),
    };
  }
  return nodes.map(cloneNode);
}
