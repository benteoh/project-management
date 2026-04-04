"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type CellMouseDownEvent,
  type CellValueChangedEvent,
  type ColDef,
  type ColumnResizedEvent,
  type GetRowIdParams,
  type GridReadyEvent,
  type ICellRendererParams,
  type IRowNode,
  type ValueFormatterParams,
  type ValueGetterParams,
  type ValueParserParams,
} from "ag-grid-community";

import { formatEngineerListLabel } from "@/lib/engineer-pool-display";

import type { ForecastGridRow } from "./types";
import { toISODate } from "./utils";

ModuleRegistry.registerModules([AllCommunityModule]);

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const LS_COL_STATE = "fg-col-state";
const LS_ROW_HEIGHTS = "fg-row-heights";
const DEFAULT_ROW_H = 36;
const MIN_ROW_H = 24;
const FILL_HANDLE_SIZE = 8;
const MAX_HISTORY = 100;

// ── History types (module-level so they are importable if needed) ─────────────
type HistoryChange = { rowId: string; field: string; oldValue: unknown; newValue: unknown };
type HistoryEntry = HistoryChange[];

// ─────────────────────────────────────────────────────────────────────────────
// Formula evaluation — only digits / operators / parens allowed through
// ─────────────────────────────────────────────────────────────────────────────
function evalFormula(raw: string): number | string {
  if (!raw.startsWith("=")) return raw;
  const expr = raw.slice(1).replace(/[^0-9+\-*/().\s]/g, "");
  if (!expr.trim() || expr.length > 200) return "#ERROR";
  try {
     
    const result = new Function(`"use strict"; return (${expr})`)() as unknown;
    return typeof result === "number" && isFinite(result)
      ? Math.round(result * 1000) / 1000
      : "#ERROR";
  } catch {
    return "#ERROR";
  }
}

function cellNumeric(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "string" && value.startsWith("=")) {
    const ev = evalFormula(value);
    return typeof ev === "number" ? ev : 0;
  }
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function displayValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" && value.startsWith("=")) return String(evalFormula(value));
  return String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern detection — supports constant and arithmetic progressions
