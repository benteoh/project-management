import type { ProgrammeNode } from "@/components/programme/types";

/** Match trailing digits (e.g. `A3630` → prefix `A`, num `3630`). */
const SUFFIX_DIGITS = /^(.*?)(\d+)$/;

/**
 * Next activity id: same letter prefix as the highest existing numeric suffix, +10.
 * Default when none exist: `A3610`.
 */
export function nextActivityIdFromTree(tree: ProgrammeNode[]): string {
  let maxNum = -Infinity;
  let prefix = "A";

  function walk(nodes: ProgrammeNode[]) {
    for (const n of nodes) {
      if (n.type === "activity" && n.activityId?.trim()) {
        const id = n.activityId.trim();
        const m = id.match(SUFFIX_DIGITS);
        if (m) {
          const p = m[1] !== "" ? m[1] : "A";
          const num = parseInt(m[2], 10);
          if (!Number.isNaN(num) && num >= maxNum) {
            maxNum = num;
            prefix = p;
          }
        }
      }
      walk(n.children);
    }
  }

  walk(tree);
  if (maxNum === -Infinity) return "A3610";
  return `${prefix}${maxNum + 10}`;
}
