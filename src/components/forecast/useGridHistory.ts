"use client";

import { useCallback, useRef } from "react";
import type { AgGridReact } from "ag-grid-react";
import type { IRowNode } from "ag-grid-community";

import { MAX_HISTORY } from "./forecastGridConstants";
import type { RowData, HistoryEntry } from "./forecastGridTypes";

type Params = {
  gridRef: React.RefObject<AgGridReact<RowData> | null>;
  setCellValue: (node: IRowNode<RowData>, field: string, value: unknown) => void;
  /** Called after each undo/redo with the entry and direction. */
  onHistoryApplied?: (entry: HistoryEntry, direction: "undo" | "redo") => void;
};

export function useGridHistory({ gridRef, setCellValue, onHistoryApplied }: Params) {
  // Stable ref so applyHistory (empty deps) can always call the latest callback
  const onHistoryAppliedRef = useRef(onHistoryApplied);
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);

  // Set by onCellEditingStarted (user-initiated edits only — never fires for setDataValue).
  // onCellValueChanged checks this ref to distinguish user edits from programmatic changes.
  const editingOldValueRef = useRef<{
    rowId: string;
    field: string;
    value: unknown;
  } | null>(null);

  // Keep ref in sync so applyHistory always calls the latest version
  onHistoryAppliedRef.current = onHistoryApplied;

  // Stable — only touches refs. Safe to capture in useEffect([], []) closures.
  const pushHistory = useCallback((entry: HistoryEntry) => {
    if (entry.length === 0) return;
    let stack = historyRef.current.slice(0, historyIndexRef.current + 1);
    stack.push(entry);
    if (stack.length > MAX_HISTORY) stack = stack.slice(stack.length - MAX_HISTORY);
    historyRef.current = stack;
    historyIndexRef.current = stack.length - 1;
  }, []);

  // Internal — applies a single entry in one direction. Not exported.
  const applyHistory = useCallback(
    (entry: HistoryEntry, direction: "undo" | "redo") => {
      const api = gridRef.current?.api;
      if (!api) return;
      for (const change of entry) {
        const node = api.getRowNode(change.rowId);
        if (!node) continue;
        setCellValue(node, change.field, direction === "undo" ? change.oldValue : change.newValue);
      }
      // Notify before refreshCells so rowData recomputes first
      onHistoryAppliedRef.current?.(entry, direction);
      api.refreshCells({ force: true });
    },
    // gridRef is a stable ref object; setCellValue is stable from useCellStore
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx < 0) return;
    applyHistory(historyRef.current[idx], "undo");
    historyIndexRef.current--;
  }, [applyHistory]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    applyHistory(historyRef.current[historyIndexRef.current], "redo");
  }, [applyHistory]);

  /** True if there is at least one entry ahead of the current pointer. */
  const canRedo = useCallback(() => {
    return historyIndexRef.current < historyRef.current.length - 1;
  }, []);

  /**
   * Advance the history pointer without applying the entry.
   *
   * Used by the autofill keyboard handler when it manually commits pending cells
   * and the autofill entry already exists in history (restored by undo). Calling
   * redo() would apply the entry a second time on top of the manual commit.
   */
  const advanceRedoIndex = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
  }, []);

  return { editingOldValueRef, pushHistory, undo, redo, canRedo, advanceRedoIndex };
}
