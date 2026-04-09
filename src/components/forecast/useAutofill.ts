"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgGridReact } from "ag-grid-react";
import type { IRowNode } from "ag-grid-community";

import { normSel } from "./forecastCellUtils";
import { autofill } from "./forecastAutofillUtils";
import type { HistoryEntry, PendingFill, RowData, SelRange } from "./forecastGridTypes";
import type { ForecastGridRow } from "./types";

type Params = {
  rows: ForecastGridRow[];
  dateColFields: string[];
  selRef: React.RefObject<SelRange | null>;
  gridRef: React.RefObject<AgGridReact<RowData> | null>;
  cellValuesRef: React.MutableRefObject<Record<string, Record<string, unknown>>>;
  bankHolidays: Set<string>;
  setCellValue: (node: IRowNode<RowData>, field: string, value: unknown) => void;
  pushHistory: (entry: HistoryEntry) => void;
};

export type UseAutofillResult = {
  pendingFill: PendingFill | null;
  pendingFillRef: React.RefObject<PendingFill | null>;
  pendingValuesRef: React.MutableRefObject<Record<string, Record<string, unknown>>>;
  triggerAutofill: (mode: "all" | "selection") => void;
  addPendingChange: (rowId: string, field: string, oldValue: unknown, newValue: unknown) => void;
  approveFill: () => void;
  discardFill: () => void;
  restorePreview: (fill: PendingFill) => void;
  isPreviewActive: boolean;
  handleHistoryApplied: (entry: HistoryEntry, direction: "undo" | "redo") => void;
};

