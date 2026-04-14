/**
 * Split notes / description text into plain runs and programme activity-code spans for UI tags.
 */

import type { ProgrammeNode } from "@/components/programme/types";

import { activityCodeMatchLengthAt } from "@/lib/timesheet/timesheetImportResolve";

export type NotesActivitySegment =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string; nodeId: string };

/**
 * Collect `activityId` and node `id` for every activity in tree order, then sort by value length
 * descending so greedy matching prefers longer codes (e.g. `A38001` before `A3800`).
 */
export function buildActivityLinkTokens(programmeTree: ProgrammeNode[]): {
  value: string;
  nodeId: string;
}[] {
  const tokens: { value: string; nodeId: string }[] = [];
  const walk = (nodes: ProgrammeNode[]) => {
    for (const n of nodes) {
      if (n.type === "activity") {
        const aid = n.activityId?.trim();
        if (aid) tokens.push({ value: aid, nodeId: n.id });
        tokens.push({ value: n.id, nodeId: n.id });
      }
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(programmeTree);
  tokens.sort((a, b) => b.value.length - a.value.length);
  return tokens;
}

export function segmentNotesWithActivityCodes(
  text: string,
  tokens: { value: string; nodeId: string }[]
): NotesActivitySegment[] {
  if (!text || tokens.length === 0) {
    return text ? [{ kind: "text", text }] : [];
  }

  const out: NotesActivitySegment[] = [];
  let i = 0;
  let plainStart = 0;

  while (i < text.length) {
    let best: { nodeId: string; len: number } | null = null;
    for (const { value, nodeId } of tokens) {
      const len = activityCodeMatchLengthAt(text, i, value);
      if (len !== null && len > 0 && (!best || len > best.len)) {
        best = { nodeId, len };
      }
    }
    if (best) {
      if (plainStart < i) {
        out.push({ kind: "text", text: text.slice(plainStart, i) });
      }
      out.push({ kind: "code", text: text.slice(i, i + best.len), nodeId: best.nodeId });
      i += best.len;
      plainStart = i;
    } else {
      i += 1;
    }
  }

  if (plainStart < text.length) {
    out.push({ kind: "text", text: text.slice(plainStart) });
  }

  return out;
}
