"use client";

import { useCallback } from "react";
import type { ProgrammeNode } from "./types";
import { cloneNodesWithNewIds, findNodeInTree, nodesToTsv } from "./treeUtils";

const INTERNAL_MIME = "application/x-programme-nodes";

/**
 * Copy/paste for the programme table.
 *
 * Copy (Ctrl+C):  writes TSV to the system clipboard (Excel-compatible) and
 *                 stashes structured JSON on the ClipboardItem for internal paste.
 * Paste (Ctrl+V): reads the stashed JSON and inserts cloned rows after the last
 *                 selected node (as siblings). Falls back to a no-op if no
 *                 internal data is found (external clipboard isn't parsed).
 */
export function useProgrammeClipboard(
  tree: ProgrammeNode[],
  selectedIds: Set<string>,
  onCommit: (next: ProgrammeNode[]) => void
) {
  const copy = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const nodes = [...selectedIds]
      .map((id) => findNodeInTree(tree, id))
      .filter((n): n is ProgrammeNode => n !== null);
    if (nodes.length === 0) return;

    const tsv = nodesToTsv(nodes);
    const json = JSON.stringify(nodes);

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([tsv], { type: "text/plain" }),
          [INTERNAL_MIME]: new Blob([json], { type: INTERNAL_MIME }),
        }),
      ]);
    } catch {
      // Some browsers (Firefox) don't support custom MIME types on ClipboardItem —
      // fall back to plain TSV only.
      await navigator.clipboard.writeText(tsv);
    }
  }, [tree, selectedIds]);

  const paste = useCallback(async () => {
    let nodes: ProgrammeNode[] | null = null;

    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes(INTERNAL_MIME)) {
          const blob = await item.getType(INTERNAL_MIME);
          nodes = JSON.parse(await blob.text()) as ProgrammeNode[];
          break;
        }
      }
    } catch {
      // Clipboard read failed (permissions) — silently skip
      return;
    }

    if (!nodes || nodes.length === 0) return;

    const cloned = cloneNodesWithNewIds(nodes);

    // Insert after last selected node at its parent level, or append to root
    const lastId = [...selectedIds].at(-1);
    if (!lastId) {
      onCommit([...tree, ...cloned]);
      return;
    }

    const insertAfter = (list: ProgrammeNode[], afterId: string): ProgrammeNode[] | null => {
      const idx = list.findIndex((n) => n.id === afterId);
      if (idx !== -1) {
        const next = [...list];
        next.splice(idx + 1, 0, ...cloned);
        return next;
      }
      let changed = false;
      const result = list.map((n) => {
        const newChildren = insertAfter(n.children, afterId);
        if (newChildren) {
          changed = true;
          return { ...n, children: newChildren };
        }
        return n;
      });
      return changed ? result : null;
    };

    const next = insertAfter(tree, lastId) ?? [...tree, ...cloned];
    onCommit(next);
  }, [tree, selectedIds, onCommit]);

  return { copy, paste };
}