// Returns a function: (offsetFromEnd) => nextValue
// ─────────────────────────────────────────────────────────────────────────────
function detectFillPattern(vals: (number | null)[]): (offset: number) => number {
  const nums = vals.filter((v): v is number => v != null);
  if (nums.length === 0) return () => 0;
  if (nums.length === 1) return () => nums[0];
  const diffs = nums.slice(1).map((v, i) => v - nums[i]);
  const step = diffs[0];
  const isArithmetic = diffs.every((d) => Math.abs(d - step) < 0.0001);
  if (isArithmetic) {
    const last = nums[nums.length - 1];
    return (offset: number) => last + step * (offset + 1);
  }
  return () => nums[nums.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────
const forecastTheme = themeQuartz.withParams({
  fontFamily: "Inter, ui-sans-serif, sans-serif",
  fontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 500,
  rowHeight: DEFAULT_ROW_H,
  headerHeight: 80,
  cellHorizontalPaddingScale: 0.6,
  borderColor: "#e4e4e7",
  columnBorder: true,
  rowHoverColor: "#f4f4f5",
  selectedRowBackgroundColor: "#eff6ff",
});

// ─────────────────────────────────────────────────────────────────────────────
// Row types
// ─────────────────────────────────────────────────────────────────────────────
type RowData = {
  _id: string;
  _no: number;
  _scope: string;
  _person: string;
  _hourRate: number | null;
  [dateKey: string]: string | number | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Custom cell renderer for No. column — includes a bottom-edge drag handle
// that resizes row height
// ─────────────────────────────────────────────────────────────────────────────
function NoColumnRenderer(params: ICellRendererParams<RowData>) {
  const startY = useRef(0);
  const startH = useRef(DEFAULT_ROW_H);

  function onMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    startY.current = e.clientY;
    startH.current = params.node.rowHeight ?? DEFAULT_ROW_H;

    function onMove(ev: MouseEvent) {
      const newH = Math.max(MIN_ROW_H, startH.current + ev.clientY - startY.current);
      params.node.setRowHeight(newH);
      params.api.onRowHeightChanged();
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      // Persist
      const stored = JSON.parse(localStorage.getItem(LS_ROW_HEIGHTS) ?? "{}") as Record<
        string,
        number
      >;
      stored[params.node.id ?? ""] = params.node.rowHeight ?? DEFAULT_ROW_H;
      localStorage.setItem(LS_ROW_HEIGHTS, JSON.stringify(stored));
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        alignItems: "center",
      }}
    >
      <span style={{ color: "#71717a", fontSize: "12px" }}>{params.value}</span>
      {/* Resize drag handle — bottom edge of cell */}
      <div
        onMouseDown={onMouseDown}
        title="Drag to resize row"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 5,
          cursor: "row-resize",
          zIndex: 1,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection range — indices into rowData and dateColFields arrays
// ─────────────────────────────────────────────────────────────────────────────
type SelRange = { r1: number; r2: number; c1: number; c2: number };

function normSel(s: SelRange): SelRange {
  return {
    r1: Math.min(s.r1, s.r2),
    r2: Math.max(s.r1, s.r2),
    c1: Math.min(s.c1, s.c2),
    c2: Math.max(s.c1, s.c2),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
type Props = {
  rows: ForecastGridRow[];
  dailyDates: Date[];
  bankHolidays: Set<string>;
};

// ─────────────────────────────────────────────────────────────────────────────
// ForecastAgGrid
// ─────────────────────────────────────────────────────────────────────────────
export function ForecastAgGrid({ rows, dailyDates, bankHolidays }: Props) {
  const gridRef = useRef<AgGridReact<RowData>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ordered list of date field strings — used for range index calculations
  const dateColFields = useMemo(() => dailyDates.map((d) => toISODate(d)), [dailyDates]);
  const dateColFieldsRef = useRef(dateColFields);
  useEffect(() => {
    dateColFieldsRef.current = dateColFields;
  }, [dateColFields]);

  // ── Row heights ──────────────────────────────────────────────────────────
  const rowHeightsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_ROW_HEIGHTS) ?? "{}") as Record<
        string,
        number
      >;
      rowHeightsRef.current = stored;
    } catch {
      /* ignore */
    }
  }, []);

  const getRowHeight = useCallback(
    (params: { node: { id?: string | null } }) =>
      rowHeightsRef.current[params.node.id ?? ""] ?? DEFAULT_ROW_H,
    []
  );

  // ── Custom selection state (ref to avoid re-renders on every mouse move) ─
  const selRef = useRef<SelRange | null>(null);
  const isDraggingSelRef = useRef(false);
  const selAnchorRef = useRef<{ r: number; c: number } | null>(null);

  // Fill-handle drag state
  const isFillDragRef = useRef(false);
  const fillDragDirRef = useRef<"down" | "right" | null>(null);
  const fillDragEndRef = useRef<{ r: number; c: number } | null>(null);

  // Fill handle position in px (relative to container) — triggers a re-render
  const [fillHandlePos, setFillHandlePos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [fillPreviewSel, setFillPreviewSel] = useState<SelRange | null>(null);

  // ── Persistent cell value store — survives rowData recomputes (filter changes) ─
  // Keyed by rowId → field → value. rowData reads from this; all mutations write to it.
  const cellValuesRef = useRef<Record<string, Record<string, unknown>>>({});

  // Single point of truth for setting a cell value — updates both the AG Grid node
  // and the persistent store so values survive filter changes.
  function setCellValue(node: IRowNode<RowData>, field: string, value: unknown) {
    node.setDataValue(field, value);
    if (!node.id) return;
    if (!cellValuesRef.current[node.id]) cellValuesRef.current[node.id] = {};
    if (value == null) {
      delete cellValuesRef.current[node.id][field];
    } else {
      cellValuesRef.current[node.id][field] = value;
    }
  }

  // ── Undo / redo history ──────────────────────────────────────────────────
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  // Set by onCellEditingStarted (user-initiated only — never fires for setDataValue).
  // Used by onCellValueChanged to distinguish user edits from programmatic changes.
  const editingOldValueRef = useRef<{ rowId: string; field: string; value: unknown } | null>(null);

  function pushHistory(entry: HistoryEntry) {
    if (entry.length === 0) return;
    // Drop redo stack, then cap total history at MAX_HISTORY to bound memory
    let stack = historyRef.current.slice(0, historyIndexRef.current + 1);
    stack.push(entry);
    if (stack.length > MAX_HISTORY) stack = stack.slice(stack.length - MAX_HISTORY);
    historyRef.current = stack;
    historyIndexRef.current = stack.length - 1;
  }

  function applyHistory(entry: HistoryEntry, direction: "undo" | "redo") {
    const api = gridRef.current?.api;
    if (!api) return;
    for (const change of entry) {
      const node = api.getRowNode(change.rowId);
      if (!node) continue;
      setCellValue(node, change.field, direction === "undo" ? change.oldValue : change.newValue);
    }
    api.refreshCells({ force: true });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function refreshSelection() {
    gridRef.current?.api.refreshCells({ force: true });
    updateFillHandlePos();
  }

  function updateFillHandlePos() {
    const sel = selRef.current;
    const container = containerRef.current;
    if (!sel || !container) {
      setFillHandlePos(null);
      return;
    }
    const n = normSel(sel);
    const field = dateColFieldsRef.current[n.c2];
    if (!field) {
      setFillHandlePos(null);
      return;
    }
    // Find the bottom-right cell DOM element
    const rows = container.querySelectorAll(`.ag-row[row-index="${n.r2}"]`);
    for (const row of rows) {
      const cell = row.querySelector(`[col-id="${field}"]`);
      if (cell) {
        const cellRect = cell.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        setFillHandlePos({
          x: cellRect.right - contRect.left - FILL_HANDLE_SIZE / 2,
          y: cellRect.bottom - contRect.top - FILL_HANDLE_SIZE / 2,
        });
        return;
      }
    }
    setFillHandlePos(null);
  }

  // ── Row data ─────────────────────────────────────────────────────────────
  // cellValuesRef is intentionally NOT in the dependency array — it is a stable
  // ref and changes to it must not trigger a recompute. rowData reads from it
  // so that user-entered values survive filter changes (which change `rows`).
  const rowData = useMemo<RowData[]>(
    () =>
      rows.map((row, idx) => {
        const id = `${row.scope.id}-${row.engineer.id}`;
        const saved = cellValuesRef.current[id] ?? {};
        const base: RowData = {
          _id: id,
          _no: idx + 1,
          _scope: row.scope.label,
          _person: formatEngineerListLabel(row.engineer, row.engineer.code),
          _hourRate: row.engineer.rateA ?? null,
        };
        for (const d of dailyDates) {
          const field = toISODate(d);
          base[field] = (saved[field] ?? null) as string | number | null;
        }
        return base;
      }),
     
    [rows, dailyDates]
  );

  // ── Column definitions ───────────────────────────────────────────────────
  const columnDefs = useMemo<ColDef<RowData>[]>(() => {
    const fixed: ColDef<RowData>[] = [
      {
        field: "_no",
        headerName: "No.",
        width: 52,
        minWidth: 52,
        pinned: "left",
        editable: false,
        resizable: false,
        suppressMovable: true,
        cellRenderer: NoColumnRenderer,
      },
      {
        field: "_scope",
        headerName: "Scope",
        width: 144,
        minWidth: 80,
        pinned: "left",
        editable: false,
        suppressMovable: true,
        resizable: true,
        tooltipField: "_scope",
      },
      {
        field: "_person",
        headerName: "Person",
        width: 144,
        minWidth: 80,
        pinned: "left",
        editable: false,
        suppressMovable: true,
        resizable: true,
      },
      {
        field: "_hourRate",
        headerName: "Hour Rate",
        width: 100,
        minWidth: 80,
        pinned: "left",
        editable: false,
        suppressMovable: true,
        resizable: true,
        valueFormatter: (p) => (p.value != null ? `£${Number(p.value).toFixed(2)}` : ""),
      },
      {
        headerName: "Total Hours",
        width: 100,
        minWidth: 80,
        pinned: "left",
        editable: false,
        suppressMovable: true,
        resizable: true,
        valueGetter: (p: ValueGetterParams<RowData>): number | null => {
          if (!p.data) return null;
          let sum = 0;
          for (const d of dailyDates) sum += cellNumeric(p.data[toISODate(d)]);
          return sum > 0 ? Math.round(sum * 100) / 100 : null;
        },
        valueFormatter: (p) => (p.value != null ? String(p.value) : ""),
      },
      {
        headerName: "Total Spent",
        width: 100,
        minWidth: 80,
        pinned: "left",
        editable: false,
        suppressMovable: true,
        resizable: true,
        valueGetter: (p: ValueGetterParams<RowData>): string | null => {
          if (!p.data) return null;
          const rate = p.data._hourRate;
          if (rate == null) return null;
          let sum = 0;
          for (const d of dailyDates) sum += cellNumeric(p.data[toISODate(d)]);
          return sum > 0 ? `£${(sum * Number(rate)).toFixed(2)}` : null;
        },
      },
    ];

    const dateCols: ColDef<RowData>[] = dailyDates.map((date) => {
      const iso = toISODate(date);
      const dow = date.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isBankHoliday = bankHolidays.has(iso);
      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");

      return {
        field: iso,
        headerName: `${dd}/${mm}`,
        width: 34,
        minWidth: 24,
        editable: true,
        resizable: true,
        suppressMovable: false,
        valueParser: (p: ValueParserParams<RowData>): number | string | null => {
          const raw = String(p.newValue ?? "").trim();
          if (!raw) return null;
          if (raw.startsWith("=")) return raw;
          const n = Number(raw);
          return isNaN(n) ? raw : n;
        },
        valueFormatter: (p: ValueFormatterParams<RowData>): string => displayValue(p.value),
        headerClass: [
          "forecast-date-header",
          isWeekend && "forecast-date-header--weekend",
          isBankHoliday && "forecast-date-header--holiday",
        ]
          .filter(Boolean)
          .join(" "),
        cellStyle: (p): Record<string, string | number> | null => {
          const sel = selRef.current;
          const colIdx = dateColFieldsRef.current.indexOf(iso);
          if (sel && p.node.rowIndex != null) {
            const n = normSel(sel!);
            if (
              p.node.rowIndex >= n.r1 &&
              p.node.rowIndex <= n.r2 &&
              colIdx >= n.c1 &&
              colIdx <= n.c2
            ) {
              return { backgroundColor: "rgba(59,130,246,0.12)" };
            }
          }
          // Fill preview highlight
          const fp = fillPreviewSel;
          if (fp && p.node.rowIndex != null) {
            const fn = normSel(fp);
            if (
              p.node.rowIndex >= fn.r1 &&
              p.node.rowIndex <= fn.r2 &&
              colIdx >= fn.c1 &&
              colIdx <= fn.c2
            ) {
              return { backgroundColor: "rgba(59,130,246,0.05)", outline: "1px dashed #3b82f6" };
            }
          }
          if (isBankHoliday) return { backgroundColor: "#dcfce7" };
          if (isWeekend) return { backgroundColor: "#f4f4f5" };
          return null;
        },
        cellClass: (p) => {
          const classes = ["forecast-date-cell"];
          if (p.value != null && p.value !== "") classes.push("forecast-date-cell--has-value");
          return classes.join(" ");
        },
      };
    });

    return [...fixed, ...dateCols];
     
  }, [dailyDates, bankHolidays, fillPreviewSel]);

  // ── Grid ready: restore column state + row heights ───────────────────────
  const onGridReady = useCallback((e: GridReadyEvent) => {
    try {
      const saved = localStorage.getItem(LS_COL_STATE);
      if (saved) {
        e.api.applyColumnState({
          state: JSON.parse(saved) as Parameters<typeof e.api.applyColumnState>[0]["state"],
          applyOrder: false,
        });
      }
    } catch {
      /* ignore */
    }
    e.api.resetRowHeights();
  }, []);

  // ── Persist column widths ────────────────────────────────────────────────
  const onColumnResized = useCallback((e: ColumnResizedEvent) => {
    if (!e.finished) return;
    try {
      localStorage.setItem(LS_COL_STATE, JSON.stringify(e.api.getColumnState()));
    } catch {
      /* ignore */
    }
  }, []);

  // ── Mouse-based range selection (date cells only) ────────────────────────
  function colIndexOf(colId: string): number {
    return dateColFieldsRef.current.indexOf(colId);
  }

  const onCellMouseDown = useCallback(
    (e: CellMouseDownEvent<RowData>) => {
      const colId = e.column.getColId();
      const ci = colIndexOf(colId);
      if (ci === -1 || e.rowIndex == null) return;
      isDraggingSelRef.current = true;
      selAnchorRef.current = { r: e.rowIndex, c: ci };
      selRef.current = { r1: e.rowIndex, r2: e.rowIndex, c1: ci, c2: ci };
      refreshSelection();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onCellMouseOver = useCallback(
    (e: { rowIndex: number | null; column: { getColId: () => string } }) => {
      if (!isDraggingSelRef.current || !selAnchorRef.current) return;
      const colId = e.column.getColId();
      const ci = colIndexOf(colId);
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

  // Stop drag on mouse up (document level so it fires even outside grid)
  useEffect(() => {
    function onMouseUp() {
      isDraggingSelRef.current = false;
    }
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  // ── Clipboard: copy selection as TSV, paste TSV into grid ────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Copy — capture phase so we intercept before AG Grid's own handler
    const onKeyDown = (e: KeyboardEvent) => {
      const api = gridRef.current?.api;
      if (!api) return;

      // Don't intercept any key while a cell is actively being edited
      if (api.getEditingCells().length > 0) return;

      // Ctrl+C — copy selection
      if (e.ctrlKey && e.key === "c") {
        const sel = selRef.current;
        if (!sel) return;
        e.preventDefault();
        e.stopPropagation();
        const n = normSel(sel!);
        const lines: string[] = [];
        for (let ri = n.r1; ri <= n.r2; ri++) {
          const node = api.getDisplayedRowAtIndex(ri);
          if (!node) continue;
          const cols = dateColFieldsRef.current.slice(n.c1, n.c2 + 1);
          lines.push(cols.map((field) => displayValue(node.data?.[field])).join("\t"));
        }
        navigator.clipboard.writeText(lines.join("\n")).catch(() => {
          /* clipboard might be blocked in some browsers */
        });
        return;
      }

      // Ctrl+Z — undo
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        e.stopPropagation();
        const idx = historyIndexRef.current;
        if (idx < 0) return;
        applyHistory(historyRef.current[idx], "undo");
        historyIndexRef.current--;
        return;
      }

      // Ctrl+Y — redo
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        e.stopPropagation();
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current++;
        applyHistory(historyRef.current[historyIndexRef.current], "redo");
        return;
      }

      // Ctrl+D — copy first row of selection down to all other selected rows
      if (e.ctrlKey && e.key === "d") {
        const sel = selRef.current;
        if (!sel) return;
        e.preventDefault();
        const n = normSel(sel!);
        if (n.r1 === n.r2) return;
        const sourceNode = api.getDisplayedRowAtIndex(n.r1);
        if (!sourceNode) return;
        const fields = dateColFieldsRef.current.slice(n.c1, n.c2 + 1);
        const entry: HistoryEntry = [];
        for (const field of fields) {
          const newValue = sourceNode.data?.[field] ?? null;
          for (let ri = n.r1 + 1; ri <= n.r2; ri++) {
            const targetNode = api.getDisplayedRowAtIndex(ri);
            if (!targetNode || !targetNode.id) continue;
            const oldValue = targetNode.data?.[field] ?? null;
            entry.push({ rowId: targetNode.id, field, oldValue, newValue });
            setCellValue(targetNode, field, newValue);
          }
        }
        pushHistory(entry);
        api.refreshCells({ force: true });
        return;
      }

      // Ctrl+R — copy first column of selection right to all other selected columns
      if (e.ctrlKey && e.key === "r") {
        const sel = selRef.current;
        if (!sel) return;
        e.preventDefault();
        const n = normSel(sel!);
        if (n.c1 === n.c2) return;
        const entry: HistoryEntry = [];
        for (let ri = n.r1; ri <= n.r2; ri++) {
          const node = api.getDisplayedRowAtIndex(ri);
          if (!node || !node.id) continue;
          const sourceVals: (number | null)[] = [];
          for (let ci = n.c1; ci < n.c2; ci++) {
            const v = node.data?.[dateColFieldsRef.current[ci]];
            sourceVals.push(v != null ? cellNumeric(v) : null);
          }
          const fill = detectFillPattern(sourceVals);
          const field = dateColFieldsRef.current[n.c2];
          const oldValue = node.data?.[field] ?? null;
          const newValue = fill(0);
          entry.push({ rowId: node.id, field, oldValue, newValue });
          setCellValue(node, field, newValue);
        }
        pushHistory(entry);
        api.refreshCells({ force: true });
        return;
      }

      // Delete / Backspace — clear selection
      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = selRef.current;
        if (!sel) return;
        const n = normSel(sel!);
        const entry: HistoryEntry = [];
        for (let ri = n.r1; ri <= n.r2; ri++) {
          const node = api.getDisplayedRowAtIndex(ri);
          if (!node || !node.id) continue;
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

    // Paste — multi-cell TSV from clipboard
    const onPaste = (e: ClipboardEvent) => {
      const api = gridRef.current?.api;
      if (!api) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text) return;

      // Parse clipboard: rows separated by \n, cols by \t
      const clipRows = text.split(/\r?\n/).map((r) => r.split("\t"));
      // Drop trailing empty row Excel sometimes adds
      while (clipRows.length > 0 && clipRows[clipRows.length - 1].every((c) => !c.trim()))
        clipRows.pop();
      if (clipRows.length === 0) return;

      // Anchor = top-left of current selection, or focused cell
      const sel = selRef.current;
      let startRow: number;
      let startCol: number;

      if (sel) {
        const n = normSel(sel!);
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
        if (!node || !node.id) return;
        clipRow.forEach((val, ci) => {
          const field = dateColFieldsRef.current[startCol + ci];
          if (!field) return;
          const raw = val.trim();
          if (!raw) return;
          const parsed = Number(raw);
          const newValue = isNaN(parsed) ? raw : parsed;
          pasteEntry.push({ rowId: node.id!, field, oldValue: node.data?.[field], newValue });
          setCellValue(node, field, newValue);
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
  }, []);

  // ── Fill handle drag ─────────────────────────────────────────────────────
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

      // Determine direction on first significant movement
      if (!fillDragDirRef.current) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 3) fillDragDirRef.current = "down";
        else if (Math.abs(dx) > 3) fillDragDirRef.current = "right";
        else return;
      }

      if (fillDragDirRef.current === "down") {
        // NOTE: .ag-row[row-index] and .ag-header-cell[col-id] are AG Grid internal
        // DOM attributes — stable across AG Grid v32+ but worth re-checking on major upgrades.
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
        if (targetRow > n.r2) {
          setFillPreviewSel({ r1: n.r2 + 1, r2: targetRow, c1: n.c1, c2: n.c2 });
        } else {
          setFillPreviewSel(null);
        }
      } else {
        // Find which column the mouse is over
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
        if (targetCol > n.c2) {
          setFillPreviewSel({ r1: n.r1, r2: n.r2, c1: n.c2 + 1, c2: targetCol });
        } else {
          setFillPreviewSel(null);
        }
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
        // Fill down: for each column, detect pattern from source rows, fill target rows
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
            if (node && node.id) {
              const newValue = fill(ri - n.r2 - 1);
              fillEntry.push({ rowId: node.id, field, oldValue: node.data?.[field], newValue });
              setCellValue(node, field, newValue);
            }
          }
        }
        selRef.current = { r1: n.r1, r2: end.r, c1: n.c1, c2: n.c2 };
      } else if (fillDragDirRef.current === "right" && end.c > n.c2) {
        // Fill right: for each row, detect pattern from source cols, fill target cols
        for (let ri = n.r1; ri <= n.r2; ri++) {
          const node = api.getDisplayedRowAtIndex(ri);
          if (!node || !node.id) continue;
          const sourceVals: (number | null)[] = [];
          for (let ci = n.c1; ci <= n.c2; ci++) {
            const v = node.data?.[dateColFieldsRef.current[ci]];
            sourceVals.push(v != null ? cellNumeric(v) : null);
          }
          const fill = detectFillPattern(sourceVals);
          for (let ci = n.c2 + 1; ci <= end.c; ci++) {
            const field = dateColFieldsRef.current[ci];
            const newValue = fill(ci - n.c2 - 1);
            fillEntry.push({ rowId: node.id!, field, oldValue: node.data?.[field], newValue });
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

  // Recalculate fill handle when grid scrolls
  const onBodyScroll = useCallback(() => {
    updateFillHandlePos();
     
  }, []);

  return (
    <>
      <style>{`
        .forecast-date-header .ag-header-cell-text {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          text-overflow: unset;
          overflow: visible;
          white-space: nowrap;
        }
        .forecast-date-header .ag-header-cell-label { justify-content: center; }
        .forecast-date-header--weekend  { background-color: #f4f4f5 !important; }
        .forecast-date-header--holiday  { background-color: #dcfce7 !important; }
        .forecast-date-cell {
          padding-left: 2px !important;
          padding-right: 2px !important;
          text-align: center;
          font-size: 12px;
          user-select: none;
        }
        .forecast-date-cell--has-value { font-weight: 500; }
      `}</style>

      {/* Container — needs tabIndex so it receives keyboard / paste events */}
      <div
        ref={containerRef}
        tabIndex={-1}
        style={{ height: "100%", width: "100%", position: "relative", outline: "none" }}
      >
        <AgGridReact<RowData>
          ref={gridRef}
          theme={forecastTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(p: GetRowIdParams<RowData>) => String(p.data._id)}
          getRowHeight={getRowHeight}
          onGridReady={onGridReady}
          onColumnResized={onColumnResized}
          onCellMouseDown={onCellMouseDown}
          onCellMouseOver={onCellMouseOver}
          onBodyScroll={onBodyScroll}
          onCellEditingStarted={(e) => {
            const field = e.colDef.field;
            if (!field || !e.node.id || !/^\d{4}-\d{2}-\d{2}$/.test(field)) return;
            editingOldValueRef.current = { rowId: e.node.id, field, value: e.value };
          }}
          onCellValueChanged={(e: CellValueChangedEvent<RowData>) => {
            // Only record user-initiated edits. onCellEditingStarted fires for user edits
            // but NOT for programmatic setDataValue, so checking the ref here safely
            // distinguishes the two cases regardless of when AG Grid fires this callback.
            const captured = editingOldValueRef.current;
            editingOldValueRef.current = null;
            if (!captured) return;
            const field = e.colDef.field;
            if (!field || !e.node.id || !/^\d{4}-\d{2}-\d{2}$/.test(field)) return;
            // Guard: confirm the event matches what editing started on
            if (captured.rowId !== e.node.id || captured.field !== field) return;
            // Persist to cellValuesRef (setDataValue already updated the node)
            if (!cellValuesRef.current[e.node.id]) cellValuesRef.current[e.node.id] = {};
            if (e.newValue == null) {
              delete cellValuesRef.current[e.node.id][field];
            } else {
              cellValuesRef.current[e.node.id][field] = e.newValue;
            }
            pushHistory([
              { rowId: e.node.id, field, oldValue: captured.value, newValue: e.newValue },
            ]);
          }}
          // Row drag
          rowDragManaged
          // Defaults
          defaultColDef={{
            sortable: false,
            filter: false,
            suppressHeaderMenuButton: true,
          }}
          stopEditingWhenCellsLoseFocus
          enterNavigatesVertically
          enterNavigatesVerticallyAfterEdit
          suppressScrollOnNewData
          animateRows={false}
        />

        {/* Fill handle — small blue square at bottom-right of selection */}
        {fillHandlePos && (
          <div
            onMouseDown={onFillHandleMouseDown}
            style={{
              position: "absolute",
              left: fillHandlePos.x,
              top: fillHandlePos.y,
              width: FILL_HANDLE_SIZE,
              height: FILL_HANDLE_SIZE,
              backgroundColor: "#2563eb",
              border: "1px solid #fff",
              borderRadius: 1,
              cursor: "crosshair",
              zIndex: 10,
              pointerEvents: "all",
            }}
          />
        )}
      </div>
    </>
  );
}