export function useAutofill({
  rows,
  dateColFields,
  selRef,
  gridRef,
  cellValuesRef,
  bankHolidays,
  setCellValue,
  pushHistory,
}: Params): UseAutofillResult {
  const [pendingFill, setPendingFill] = useState<PendingFill | null>(null);
  const pendingValuesRef = useRef<Record<string, Record<string, unknown>>>({});

  // Maps approved HistoryEntry objects (by reference) to their PendingFill snapshot.
  // Lets handleHistoryApplied restore preview mode when an approved fill is undone.
  const autofillEntryMap = useRef(new Map<HistoryEntry, PendingFill>());

  const triggerAutofill = useCallback(
    (mode: "all" | "selection") => {
      let targetRowIds: Set<string> | undefined;
      let targetCells: Set<string> | undefined;

      if (mode === "selection") {
        const sel = selRef.current;
        if (!sel) return;
        const api = gridRef.current?.api;
        if (!api) return;

        const n = normSel(sel);
        targetRowIds = new Set<string>();
        targetCells = new Set<string>();

        for (let ri = n.r1; ri <= n.r2; ri++) {
          const node = api.getDisplayedRowAtIndex(ri);
          if (!node?.id) continue;
          targetRowIds.add(node.id);
          for (let ci = n.c1; ci <= n.c2; ci++) {
            const field = dateColFields[ci];
            if (field) targetCells.add(`${node.id}:${field}`);
          }
        }

        if (targetRowIds.size === 0 || targetCells.size === 0) return;
      }

      // Merge pending values into committed so the algorithm skips already-queued cells.
      // This enables chaining multiple selections without accepting first.
      const mergedValues: Record<string, Record<string, unknown>> = {};
      for (const [rowId, vals] of Object.entries(cellValuesRef.current)) {
        mergedValues[rowId] = { ...vals };
      }
      for (const [rowId, vals] of Object.entries(pendingValuesRef.current)) {
        mergedValues[rowId] = { ...(mergedValues[rowId] ?? {}), ...vals };
      }

      const result = autofill({
        rows,
        dateColFields,
        currentValues: mergedValues,
        bankHolidays,
        targetRowIds,
        targetCells,
      });

      if (result.changes.length === 0) return;

      // Write new changes into pendingValuesRef (preserving existing pending cells)
      for (const change of result.changes) {
        if (!pendingValuesRef.current[change.rowId]) {
          pendingValuesRef.current[change.rowId] = {};
        }
        pendingValuesRef.current[change.rowId][change.field] = change.newValue;
      }

      // Merge into state — keep existing pending changes, overwrite cells touched by new run
      setPendingFill((prev) => {
        const existingChanges = prev?.changes ?? [];
        const newMap = new Map(result.changes.map((c) => [`${c.rowId}:${c.field}`, c]));
        const merged = [
          ...existingChanges.filter((c) => !newMap.has(`${c.rowId}:${c.field}`)),
          ...result.changes,
        ];
        return {
          changes: merged,
          warnings: result.warnings,
          budgetWarnings: result.budgetWarnings,
        };
      });

      gridRef.current?.api.refreshCells({ force: true });
    },
    [rows, dateColFields, selRef, gridRef, cellValuesRef, bankHolidays]
  );

  const approveFill = useCallback(() => {
    const fill = pendingFill;
    if (!fill || fill.changes.length === 0) {
      pendingValuesRef.current = {};
      setPendingFill(null);
      return;
    }

    const api = gridRef.current?.api;
    if (!api) return;

    // Build flat entry with authoritative oldValues from cellValuesRef (pre-commit state)
    const flatEntry: HistoryEntry = fill.changes.map((c) => ({
      rowId: c.rowId,
      field: c.field,
      oldValue: cellValuesRef.current[c.rowId]?.[c.field] ?? null,
      newValue: c.newValue,
    }));

    for (const change of flatEntry) {
      const node = api.getRowNode(change.rowId);
      if (!node) continue;
      setCellValue(node, change.field, change.newValue);
    }

    // Tag the entry so handleHistoryApplied can restore preview on undo
    autofillEntryMap.current.set(flatEntry, fill);
    pushHistory(flatEntry);

    pendingValuesRef.current = {};
    setPendingFill(null);
    api.refreshCells({ force: true });
  }, [pendingFill, gridRef, cellValuesRef, setCellValue, pushHistory]);

  const discardFill = useCallback(() => {
    pendingValuesRef.current = {};
    setPendingFill(null);
    gridRef.current?.api.refreshCells({ force: true });
  }, [gridRef]);

  // Restores a previously discarded fill back into preview (used by redo after undo-discard)
  const restorePreview = useCallback(
    (fill: PendingFill) => {
      pendingValuesRef.current = {};
      for (const c of fill.changes) {
        if (!pendingValuesRef.current[c.rowId]) pendingValuesRef.current[c.rowId] = {};
        pendingValuesRef.current[c.rowId][c.field] = c.newValue;
      }
      setPendingFill(fill);
      gridRef.current?.api.refreshCells({ force: true });
    },
    [gridRef]
  );

  // Always-current ref so stable keyboard closures can read pendingFill without stale closure issues
  const pendingFillRef = useRef<PendingFill | null>(null);
  useEffect(() => {
    pendingFillRef.current = pendingFill;
  });

  // Route manual edits into the pending store during preview
  const addPendingChange = useCallback(
    (rowId: string, field: string, oldValue: unknown, newValue: unknown) => {
      const change = { rowId, field, oldValue, newValue };
      setPendingFill((prev) => {
        if (!prev) return prev;
        const filtered = prev.changes.filter((c) => !(c.rowId === rowId && c.field === field));
        const updated = newValue != null ? [...filtered, change] : filtered;
        return { ...prev, changes: updated };
      });
      if (!pendingValuesRef.current[rowId]) pendingValuesRef.current[rowId] = {};
      if (newValue != null) {
        pendingValuesRef.current[rowId][field] = newValue;
      } else {
        delete pendingValuesRef.current[rowId][field];
      }
    },
    []
  );

  /**
   * Called by useGridHistory after every undo/redo.
   *
   * For a regular edit entry:  just bumps rowData revision (caller handles via onHistoryApplied).
   * For an approved autofill entry:
   *   - undo → restore preview mode (cells already reverted by applyHistory; pending values
   *            overlay them so the user sees the fill ghosted and can discard or re-accept).
   *   - redo → clear preview (cells already re-applied by applyHistory).
   */
  const handleHistoryApplied = useCallback(
    (entry: HistoryEntry, direction: "undo" | "redo") => {
      const savedFill = autofillEntryMap.current.get(entry);
      if (!savedFill) return; // regular edit — nothing extra to do

      // Both undo and redo restore preview mode.
      // - undo: applyHistory reverted cells to oldValues; pending overlay shows what was filled.
      // - redo: applyHistory re-applied newValues to cells; we revert them back to oldValues
      //         so the pending overlay is the only thing showing the fill (consistent preview UX).
      //         The user then presses Ctrl+Z (= discard) or Ctrl+Y (= approveFill) to decide.
      if (direction === "redo") {
        // Revert cells that applyHistory just wrote, so pending is the sole source of truth
        const api = gridRef.current?.api;
        if (api) {
          for (const c of savedFill.changes) {
            const node = api.getRowNode(c.rowId);
            if (node) setCellValue(node, c.field, c.oldValue);
          }
        }
      }

      pendingValuesRef.current = {};
      for (const c of savedFill.changes) {
        if (!pendingValuesRef.current[c.rowId]) pendingValuesRef.current[c.rowId] = {};
        pendingValuesRef.current[c.rowId][c.field] = c.newValue;
      }
      setPendingFill(savedFill);
    },
    // gridRef is a stable ref object; setCellValue is stable from useCellStore
    [gridRef, setCellValue]
  );

  return {
    pendingFill,
    pendingFillRef,
    pendingValuesRef,
    triggerAutofill,
    addPendingChange,
    approveFill,
    discardFill,
    restorePreview,
    isPreviewActive: pendingFill !== null,
    handleHistoryApplied,
  };
}
