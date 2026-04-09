"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useAutofill } from "./useAutofill";
import type { CellValues, HistoryEntry, PendingFill, RowData } from "./forecastGridTypes";

ModuleRegistry.registerModules([AllCommunityModule]);

export type ForecastAgGridHandle = {
  getCellValues: () => CellValues;
  hydrate: (values: CellValues) => void;
};

type Props = {
  rows: ForecastGridRow[];
  dailyDates: Date[];
  bankHolidays: Set<string>;
  todayIso: string;
  // Parent passes a ref whose .current will be set to a scroll-to-today callback
  scrollToTodayRef: React.RefObject<(() => void) | null>;
  /** When set, replaces cellValuesRef with these values (server/draft load). */
  hydratePayload: { key: number; values: CellValues } | null;
  /** Fired after committed edits (not preview). Parent uses for draft + unsaved. */
  onPersistableChange?: () => void;
  /** When true, show Hour Rate and Total Spent columns. Default false (hidden). */
  showRateAndSpendColumns?: boolean;
};

export const ForecastAgGrid = forwardRef<ForecastAgGridHandle, Props>(function ForecastAgGrid(
  {
    rows,
    dailyDates,
    bankHolidays,
    todayIso,
    scrollToTodayRef,
    hydratePayload,
    onPersistableChange,
    showRateAndSpendColumns = false,
  },
  ref
) {
  const gridRef = useRef<AgGridReact<RowData>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ordered list of date field strings — used for range index calculations
  const dateColFields = useMemo(() => dailyDates.map((d) => toISODate(d)), [dailyDates]);
  const dateColFieldsRef = useRef(dateColFields);
  useEffect(() => {
    dateColFieldsRef.current = dateColFields;
  }, [dateColFields]);

  // ── Feature hooks ──────────────────────────────────────────────────────────
  const { cellValuesRef, setCellValue } = useCellStore(onPersistableChange);

  // Incremented on every undo/redo so rowData recomputes from the updated cellValuesRef.
  const [rowDataRevision, setRowDataRevision] = useState(0);

  // Stable ref so useGridHistory (empty-deps effect) can call the latest handleHistoryApplied
  // without creating a circular hook dependency.
  const handleHistoryAppliedRef = useRef<
    ((entry: HistoryEntry, direction: "undo" | "redo") => void) | null
  >(null);

  const { editingOldValueRef, pushHistory, pushVersionRef, undo, redo, canRedo, advanceRedoIndex } =
    useGridHistory({
      gridRef,
      setCellValue,
      onHistoryApplied: (entry, direction) => {
        handleHistoryAppliedRef.current?.(entry, direction);
        setRowDataRevision((n) => n + 1);
      },
    });

  const {
    selRef,
    hasSelection,
    fillHandleRef,
    fillPreviewSel,
    onCellMouseDown,
    onCellMouseOver,
    onFillHandleMouseDown,
    onBodyScroll,
  } = useGridSelection({ gridRef, containerRef, dateColFieldsRef, setCellValue, pushHistory });

  const {
    pendingFill,
    pendingFillRef,
    pendingValuesRef,
    triggerAutofill,
    addPendingChange,
    approveFill,
    discardFill,
    restorePreview,
    isPreviewActive,
    handleHistoryApplied,
  } = useAutofill({
    rows,
    dateColFields,
    selRef,
    gridRef,
    cellValuesRef,
    bankHolidays,
    setCellValue,
    pushHistory,
  });

  // Keep the ref in sync so the history callback above always calls the latest version
  handleHistoryAppliedRef.current = handleHistoryApplied;

  useImperativeHandle(
    ref,
    () => ({
      getCellValues: () => structuredClone(cellValuesRef.current),
      hydrate: (values: CellValues) => {
        cellValuesRef.current = structuredClone(values);
        discardFill();
        setRowDataRevision((n) => n + 1);
      },
    }),
    [cellValuesRef, discardFill]
  );

  const lastHydrateKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydratePayload) return;
    if (lastHydrateKeyRef.current === hydratePayload.key) return;
    lastHydrateKeyRef.current = hydratePayload.key;
    cellValuesRef.current = structuredClone(hydratePayload.values);
    discardFill();
    setRowDataRevision((n) => n + 1);
  }, [hydratePayload, cellValuesRef, discardFill]);

  // Refs so stable AG Grid / keyboard closures always read the latest values
  const isPreviewActiveRef = useRef(isPreviewActive);
  isPreviewActiveRef.current = isPreviewActive;
  const approveFillRef = useRef<() => void>(() => {});
  approveFillRef.current = approveFill;
  const restorePreviewRef = useRef<(fill: PendingFill) => void>(() => {});
  restorePreviewRef.current = restorePreview;

  useGridKeyboard({
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
  });

  // Refresh all cells after pendingFill changes so value-getter columns
  // (Forecast hours, Total Spent) pick up the merged pending values from rowData.
  useEffect(() => {
    if (!pendingFill) return;
    gridRef.current?.api?.refreshCells({ force: true });
  }, [pendingFill]);

  // ── Scroll to today ────────────────────────────────────────────────────────
  const scrollToToday = useCallback(() => {
    gridRef.current?.api?.ensureColumnVisible(todayIso, "middle");
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
  // pendingFill in deps ensures a re-render when preview is set/cleared so
  // cells pick up pending values from pendingValuesRef for ghost display.
  const rowData = useMemo<RowData[]>(
    () =>
      rows.map((row, idx) => {
        const id = `${row.scope.id}-${row.engineer.id}`;
        const saved = cellValuesRef.current[id] ?? {};
        const pending = pendingValuesRef.current[id] ?? {};
        const prevScopeId = idx > 0 ? rows[idx - 1].scope.id : null;
        const scopeLeadRow = idx === 0 || row.scope.id !== prevScopeId;
        const base: RowData = {
          _id: id,
          _no: idx + 1,
          _scopeId: row.scope.id,
          _scope: row.scope.label,
          _person: formatEngineerListLabel(row.engineer, row.engineer.code),
          _hourRate: row.hourRate,
          _plannedHrs: row.plannedHrs,
          _scopeDivider: idx > 0 && row.scope.id !== prevScopeId,
          _scopeLeadRow: scopeLeadRow,
          _scopeStartIso: row.scopeStartDate,
          _scopeEndIso: row.scopeEndDate,
        };
        for (const d of dailyDates) {
          const field = toISODate(d);
          // Pending wins for ghost display; committed value is the fallback
          base[field] = (pending[field] ?? saved[field] ?? null) as string | number | null;
        }
        return base;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, dailyDates, pendingFill, rowDataRevision]
  );

  // ── Pending set — fast lookup for ghost cell styling ──────────────────────
  const pendingSet = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    if (pendingFill) {
      for (const c of pendingFill.changes) s.add(`${c.rowId}:${c.field}`);
    }
    return s;
  }, [pendingFill]);

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
        pendingSet,
        showRateAndSpendColumns,
      }),
    // selRef and dateColFieldsRef are stable refs — read at cell-render time, not here
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dailyDates, bankHolidays, todayIso, fillPreviewSel, pendingSet, showRateAndSpendColumns]
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
  // (e.g. "show past", or pinned column count when Rate & spend is toggled).
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.ensureColumnVisible(todayIso, "middle");
    // Double rAF: AG Grid applies new column defs / pinned width on the next frame(s).
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(updateTodayLine);
    });
    return () => cancelAnimationFrame(id);
  }, [dailyDates, todayIso, updateTodayLine, showRateAndSpendColumns]);

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
        .forecast-date-header { cursor: pointer; }
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
        .forecast-date-cell--pending    { color: var(--chart-1); opacity: 0.7; font-style: italic; }
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

      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Autofill toolbar — also shows inline preview/confirm when active */}
        <AutofillToolbar
          hasSelection={hasSelection}
          pendingFill={pendingFill}
          onAutofillAll={() => {
            gridRef.current?.api?.stopEditing();
            triggerAutofill("all");
          }}
          onAutofillSelection={() => {
            gridRef.current?.api?.stopEditing();
            triggerAutofill("selection");
          }}
          onApprove={approveFill}
          onDiscard={discardFill}
        />

        {/* Grid container — needs tabIndex to receive keyboard / paste events */}
        <div
          ref={containerRef}
          tabIndex={-1}
          style={{ flex: 1, position: "relative", outline: "none", minHeight: 0 }}
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
            onGridColumnsChanged={() => {
              gridRef.current?.api?.ensureColumnVisible(todayIso, "middle");
              requestAnimationFrame(() => {
                requestAnimationFrame(updateTodayLine);
              });
            }}
            onGridSizeChanged={() => {
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
              if (isPreviewActiveRef.current) {
                // During preview, route edits into the pending store instead of committing
                addPendingChange(e.node.id, field, captured.value, e.newValue);
                gridRef.current?.api?.refreshCells({ force: true });
              } else {
                setCellValue(e.node, field, e.newValue);
                pushHistory([
                  { rowId: e.node.id, field, oldValue: captured.value, newValue: e.newValue },
                ]);
              }
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
      </div>
    </>
  );
});

