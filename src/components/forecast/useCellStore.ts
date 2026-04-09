"use client";

import { useCallback, useEffect, useRef } from "react";
import type { IRowNode } from "ag-grid-community";

import type { CellValues, RowData } from "./forecastGridTypes";

// Persistent cell value store — survives rowData recomputes caused by filter changes.
// Keyed by rowId → field → value. Every mutation must go through setCellValue.
// rowData useMemo reads from cellValuesRef to restore values after recompute.
export function useCellStore(onCommit?: () => void) {
  const cellValuesRef = useRef<CellValues>({});
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  // Stable (useCallback with [] deps) — safe to capture in useEffect([], []) closures.
  const setCellValue = useCallback((node: IRowNode<RowData>, field: string, value: unknown) => {
    node.setDataValue(field, value);
    if (!node.id) return;
    if (!cellValuesRef.current[node.id]) cellValuesRef.current[node.id] = {};
    if (value == null) {
      delete cellValuesRef.current[node.id][field];
    } else {
      cellValuesRef.current[node.id][field] = value;
    }
    onCommitRef.current?.();
  }, []);

  return { cellValuesRef, setCellValue };
}
