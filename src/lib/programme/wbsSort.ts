import type { ProgrammeNode } from "@/components/programme/types";

/**
 * Parses a leading Primavera-style WBS prefix into numeric segments for ordering.
 * - "1. GMA Scoping" → [1]
 * - "1.1 Phase 2 report" → [1, 1]
 * - "2.1.3 Detail" → [2, 1, 3]
 * Returns null when there is no recognised prefix (e.g. activities named without WBS).
 */
export function wbsSortKeyFromLabel(label: string): number[] | null {
  const t = label.trim();
  // Prefer deeper patterns first: 1.1, 2.3.4 (must be digit-dot-digit… then space)
  const deep = t.match(/^(\d+\.\d+(?:\.\d+)*)\s+/);
  if (deep) return deep[1].split(".").map((n) => parseInt(n, 10));
  // Scope-style "1. " (digit, dot, whitespace — not followed only by more dotted numbers in same token)
  const scopeStyle = t.match(/^(\d+)\.\s+/);
  if (scopeStyle) return [parseInt(scopeStyle[1], 10)];
  return null;
}

/** True when both are non-null and segment-for-segment equal. */
export function wbsKeysEqual(a: number[] | null, b: number[] | null): boolean {
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export function compareWbsKeys(a: number[] | null, b: number[] | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

/**
 * Recursively sorts sibling nodes by WBS prefix in `name`. Nodes without a WBS key
 * sort after those with one; original order is preserved among ties (stable).
 */
export function sortProgrammeNodesByWbs(nodes: ProgrammeNode[]): ProgrammeNode[] {
  const indexed = nodes.map((n, i) => ({ n, i }));
  indexed.sort((a, b) => {
    const ka = wbsSortKeyFromLabel(a.n.name);
    const kb = wbsSortKeyFromLabel(b.n.name);
    const cmp = compareWbsKeys(ka, kb);
    if (cmp !== 0) return cmp;
    return a.i - b.i;
  });
  return indexed.map(({ n }) => ({
    ...n,
    children: sortProgrammeNodesByWbs(n.children),
  }));
}