// ── Sub-components ─────────────────────────────────────────────────────────────

function AutofillToolbar({
  hasSelection,
  pendingFill,
  onAutofillAll,
  onAutofillSelection,
  onApprove,
  onDiscard,
}: {
  hasSelection: boolean;
  pendingFill: PendingFill | null;
  onAutofillAll: () => void;
  onAutofillSelection: () => void;
  onApprove: () => void;
  onDiscard: () => void;
}) {
  const btnBase =
    "rounded-md border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const btnDefault = `${btnBase} border-border text-muted-foreground hover:text-foreground`;

  const hasChanges = (pendingFill?.changes.length ?? 0) > 0;
  const warnings = pendingFill?.warnings ?? [];
  const budgetWarnings = pendingFill?.budgetWarnings ?? [];

  return (
    <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-1.5">
      <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
        <SparklesIcon />
        Auto-fill
      </span>
      <button
        type="button"
        onClick={onAutofillAll}
        className={btnDefault}
        title="Fill all unallocated cells respecting planned hours and capacity"
      >
        All rows
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          // Must fire on mousedown, not click — the document mousedown listener in
          // useGridSelection clears selRef before the click event reaches here.
          e.preventDefault();
          if (hasSelection) onAutofillSelection();
        }}
        disabled={!hasSelection}
        className={btnDefault}
        title="Fill selected cells only"
      >
        Selection
      </button>

      {pendingFill !== null && (
        <>
          <span className="text-border mx-1 select-none">|</span>
          <span className="text-muted-foreground text-xs">
            {hasChanges ? (
              <>
                <span className="font-medium">{pendingFill.changes.length} cells</span>
                {" across "}
                <span className="font-medium">
                  {new Set(pendingFill.changes.map((c) => c.rowId)).size} rows
                </span>
              </>
            ) : (
              "Nothing to fill"
            )}
          </span>
          {warnings.length > 0 &&
            (() => {
              const noHrs = warnings.filter((w) => w.includes("No planned hours"));
              const atCap = warnings.filter((w) => w.includes("capacity reached"));
              const parts: string[] = [];
              if (atCap.length) parts.push(`${atCap.length} at capacity`);
              if (noHrs.length) parts.push(`${noHrs.length} no planned hrs`);
              if (!parts.length) parts.push(`${warnings.length} skipped`);
              return (
                <span
                  className="text-status-warning cursor-help text-xs"
                  title={warnings.join("\n")}
                >
                  ⚠ {parts.join(", ")}
                </span>
              );
            })()}
          {budgetWarnings.length > 0 && (
            <span
              className="text-status-critical cursor-help text-xs"
              title={budgetWarnings.join("\n")}
            >
              ⚠ {budgetWarnings.length} exceed planned hrs
            </span>
          )}
          <button type="button" onClick={onDiscard} className={btnDefault}>
            ✕ Discard
          </button>
          {hasChanges && (
            <button
              type="button"
              onClick={onApprove}
              className="bg-chart-1 hover:bg-chart-1/90 rounded-md border-0 px-3 py-1 text-xs font-medium text-white transition-colors"
            >
              ✓ Apply
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor" aria-hidden>
      {/* Large spark — centre */}
      <path d="M8 1 L8.6 6.4 L14 7 L8.6 7.6 L8 13 L7.4 7.6 L2 7 L7.4 6.4 Z" />
      {/* Small spark — top right */}
      <path d="M12.5 1 L12.8 3.2 L15 3.5 L12.8 3.8 L12.5 6 L12.2 3.8 L10 3.5 L12.2 3.2 Z" />
      {/* Small spark — bottom left */}
      <path d="M3.5 10 L3.8 12.2 L6 12.5 L3.8 12.8 L3.5 15 L3.2 12.8 L1 12.5 L3.2 12.2 Z" />
    </svg>
  );
}
