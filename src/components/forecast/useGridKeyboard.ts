"use client";

import { useEffect, useRef } from "react";
import type { AgGridReact } from "ag-grid-react";
import type { IRowNode } from "ag-grid-community";

import { normSel, displayValue, cellNumeric, detectFillPattern } from "./forecastCellUtils";
import type { RowData, SelRange, HistoryEntry, PendingFill } from "./forecastGridTypes";

type Params = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  gridRef: React.RefObject<AgGridReact<RowData> | null>;
  selRef: React.MutableRefObject<SelRange | null>;
  dateColFieldsRef: React.MutableRefObject<string[]>;
  setCellValue: (node: IRowNode<RowData>, field: string, value: unknown) => void;
  pushHistory: (entry: HistoryEntry) => void;
  /** Incremented every time pushHistory is called — used to detect stale discard stashes. */
  pushVersionRef: React.RefObject<number>;
  // History operations — index management is encapsulated in useGridHistory
  undo: () => void;
  redo: () => void;
  canRedo: () => boolean;
  advanceRedoIndex: () => void;
  /** Ref to current preview-active state — when true, undo discards preview instead of walking history. */
  isPreviewActiveRef: React.MutableRefObject<boolean>;
  /** Discard the current autofill preview without moving the history pointer. */
  discardFill: () => void;
  /** Ref to approveFill — must be a ref because approveFill closes over pendingFill state. */
  approveFillRef: React.RefObject<() => void>;
  /** Always-current ref to pendingFill — lets the stable closure read live state. */
  pendingFillRef: React.RefObject<PendingFill | null>;
  /** Restore a discarded fill back into preview (redo-after-discard). */
  restorePreviewRef: React.RefObject<(fill: PendingFill) => void>;
};

/** True when the active element is a text input outside the grid (don't intercept undo there). */
function activeElementIsExternalInput(container: HTMLDivElement | null): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (container?.contains(el)) return false; // inside the grid — we handle it
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

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
  setCellValue,
  pushHistory,
  pushVersionRef,
  undo,
  redo,
  canRedo,
  advanceRedoIndex,
  isPreviewActiveRef,
  discardFill,
  approveFillRef,
  pendingFillRef,
  restorePreviewRef,
}: Params): void {
  // Stash of the last discarded preview (with the pushVersion at time of discard).
  // Version-tagged so a manual edit after discard invalidates the stash and prevents
  // the next Ctrl+Y from accidentally restoring a preview the user has moved past.
  const discardedFillRef = useRef<{ fill: PendingFill; version: number } | null>(null);

  // ── Undo / Redo — document-level so they work regardless of focus ─────────
  // Skipped only when an external input (outside the grid) has focus.
  useEffect(() => {
    const onUndoRedo = (e: KeyboardEvent) => {
      const isUndo = primaryMod(e) && e.key.toLowerCase() === "z" && !e.shiftKey;
      const isRedo = redoShortcut(e);
      if (!isUndo && !isRedo) return;

      // Don't intercept when focus is in a non-grid input (search box, modal, etc.)
      if (activeElementIsExternalInput(containerRef.current)) return;

      const api = gridRef.current?.api;
      if (!api) return;

      e.preventDefault();
      e.stopPropagation();

      if (isUndo) {
        // While cell is editing, commit the edit and stop — next Ctrl+Z handles undo/discard.
        // Don't also discard the preview: the user's intent was to cancel the cell edit only.
        if (api.getEditingCells().length > 0) {
          api.stopEditing();
          return;
        }
        // While preview is active, undo = discard preview; stash it so redo can restore.
        // Tag with the current pushVersion so a subsequent manual edit invalidates the stash.
        if (isPreviewActiveRef.current) {
          const fill = pendingFillRef.current;
          if (fill) discardedFillRef.current = { fill, version: pushVersionRef.current ?? 0 };
          discardFill();
          return;
        }
        discardedFillRef.current = null;
        undo();
        return;
      }

      if (isRedo) {
        if (isPreviewActiveRef.current) {
          if (canRedo()) {
            // Preview was restored by undo — the autofill entry already lives at the next
            // history slot. Calling approveFill() would push a NEW entry and truncate
            // everything ahead of it. Instead: commit pending cells directly, advance pointer.
            const fill = pendingFillRef.current;
            if (fill) {
              for (const c of fill.changes) {
                const node = api.getRowNode(c.rowId);
                if (node) setCellValue(node, c.field, c.newValue);
              }
            }
            advanceRedoIndex();
            discardFill();
          } else {
            // No future history — preview was freshly created by the autofill button; accept normally.
            approveFillRef.current();
          }
          return;
        }
        // Redo after discard — only restore if no new history entry was pushed since the discard.
        // A newer pushVersion means the user made a manual edit and has moved past this preview.
        if (discardedFillRef.current) {
          if (discardedFillRef.current.version === (pushVersionRef.current ?? 0)) {
            restorePreviewRef.current?.(discardedFillRef.current.fill);
            discardedFillRef.current = null;
            return;
          }
          discardedFillRef.current = null; // stale — fall through to normal redo
        }
        redo();
        return;
      }
    };

    document.addEventListener("keydown", onUndoRedo, true);
    return () => document.removeEventListener("keydown", onUndoRedo, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── All other grid shortcuts — container-level, skipped while editing ─────
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
