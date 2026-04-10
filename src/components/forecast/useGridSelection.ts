"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgGridReact } from "ag-grid-react";
import type { CellMouseDownEvent, IRowNode } from "ag-grid-community";

import { FILL_HANDLE_SIZE } from "./forecastGridConstants";
import { normSel, cellNumeric, detectFillPattern } from "./forecastCellUtils";
import type { RowData, SelRange, HistoryEntry } from "./forecastGridTypes";

type Params = {
  gridRef: React.RefObject<AgGridReact<RowData> | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  dateColFieldsRef: React.MutableRefObject<string[]>;
  setCellValue: (node: IRowNode<RowData>, field: string, value: unknown) => void;
  pushHistory: (entry: HistoryEntry) => void;
};

export function useGridSelection({
  gridRef,
  containerRef,
  dateColFieldsRef,
  setCellValue,
  pushHistory,
}: Params) {
  const selRef = useRef<SelRange | null>(null);
  const isDraggingSelRef = useRef(false);
  const selAnchorRef = useRef<{ r: number; c: number } | null>(null);

  const isFillDragRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const fillDragDirRef = useRef<"down" | "right" | null>(null);
  const fillDragEndRef = useRef<{ r: number; c: number } | null>(null);

  const isHeaderDragRef = useRef(false);
  const headerAnchorColRef = useRef<number | null>(null);

  // Direct DOM ref — no React state, so position updates skip the render cycle entirely
  const fillHandleRef = useRef<HTMLDivElement | null>(null);
  const [fillPreviewSel, setFillPreviewSel] = useState<SelRange | null>(null);
  // Reactive flag so consumers can enable/disable UI that depends on selection existing
  const [hasSelection, setHasSelection] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function hideFillHandle() {
    if (fillHandleRef.current) fillHandleRef.current.style.display = "none";
  }

  function updateFillHandlePos() {
    const el = fillHandleRef.current;
    const sel = selRef.current;
    const container = containerRef.current;
    if (!el) return;
    if (!sel || !container) {
      el.style.display = "none";
      return;
    }
    const n = normSel(sel);
    const field = dateColFieldsRef.current[n.c2];
    if (!field) {
      el.style.display = "none";
      return;
    }
    const pinnedEl = container.querySelector(".ag-pinned-left-cols-container");
    const pinnedRight = pinnedEl ? pinnedEl.getBoundingClientRect().right : 0;

    const rows = container.querySelectorAll(`.ag-row[row-index="${n.r2}"]`);
    for (const row of rows) {
      const cell = row.querySelector(`[col-id="${field}"]`);
      if (cell) {
        const cellRect = cell.getBoundingClientRect();
        if (cellRect.right <= pinnedRight) {
          el.style.display = "none";
          return;
        }
        const contRect = container.getBoundingClientRect();
        el.style.display = "block";
        el.style.left = `${cellRect.right - contRect.left - FILL_HANDLE_SIZE / 2}px`;
        el.style.top = `${cellRect.bottom - contRect.top - FILL_HANDLE_SIZE / 2}px`;
        return;
      }
    }
    el.style.display = "none";
  }

  function refreshSelection() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      gridRef.current?.api?.refreshCells({ force: true });
      updateFillHandlePos();
      rafRef.current = null;
    });
  }

  /** Select all displayed rows × all visible date columns (used by Ctrl/Cmd+A). */
  function selectAllVisible() {
    const api = gridRef.current?.api;
    if (!api) return;
    const rowCount = api.getDisplayedRowCount();
    const fields = dateColFieldsRef.current;
    if (rowCount === 0 || fields.length === 0) {
      selRef.current = null;
      setHasSelection(false);
      hideFillHandle();
      api.refreshCells({ force: true });
      return;
    }
    selRef.current = {
      r1: 0,
      r2: rowCount - 1,
      c1: 0,
      c2: fields.length - 1,
    };
    setHasSelection(true);
    refreshSelection();
  }

  // ── Mouse-based range selection (date cells only) ──────────────────────────

  function colIndexOf(colId: string): number {
    return dateColFieldsRef.current.indexOf(colId);
  }

  const onCellMouseDown = useCallback(
    (e: CellMouseDownEvent<RowData>) => {
      const colId = e.column.getColId();
      const ci = colIndexOf(colId);
      if (ci === -1 || e.rowIndex == null) {
        selRef.current = null;
        setHasSelection(false);
        hideFillHandle();
        gridRef.current?.api?.refreshCells({ force: true });
        return;
      }
      isDraggingSelRef.current = true;
      selAnchorRef.current = { r: e.rowIndex, c: ci };
      selRef.current = { r1: e.rowIndex, r2: e.rowIndex, c1: ci, c2: ci };
      setHasSelection(true);
      refreshSelection();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onCellMouseOver = useCallback(
    (e: { rowIndex: number | null; column: { getColId: () => string } }) => {
      if (!isDraggingSelRef.current || !selAnchorRef.current) return;
      const ci = colIndexOf(e.column.getColId());
      if (ci === -1 || e.rowIndex == null) return;
      selRef.current = {
        r1: selAnchorRef.current.r,
        r2: e.rowIndex,
        c1: selAnchorRef.current.c,
        c2: ci,
      };
      refreshSelection();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Stop selection drag on mouse up
  useEffect(() => {
    function onMouseUp() {
      isDraggingSelRef.current = false;
      isHeaderDragRef.current = false;
    }
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  // Clear selection when clicking outside the grid container
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        selRef.current = null;
        setHasSelection(false);
        hideFillHandle();
        gridRef.current?.api?.refreshCells({ force: true });
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- containerRef/gridRef stable from parent

  // ── Column header range selection ─────────────────────────────────────────
  // Mousedown on a date column header selects all rows × that column.
  // Dragging across headers extends the column range.

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onContainerMouseDown(e: MouseEvent) {
      const headerEl = (e.target as Element)?.closest?.(
        ".ag-header-cell[col-id]"
      ) as HTMLElement | null;
      if (!headerEl) return; // not a header — handled by onCellMouseDown or onDocMouseDown

      const colId = headerEl.getAttribute("col-id") ?? "";
      const ci = dateColFieldsRef.current.indexOf(colId);

      if (ci === -1) {
        // Non-date header (Scope, Person, etc.) — clear selection
        selRef.current = null;
        setHasSelection(false);
        hideFillHandle();
        gridRef.current?.api?.refreshCells({ force: true });
        return;
      }

      const api = gridRef.current?.api;
      if (!api) return;
      const rowCount = api.getDisplayedRowCount();
      if (rowCount === 0) return;

      isHeaderDragRef.current = true;
      headerAnchorColRef.current = ci;
      selRef.current = { r1: 0, r2: rowCount - 1, c1: ci, c2: ci };
      setHasSelection(true);
      refreshSelection();
    }

    container.addEventListener("mousedown", onContainerMouseDown);
    return () => container.removeEventListener("mousedown", onContainerMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extend column range while dragging across headers
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isHeaderDragRef.current || headerAnchorColRef.current === null) return;
      const container = containerRef.current;
      const api = gridRef.current?.api;
      if (!container || !api) return;

      const colEls = container.querySelectorAll<HTMLElement>(".ag-header-cell[col-id]");
      let hoveredCol = headerAnchorColRef.current;
      for (const colEl of colEls) {
        const ci = dateColFieldsRef.current.indexOf(colEl.getAttribute("col-id") ?? "");
        if (ci === -1) continue;
        const rect = colEl.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          hoveredCol = ci;
          break;
        }
      }

      const anchor = headerAnchorColRef.current;
      selRef.current = {
        r1: 0,
        r2: api.getDisplayedRowCount() - 1,
        c1: Math.min(anchor, hoveredCol),
        c2: Math.max(anchor, hoveredCol),
      };
      refreshSelection();
    }

    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBodyScroll = useCallback(() => {
    // Single rAF to wait for AG Grid to finish repositioning cells before reading DOM rects
    requestAnimationFrame(() => updateFillHandlePos());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fill handle drag ───────────────────────────────────────────────────────

  function onFillHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const sel = selRef.current;
    if (!sel) return;
    isFillDragRef.current = true;
    fillDragDirRef.current = null;
    fillDragEndRef.current = null;

    const startX = e.clientX;
    const startY = e.clientY;

    function onMove(ev: MouseEvent) {
      if (!isFillDragRef.current) return;
      const api = gridRef.current?.api;
      const container = containerRef.current;
      if (!api || !container) return;

      const n = normSel(sel!);
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!fillDragDirRef.current) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 3) fillDragDirRef.current = "down";
        else if (Math.abs(dx) > 3) fillDragDirRef.current = "right";
        else return;
      }

      if (fillDragDirRef.current === "down") {
        // NOTE: .ag-row[row-index] is an AG Grid internal DOM attribute — stable in v32+
        const rowEls = container.querySelectorAll<HTMLElement>(".ag-row[row-index]");
        let targetRow = n.r2;
        for (const rowEl of rowEls) {
          const ri = parseInt(rowEl.getAttribute("row-index") ?? "-1");
          const rowRect = rowEl.getBoundingClientRect();
          if (ev.clientY >= rowRect.top && ev.clientY <= rowRect.bottom) {
            targetRow = Math.max(ri, n.r2);
            break;
          }
        }
        fillDragEndRef.current = { r: targetRow, c: n.c2 };
        setFillPreviewSel(
          targetRow > n.r2 ? { r1: n.r2 + 1, r2: targetRow, c1: n.c1, c2: n.c2 } : null
        );
      } else {
        // NOTE: .ag-header-cell[col-id] is an AG Grid internal DOM attribute — stable in v32+
        const colEls = container.querySelectorAll<HTMLElement>(".ag-header-cell[col-id]");
        let targetCol = n.c2;
        for (const colEl of colEls) {
          const colId = colEl.getAttribute("col-id") ?? "";
          const ci = dateColFieldsRef.current.indexOf(colId);
          if (ci === -1) continue;
          const colRect = colEl.getBoundingClientRect();
          if (ev.clientX >= colRect.left && ev.clientX <= colRect.right) {
            targetCol = Math.max(ci, n.c2);
            break;
          }
        }
        fillDragEndRef.current = { r: n.r2, c: targetCol };
        setFillPreviewSel(
          targetCol > n.c2 ? { r1: n.r1, r2: n.r2, c1: n.c2 + 1, c2: targetCol } : null
        );
      }
    }

    function onUp() {
      isFillDragRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      const api = gridRef.current?.api;
      if (!api || !fillDragEndRef.current) {
        setFillPreviewSel(null);
        return;
      }
      const n = normSel(sel!);
      const end = fillDragEndRef.current;
      const fillEntry: HistoryEntry = [];

      if (fillDragDirRef.current === "down" && end.r > n.r2) {
        const fields = dateColFieldsRef.current.slice(n.c1, n.c2 + 1);
        for (const field of fields) {
          const sourceVals: (number | null)[] = [];
          for (let ri = n.r1; ri <= n.r2; ri++) {
            const v = api.getDisplayedRowAtIndex(ri)?.data?.[field];
            sourceVals.push(v != null ? cellNumeric(v) : null);
          }
          const fill = detectFillPattern(sourceVals);
          for (let ri = n.r2 + 1; ri <= end.r; ri++) {
            const node = api.getDisplayedRowAtIndex(ri);
            if (node?.id) {
              const newValue = fill(ri - n.r2 - 1);
              if (newValue === null) continue;
              fillEntry.push({ rowId: node.id, field, oldValue: node.data?.[field], newValue });
              setCellValue(node, field, newValue);
            }
          }
        }
        selRef.current = { r1: n.r1, r2: end.r, c1: n.c1, c2: n.c2 };
      } else if (fillDragDirRef.current === "right" && end.c > n.c2) {
        for (let ri = n.r1; ri <= n.r2; ri++) {
          const node = api.getDisplayedRowAtIndex(ri);
          if (!node?.id) continue;
          const sourceVals: (number | null)[] = [];
          for (let ci = n.c1; ci <= n.c2; ci++) {
            const v = node.data?.[dateColFieldsRef.current[ci]];
            sourceVals.push(v != null ? cellNumeric(v) : null);
          }
          const fill = detectFillPattern(sourceVals);
          for (let ci = n.c2 + 1; ci <= end.c; ci++) {
            const field = dateColFieldsRef.current[ci];
            const newValue = fill(ci - n.c2 - 1);
            if (newValue === null) continue;
            fillEntry.push({ rowId: node.id, field, oldValue: node.data?.[field], newValue });
            setCellValue(node, field, newValue);
          }
        }
        selRef.current = { r1: n.r1, r2: n.r2, c1: n.c1, c2: end.c };
      }

      pushHistory(fillEntry);
      setFillPreviewSel(null);
      api.refreshCells({ force: true });
      updateFillHandlePos();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return {
    selRef,
    hasSelection,
    fillHandleRef,
    fillPreviewSel,
    selectAllVisible,
    onCellMouseDown,
    onCellMouseOver,
    onFillHandleMouseDown,
    onBodyScroll,
  };
}
