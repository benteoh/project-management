"use client";

import { useCallback, useRef, useState } from "react";
import type { FlatNode } from "./types";

export interface RowSelectionApi {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  clearSelection: () => void;
  onRowMouseDown: (id: string, e: React.MouseEvent) => void;
  onRowMouseEnter: (id: string) => void;
  onMouseUp: () => void;
  anchorId: string | null;
}

/**
 * Manages spreadsheet-style row selection:
 *  - Click: select single row
 *  - Shift+click: extend range from anchor
 *  - Ctrl/Cmd+click: toggle individual row
 *  - Mousedown + mousemove across rows: rubber-band range select
 */
export function useRowSelection(getFlatNodes: () => FlatNode[]): RowSelectionApi {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const isDragSelecting = useRef(false);

  const getRange = useCallback(
    (fromId: string, toId: string): string[] => {
      const flat = getFlatNodes();
      const fromIdx = flat.findIndex((f) => f.node.id === fromId);
      const toIdx = flat.findIndex((f) => f.node.id === toId);
      if (fromIdx === -1 || toIdx === -1) return [toId];
      const [lo, hi] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      return flat.slice(lo, hi + 1).map((f) => f.node.id);
    },
    [getFlatNodes]
  );

  const onRowMouseDown = useCallback(
    (id: string, e: React.MouseEvent) => {
      // Don't steal focus from inputs / buttons inside the row
      if ((e.target as HTMLElement).closest("input, select, button, a")) return;
      e.preventDefault();

      if (e.shiftKey && anchorId) {
        // Extend range from anchor to this row
        setSelectedIds(new Set(getRange(anchorId, id)));
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle individual row, keep anchor
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        setAnchorId(id);
      } else {
        // Single select — start drag selection
        setSelectedIds(new Set([id]));
        setAnchorId(id);
        isDragSelecting.current = true;
      }
    },
    [anchorId, getRange]
  );

  const onRowMouseEnter = useCallback(
    (id: string) => {
      if (!isDragSelecting.current || !anchorId) return;
      setSelectedIds(new Set(getRange(anchorId, id)));
    },
    [anchorId, getRange]
  );

  const onMouseUp = useCallback(() => {
    isDragSelecting.current = false;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setAnchorId(null);
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    isSelected,
    clearSelection,
    onRowMouseDown,
    onRowMouseEnter,
    onMouseUp,
    anchorId,
  };
}
