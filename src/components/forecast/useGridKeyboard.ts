"use client";

import { useEffect } from "react";
import type { AgGridReact } from "ag-grid-react";
import type { IRowNode } from "ag-grid-community";

import { normSel, displayValue, cellNumeric, detectFillPattern } from "./forecastCellUtils";
import type { RowData, SelRange, HistoryEntry } from "./forecastGridTypes";

type Params = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  gridRef: React.RefObject<AgGridReact<RowData> | null>;
  selRef: React.MutableRefObject<SelRange | null>;
  dateColFieldsRef: React.MutableRefObject<string[]>;
  historyRef: React.MutableRefObject<HistoryEntry[]>;
  historyIndexRef: React.MutableRefObject<number>;
  setCellValue: (node: IRowNode<RowData>, field: string, value: unknown) => void;
  pushHistory: (entry: HistoryEntry) => void;
  applyHistory: (entry: HistoryEntry, direction: "undo" | "redo") => void;
};

/** Cmd (macOS) or Ctrl (Windows/Linux) — spreadsheet-style shortcuts */
function primaryMod(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

/** Redo: Ctrl+Y (Windows) or Ctrl/Cmd+Shift+Z (common on macOS and elsewhere) */
function redoShortcut(e: KeyboardEvent): boolean {
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k === "y") return true;
  if (primaryMod(e) && e.shiftKey && k === "z") return true;
  return false;
}

