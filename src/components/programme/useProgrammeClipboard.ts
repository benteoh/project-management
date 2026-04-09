"use client";

import { useCallback, useRef, useState } from "react";
import type { ProgrammeNode } from "./types";
import { cloneNodesWithNewIds, findNodeInTree, insertNodesAfter } from "./treeUtils";
import type { ForecastHoursByScopeRecord } from "@/types/forecast-scope";
import type { EngineerPoolEntry } from "@/types/engineer-pool";

import { PROGRAMME_COLUMNS, type ProgrammeTsvHelpers } from "./programmeColumns";

function nodesToTsv(nodes: ProgrammeNode[], helpers: ProgrammeTsvHelpers): string {
  const exportCols = PROGRAMME_COLUMNS.filter((c) => c.tsvValue != null);
  const header = exportCols.map((c) => c.key).join("\t");
  const rows = nodes.map((n) => exportCols.map((c) => c.tsvValue!(n, helpers)).join("\t"));
  return [header, ...rows].join("\n");
}

/**
 * Copy/paste for the programme table.
 *
 * Copy (Ctrl+C):  stashes nodes in memory (works in all browsers) and also
 *                 writes TSV to the system clipboard for Excel compat.
 * Paste (Ctrl+V): inserts cloned nodes after `insertAfterId` if given,
 *                 otherwise after the last selected node, otherwise appends to root.
 */
export function useProgrammeClipboard(
  tree: ProgrammeNode[],
  selectedIds: Set<string>,
  onCommit: (next: ProgrammeNode[]) => void,
  tsvHelpers: {
    forecastHoursByScope: ForecastHoursByScopeRecord;
    engineerPool: EngineerPoolEntry[];
  }
) {
  const stashRef = useRef<ProgrammeNode[] | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [hasStash, setHasStash] = useState(false);

  const copy = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const nodes = [...selectedIds]
      .map((id) => findNodeInTree(tree, id))
      .filter((n): n is ProgrammeNode => n !== null);
    if (nodes.length === 0) return;

    stashRef.current = nodes;
    setHasStash(true);

    // Flash copied rows for 800ms
    setCopiedIds(new Set(selectedIds));
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setCopiedIds(new Set()), 800);

    try {
      await navigator.clipboard.writeText(nodesToTsv(nodes, tsvHelpers));
    } catch {
      // Clipboard write denied — in-memory stash still works for internal paste
    }
  }, [tree, selectedIds, tsvHelpers]);

  const paste = useCallback(
    (insertAfterId?: string) => {
      const nodes = stashRef.current;
      if (!nodes || nodes.length === 0) return;

      const cloned = cloneNodesWithNewIds(nodes);
      const anchorId = insertAfterId ?? [...selectedIds].at(-1);

      onCommit(anchorId ? insertNodesAfter(tree, anchorId, cloned) : [...tree, ...cloned]);
    },
    [tree, selectedIds, onCommit]
  );

  return { copy, paste, copiedIds, hasStash };
}
