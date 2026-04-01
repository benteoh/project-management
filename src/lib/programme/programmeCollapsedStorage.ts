import type { ProgrammeNode } from "@/components/programme/types";

function storageKey(projectId: string): string {
  return `pm:programme:collapsed:${projectId}`;
}

/** Read persisted collapse ids. Do not use during SSR render — only in client effects or event handlers (avoids hydration mismatch). */
export function readCollapsedNodeIds(projectId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(storageKey(projectId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function writeCollapsedNodeIds(projectId: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(projectId), JSON.stringify([...ids]));
  } catch {
    // quota / private mode
  }
}

export function collectProgrammeNodeIds(tree: ProgrammeNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: ProgrammeNode[]) => {
    for (const n of nodes) {
      ids.add(n.id);
      walk(n.children);
    }
  };
  walk(tree);
  return ids;
}