// Registers keydown (capture phase) and paste listeners on the grid container.
// All params are stable refs/callbacks — safe inside a single useEffect([], []).
export function useGridKeyboard({
  containerRef,
  gridRef,
  selRef,
  dateColFieldsRef,
  historyRef,
  historyIndexRef,
  setCellValue,
  pushHistory,
  applyHistory,
}: Params): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const api = gridRef.current?.api;
      if (!api) return;
      // Never intercept keys while a cell is actively being edited
      if (api.getEditingCells().length > 0) return;

      // Cmd/Ctrl+C — copy selection as TSV
      if (primaryMod(e) && e.key.toLowerCase() === "c") {
        const sel = selRef.current;
        if (!sel) return;
        e.preventDefault();
        e.stopPropagation();
        const n = normSel(sel);
        const lines: string[] = [];
        for (let ri = n.r1; ri <= n.r2; ri++) {
          const node = api.getDisplayedRowAtIndex(ri);
          if (!node) continue;
          const cols = dateColFieldsRef.current.slice(n.c1, n.c2 + 1);
          lines.push(cols.map((field) => displayValue(node.data?.[field])).join("\t"));
        }
        navigator.clipboard.writeText(lines.join("\n")).catch(() => {
          /* clipboard may be blocked */
        });
        return;
      }

      // Cmd/Ctrl+Z — undo (ignore Shift+Z so redo can use it)
      if (primaryMod(e) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const idx = historyIndexRef.current;
        if (idx < 0) return;
        applyHistory(historyRef.current[idx], "undo");
        historyIndexRef.current--;
        return;
      }

      // Ctrl+Y or Cmd/Ctrl+Shift+Z — redo
      if (redoShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current++;
        applyHistory(historyRef.current[historyIndexRef.current], "redo");
        return;
      }

      // Cmd/Ctrl+D — fill first row of selection down into all other selected rows
      if (primaryMod(e) && e.key.toLowerCase() === "d") {
        const sel = selRef.current;
        if (!sel) return;
        e.preventDefault();
        const n = normSel(sel);
        if (n.r1 === n.r2) return;
        const sourceNode = api.getDisplayedRowAtIndex(n.r1);
        if (!sourceNode) return;
        const fields = dateColFieldsRef.current.slice(n.c1, n.c2 + 1);
        const entry: HistoryEntry = [];
        for (const field of fields) {
          const newValue = sourceNode.data?.[field] ?? null;
          for (let ri = n.r1 + 1; ri <= n.r2; ri++) {
            const targetNode = api.getDisplayedRowAtIndex(ri);
            if (!targetNode?.id) continue;
            const oldValue = targetNode.data?.[field] ?? null;
            entry.push({ rowId: targetNode.id, field, oldValue, newValue });
            setCellValue(targetNode, field, newValue);
          }
        }
        pushHistory(entry);
        api.refreshCells({ force: true });
        return;
      }

      // Cmd/Ctrl+R — detect fill pattern in first column, fill remaining columns right
      if (primaryMod(e) && e.key.toLowerCase() === "r") {
        const sel = selRef.current;
        if (!sel) return;
        e.preventDefault();
        const n = normSel(sel);
        if (n.c1 === n.c2) return;
        const entry: HistoryEntry = [];
        for (let ri = n.r1; ri <= n.r2; ri++) {
          const node = api.getDisplayedRowAtIndex(ri);
          if (!node?.id) continue;
          const sourceVals: (number | null)[] = [];
          for (let ci = n.c1; ci < n.c2; ci++) {
            const v = node.data?.[dateColFieldsRef.current[ci]];
            sourceVals.push(v != null ? cellNumeric(v) : null);
          }
          const fill = detectFillPattern(sourceVals);
          const field = dateColFieldsRef.current[n.c2];
          const oldValue = node.data?.[field] ?? null;
          const newValue = fill(0);
          if (newValue === null) continue;
          entry.push({ rowId: node.id, field, oldValue, newValue });
          setCellValue(node, field, newValue);
        }
        pushHistory(entry);
        api.refreshCells({ force: true });
        return;
      }

      // Delete / Backspace — clear selection (only when not editing, guarded above)
      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = selRef.current;
        if (!sel) return;
        const n = normSel(sel);
        const entry: HistoryEntry = [];
        for (let ri = n.r1; ri <= n.r2; ri++) {
          const node = api.getDisplayedRowAtIndex(ri);
          if (!node?.id) continue;
          for (let ci = n.c1; ci <= n.c2; ci++) {
            const field = dateColFieldsRef.current[ci];
            const oldValue = node.data?.[field];
            if (oldValue != null && oldValue !== "") {
              entry.push({ rowId: node.id, field, oldValue, newValue: null });
            }
            setCellValue(node, field, null);
          }
        }
        pushHistory(entry);
        api.refreshCells({ force: true });
      }
    };

    // Paste — multi-cell TSV anchored to top-left of current selection
    const onPaste = (e: ClipboardEvent) => {
      const api = gridRef.current?.api;
      if (!api) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text) return;

      const clipRows = text.split(/\r?\n/).map((r) => r.split("\t"));
      // Drop trailing empty row Excel sometimes appends
      while (clipRows.length > 0 && clipRows[clipRows.length - 1].every((c) => !c.trim()))
        clipRows.pop();
      if (clipRows.length === 0) return;

      const sel = selRef.current;
      let startRow: number;
      let startCol: number;

      if (sel) {
        const n = normSel(sel);
        startRow = n.r1;
        startCol = n.c1;
      } else {
        const focused = api.getFocusedCell();
        if (!focused) return;
        startRow = focused.rowIndex;
        startCol = dateColFieldsRef.current.indexOf(focused.column.getColId());
        if (startCol === -1) return;
      }

      const pasteEntry: HistoryEntry = [];
      clipRows.forEach((clipRow, ri) => {
        const node = api.getDisplayedRowAtIndex(startRow + ri);
        if (!node?.id) return;
        clipRow.forEach((val, ci) => {
          const field = dateColFieldsRef.current[startCol + ci];
          if (!field) return;
          const raw = val.trim();
          if (!raw) return;
          const parsed = Number(raw);
          const newValue = isNaN(parsed) ? raw : parsed;
          pasteEntry.push({ rowId: node.id!, field, oldValue: node.data?.[field], newValue });
          setCellValue(node as IRowNode<RowData>, field, newValue);
        });
      });
      pushHistory(pasteEntry);
      api.refreshCells({ force: true });
    };

    container.addEventListener("keydown", onKeyDown, true);
    container.addEventListener("paste", onPaste);
    return () => {
      container.removeEventListener("keydown", onKeyDown, true);
      container.removeEventListener("paste", onPaste);
    };
    // All params are stable refs/callbacks — intentional empty deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
