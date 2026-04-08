"use client";

import { useCallback, useRef } from "react";
import type { AgGridReact } from "ag-grid-react";
import type { IRowNode } from "ag-grid-community";

import { MAX_HISTORY } from "./forecastGridConstants";
import type { RowData, HistoryEntry } from "./forecastGridTypes";

type Params = {
  gridRef: React.RefObject<AgGridReact<RowData> | null>;
  setCellValue: (node: IRowNode<RowData>, field: string, value: unknown) => void;
};

export function useGridHistory({ gridRef, setCellValue }: Params) {
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);

  // Set by onCellEditingStarted (user-initiated edits only — never fires for setDataValue).
  // onCellValueChanged checks this ref to distinguish user edits from programmatic changes.
  const editingOldValueRef = useRef<{
    rowId: string;
    field: string;
    value: unknown;
  } | null>(null);

  // Stable — only touches refs. Safe to capture in useEffect([], []) closures.
  const pushHistory = useCallback((entry: HistoryEntry) => {
    if (entry.length === 0) return;
    let stack = historyRef.current.slice(0, historyIndexRef.current + 1);
    stack.push(entry);
    if (stack.length > MAX_HISTORY) stack = stack.slice(stack.length - MAX_HISTORY);
    historyRef.current = stack;
    historyIndexRef.current = stack.length - 1;
  }, []);

  // Stable — only touches refs and calls stable setCellValue.
  const applyHistory = useCallback(
    (entry: HistoryEntry, direction: "undo" | "redo") => {
      const api = gridRef.current?.api;
      if (!api) return;
      for (const change of entry) {
        const node = api.getRowNode(change.rowId);
        if (!node) continue;
        setCellValue(node, change.field, direction === "undo" ? change.oldValue : change.newValue);
      }
      api.refreshCells({ force: true });
    },
    // gridRef is a stable ref object; setCellValue is stable from useCellStore
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return { historyRef, historyIndexRef, editingOldValueRef, pushHistory, applyHistory };
}
