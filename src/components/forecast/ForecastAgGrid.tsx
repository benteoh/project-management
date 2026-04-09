"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type GetRowIdParams,
  type GridReadyEvent,
} from "ag-grid-community";

import { formatEngineerListLabel } from "@/lib/engineer-pool-display";

import type { ForecastGridRow } from "./types";
import { toISODate } from "./utils";
import { FILL_HANDLE_SIZE } from "./forecastGridConstants";
import { forecastTheme } from "./forecastTheme";
import { forecastColumnDefs } from "./forecastColumnDefs";
import { useCellStore } from "./useCellStore";
import { useGridHistory } from "./useGridHistory";
import { useGridSelection } from "./useGridSelection";
import { useGridKeyboard } from "./useGridKeyboard";
import type { RowData } from "./forecastGridTypes";

ModuleRegistry.registerModules([AllCommunityModule]);

type Props = {
  rows: ForecastGridRow[];
  dailyDates: Date[];
  bankHolidays: Set<string>;
  todayIso: string;
  // Parent passes a ref whose .current will be set to a scroll-to-today callback
  scrollToTodayRef: React.RefObject<(() => void) | null>;
};

export function ForecastAgGrid({
  rows,
  dailyDates,
  bankHolidays,
  todayIso,
  scrollToTodayRef,
}: Props) {
  const gridRef = useRef<AgGridReact<RowData>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ordered list of date field strings — used for range index calculations
  const dateColFields = useMemo(() => dailyDates.map((d) => toISODate(d)), [dailyDates]);
  const dateColFieldsRef = useRef(dateColFields);
  useEffect(() => {
    dateColFieldsRef.current = dateColFields;
  }, [dateColFields]);

  // ── Feature hooks ──────────────────────────────────────────────────────────
  const { cellValuesRef, setCellValue } = useCellStore();

  const { historyRef, historyIndexRef, editingOldValueRef, pushHistory, applyHistory } =
    useGridHistory({ gridRef, setCellValue });

  const {
    selRef,
    fillHandleRef,
    fillPreviewSel,
    onCellMouseDown,
    onCellMouseOver,
    onFillHandleMouseDown,
    onBodyScroll,
  } = useGridSelection({ gridRef, containerRef, dateColFieldsRef, setCellValue, pushHistory });

  useGridKeyboard({
    containerRef,
    gridRef,
    selRef,
    dateColFieldsRef,
    historyRef,
    historyIndexRef,
    setCellValue,
    pushHistory,
    applyHistory,
  });

  // ── Scroll to today ────────────────────────────────────────────────────────
  const scrollToToday = useCallback(() => {
    gridRef.current?.api.ensureColumnVisible(todayIso, "middle");
  }, [todayIso]);

  // Expose to parent via ref
  useEffect(() => {
    scrollToTodayRef.current = scrollToToday;
  }, [scrollToToday, scrollToTodayRef]);

  // ── Today line overlay ─────────────────────────────────────────────────────
  // Rendered as an absolutely positioned vertical line so it never interferes
  // with cell box-shadow selection borders.
  const [todayLinePos, setTodayLinePos] = useState<{ x: number; top: number } | null>(null);

  const updateTodayLine = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const pinnedEl = container.querySelector(".ag-pinned-left-cols-container");
    const pinnedRight = pinnedEl ? pinnedEl.getBoundingClientRect().right : 0;
    // Prefer center header viewport so we never match a duplicate node in pinned DOM
    const headerCell =
      container.querySelector<HTMLElement>(
        `.ag-header-viewport .ag-header-cell[col-id="${todayIso}"]`
      ) ?? container.querySelector<HTMLElement>(`.ag-header-cell[col-id="${todayIso}"]`);
    if (!headerCell) {
      setTodayLinePos(null);
      return;
    }
    const cellRect = headerCell.getBoundingClientRect();
    // Hide if today's column is scrolled behind the pinned area
    if (cellRect.left < pinnedRight) {
      setTodayLinePos(null);
      return;
    }
    const contRect = container.getBoundingClientRect();
    // Align top with the date header row (leaf), not the year group row above it
    setTodayLinePos({
      x: cellRect.left - contRect.left,
      top: cellRect.top - contRect.top,
    });
  }, [todayIso]);

  // ── Row data ───────────────────────────────────────────────────────────────
  const rowData = useMemo<RowData[]>(
    () =>
      rows.map((row, idx) => {
        const id = `${row.scope.id}-${row.engineer.id}`;
        const saved = cellValuesRef.current[id] ?? {};
        const prevScopeId = idx > 0 ? rows[idx - 1].scope.id : null;
        const base: RowData = {
          _id: id,
          _no: idx + 1,
          _scopeId: row.scope.id,
          _scope: row.scope.label,
          _person: formatEngineerListLabel(row.engineer, row.engineer.code),
          _hourRate: row.engineer.rateA ?? null,
          _scopeDivider: idx > 0 && row.scope.id !== prevScopeId,
        };
        for (const d of dailyDates) {
          const field = toISODate(d);
          base[field] = (saved[field] ?? null) as string | number | null;
        }
        return base;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, dailyDates]
  );

  // ── Column definitions ─────────────────────────────────────────────────────
  const columnDefs = useMemo(
    () =>
      forecastColumnDefs({
        dailyDates,
        bankHolidays,
        todayIso,
        selRef,
        dateColFieldsRef,
        fillPreviewSel,
      }),
    // selRef and dateColFieldsRef are stable refs — read at cell-render time, not here
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dailyDates, bankHolidays, todayIso, fillPreviewSel]
  );

  // ── Grid ready: scroll to today ────────────────────────────────────────────
  const onGridReady = useCallback(
    (e: GridReadyEvent) => {
      e.api.ensureColumnVisible(todayIso, "middle");
      // Defer today line — DOM isn't painted until after this callback
      requestAnimationFrame(updateTodayLine);
    },
    [todayIso, updateTodayLine]
  );

  // Scroll to today and reposition the line whenever the date range changes
  // (e.g. when the "show past" toggle fires and dailyDates shifts)
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.ensureColumnVisible(todayIso, "middle");
    requestAnimationFrame(updateTodayLine);
  }, [dailyDates, todayIso, updateTodayLine]);

  return (
    <>
      <style>{`
        /* Year group header */
        .forecast-year-header {
          font-size: 10px !important;
          font-weight: 600 !important;
          color: var(--muted-foreground) !important;
          border-bottom: 1px solid var(--border);
          background-color: var(--muted) !important;
        }
        .forecast-year-header .ag-header-group-cell-label { justify-content: flex-start; padding-left: 4px; }
        /* Date column headers */
        .forecast-date-header .ag-header-cell-text {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          text-overflow: unset;
          overflow: visible;
          white-space: nowrap;
        }
        .forecast-date-header .ag-header-cell-label { justify-content: center; }
        .forecast-date-header--weekend  { background-color: var(--muted) !important; }
        .forecast-date-header--holiday  { background-color: var(--status-healthy-bg) !important; }
        .forecast-date-header--today    { background-color: var(--status-info-bg) !important; }
        .forecast-date-header--today .ag-header-cell-text { color: var(--chart-1); font-weight: 700; }
        .forecast-date-cell {
          padding-left: 2px !important;
          padding-right: 2px !important;
          text-align: center;
          font-size: 12px;
          user-select: none;
        }
        .forecast-date-cell--has-value  { font-weight: 500; }
        /* Suppress AG Grid's focused-cell border everywhere — date cells use custom selection */
        .ag-cell-focus:not(.ag-cell-inline-editing) {
          border-color: transparent !important;
          box-shadow: none !important;
        }
        /* Make the cell editor invisible — just the bare input inside the cell */
        .forecast-date-cell .ag-cell-editor,
        .forecast-date-cell .ag-text-field-input-wrapper,
        .forecast-date-cell .ag-cell-edit-wrapper {
          height: 100%;
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .forecast-date-cell .ag-input-field-input {
          height: 100%;
          padding: 0 2px !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          text-align: center;
          font-size: 12px;
          font-weight: 500;
          color: inherit;
          outline: none !important;
        }
        /* Separator between pinned fixed columns and scrollable date columns */
        .ag-pinned-left-cols-container,
        .ag-pinned-left-header {
          box-shadow: 3px 0 6px -2px color-mix(in srgb, var(--foreground) 10%, transparent);
          z-index: 2;
        }
      `}</style>

      {/* Container needs tabIndex to receive keyboard / paste events */}
      <div
        ref={containerRef}
        tabIndex={-1}
        style={{ height: "100%", width: "100%", position: "relative", outline: "none" }}
      >
        <AgGridReact<RowData>
          ref={gridRef}
          theme={forecastTheme}
          groupHeaderHeight={20}
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(p: GetRowIdParams<RowData>) => String(p.data._id)}
          onGridReady={onGridReady}
          onCellMouseDown={onCellMouseDown}
          onCellMouseOver={onCellMouseOver}
          onBodyScroll={() => {
            onBodyScroll();
            updateTodayLine();
          }}
          onCellEditingStarted={(e) => {
            const field = e.colDef.field;
            if (!field || !e.node.id || !/^\d{4}-\d{2}-\d{2}$/.test(field)) return;
            editingOldValueRef.current = { rowId: e.node.id, field, value: e.value };
          }}
          onCellValueChanged={(e: CellValueChangedEvent<RowData>) => {
            const captured = editingOldValueRef.current;
            editingOldValueRef.current = null;
            if (!captured) return;
            const field = e.colDef.field;
            if (!field || !e.node.id || !/^\d{4}-\d{2}-\d{2}$/.test(field)) return;
            if (captured.rowId !== e.node.id || captured.field !== field) return;
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
          getRowStyle={(p) =>
            p.data?._scopeDivider ? { borderTop: "2px solid var(--border)" } : undefined
          }
          rowDragManaged
          defaultColDef={{
            sortable: false,
            filter: false,
            resizable: false,
            suppressHeaderMenuButton: true,
          }}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          enterNavigatesVertically
          enterNavigatesVerticallyAfterEdit
          suppressScrollOnNewData
          animateRows={false}
        />

        {/* Today line — vertical overlay independent of cell borders */}
        {todayLinePos !== null && (
          <div
            style={{
              position: "absolute",
              top: todayLinePos.top,
              bottom: 0,
              left: todayLinePos.x,
              width: 2,
              backgroundColor: "var(--chart-1)",
              opacity: 0.5,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        )}

        {/* Fill handle — always in DOM, shown/hidden via direct style.display by useGridSelection */}
        <div
          ref={fillHandleRef}
          onMouseDown={onFillHandleMouseDown}
          style={{
            display: "none",
            position: "absolute",
            left: 0,
            top: 0,
            width: FILL_HANDLE_SIZE,
            height: FILL_HANDLE_SIZE,
            backgroundColor: "var(--chart-1)",
            border: "1px solid var(--card)",
            borderRadius: 1,
            cursor: "crosshair",
            zIndex: 1,
            pointerEvents: "all",
          }}
        />
      </div>
    </>
  );
}
