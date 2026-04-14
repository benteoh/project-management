// Column definitions factory for the forecast AG Grid.
// Called inside useMemo([dailyDates, bankHolidays, fillPreviewSel]) in ForecastAgGrid.
// selRef and dateColFieldsRef are read at cell-render time (inside cellStyle),
// not at factory-call time — they are intentionally excluded from the dep array.

import type {
  ColDef,
  ColGroupDef,
  ValueFormatterParams,
  ValueGetterParams,
  ValueParserParams,
} from "ag-grid-community";

import { formatIsoDateShort, toISODateUtc } from "./utils";
import { normSel } from "./forecastCellUtils";
import { NoColumnRenderer } from "./NoColumnRenderer";
import type { RowData, SelRange } from "./forecastGridTypes";
import { scopeBracketCellStyle } from "./scopeBracketCellStyle";

type Params = {
  dailyDates: Date[];
  bankHolidays: Set<string>;
  todayIso: string;
  selRef: React.MutableRefObject<SelRange | null>;
  dateColFieldsRef: React.MutableRefObject<string[]>;
  fillPreviewSel: SelRange | null;
  /** Set of "rowId:field" keys for cells with pending autofill values (ghost style). */
  pendingSet: Set<string>;
  /** When false (default), Hour Rate and Total Spent columns are omitted. */
  showRateAndSpendColumns: boolean;
};

export function forecastColumnDefs({
  dailyDates,
  bankHolidays,
  todayIso,
  selRef,
  dateColFieldsRef,
  fillPreviewSel,
  pendingSet,
  showRateAndSpendColumns,
}: Params): ColDef<RowData>[] {
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
      resizable: false,
      tooltipValueGetter: (p) => {
        const d = p.data;
        if (!d) return null;
        if (d._scopeLeadRow && (d._scopeStartIso || d._scopeEndIso)) {
          const s =
            d._scopeStartIso != null && d._scopeStartIso !== ""
              ? formatIsoDateShort(d._scopeStartIso)
              : "…";
          const e =
            d._scopeEndIso != null && d._scopeEndIso !== ""
              ? formatIsoDateShort(d._scopeEndIso)
              : "…";
          return `Scope dates: ${s} – ${e}`;
        }
        return d._scope;
      },
    },
    {
      field: "_person",
      headerName: "Person",
      width: 144,
      minWidth: 80,
      pinned: "left",
      editable: false,
      suppressMovable: true,
      resizable: false,
    },
    {
      field: "_weeklyScopeLimit",
      headerName: "Weekly\nscope limit",
      wrapHeaderText: true,
      autoHeaderHeight: true,
      headerClass: "forecast-header-multiline",
      width: 100,
      minWidth: 80,
      pinned: "left",
      editable: false,
      suppressMovable: true,
      resizable: false,
      tooltipValueGetter: () =>
        "Weekly scope limit — max hours per week on this scope for this engineer (autofill applies this together with the engineer global weekly cap across scopes)",
      valueGetter: (p: ValueGetterParams<RowData>): number | null => {
        if (!p.data) return null;
        const v = p.data._weeklyScopeLimit;
        return typeof v === "number" && !Number.isNaN(v) ? v : null;
      },
      valueFormatter: (p) => (p.value != null ? String(p.value) : ""),
    },
    ...(showRateAndSpendColumns
      ? ([
          {
            field: "_hourRate",
            headerName: "Hour Rate",
            width: 100,
            minWidth: 80,
            pinned: "left",
            editable: false,
            suppressMovable: true,
            resizable: false,
            valueFormatter: (p) => (p.value != null ? `£${Number(p.value).toFixed(2)}` : ""),
          },
        ] satisfies ColDef<RowData>[])
      : []),
    {
      field: "_forecastHrsTotal",
      headerName: "Forecast hours",
      width: 100,
      minWidth: 80,
      pinned: "left",
      editable: false,
      suppressMovable: true,
      resizable: false,
      valueGetter: (p: ValueGetterParams<RowData>): number | null => {
        if (!p.data) return null;
        const v = p.data._forecastHrsTotal;
        return v != null && !Number.isNaN(v) ? v : null;
      },
      valueFormatter: (p) => (p.value != null ? String(p.value) : ""),
    },
    {
      field: "_plannedHrs",
      headerName: "Planned hours",
      width: 100,
      minWidth: 80,
      pinned: "left",
      editable: false,
      suppressMovable: true,
      resizable: false,
      valueGetter: (p: ValueGetterParams<RowData>): number | null => {
        if (!p.data) return null;
        const v = p.data._plannedHrs;
        return v != null && !Number.isNaN(v) ? Math.round(v * 100) / 100 : null;
      },
      valueFormatter: (p) => (p.value != null ? String(p.value) : ""),
    },
    ...(showRateAndSpendColumns
      ? ([
          {
            headerName: "Total Spent",
            width: 100,
            minWidth: 80,
            pinned: "left",
            editable: false,
            suppressMovable: true,
            resizable: false,
            valueGetter: (p: ValueGetterParams<RowData>): string | null => {
              if (!p.data) return null;
              const rate = p.data._hourRate;
              if (rate == null) return null;
              const hrs = p.data._forecastHrsTotal;
              if (hrs == null || hrs <= 0) return null;
              return `£${(hrs * Number(rate)).toFixed(2)}`;
            },
          },
        ] satisfies ColDef<RowData>[])
      : []),
  ];

  // Pre-build index lookup so each cellStyle call is O(1) instead of O(n indexOf).
  const isoToColIdx = new Map(dailyDates.map((d, i) => [toISODateUtc(d), i]));

  const dateCols: ColDef<RowData>[] = dailyDates.map((date) => {
    const iso = toISODateUtc(date);
    const dow = date.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const isBankHoliday = bankHolidays.has(iso);
    const isToday = iso === todayIso;
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");

    return {
      field: iso,
      headerName: `${dd}/${mm}`,
      width: 34,
      minWidth: 24,
      editable: true,
      resizable: false,
      suppressMovable: true,
      valueParser: (p: ValueParserParams<RowData>): number | null => {
        const raw = String(p.newValue ?? "").trim();
        if (!raw) return null;
        const n = Number(raw);
        if (isNaN(n) || !Number.isInteger(n) || n < 0 || n > 9) return p.oldValue as number | null;
        return n;
      },
      valueFormatter: (p: ValueFormatterParams<RowData>): string =>
        p.value != null ? String(p.value) : "",
      headerClass: [
        "forecast-date-header",
        isWeekend && "forecast-date-header--weekend",
        isBankHoliday && "forecast-date-header--holiday",
        isToday && "forecast-date-header--today",
      ]
        .filter(Boolean)
        .join(" "),
      cellStyle: (p): Record<string, string | number> => {
        const colIdx = isoToColIdx.get(iso) ?? -1;
        const ri = p.node.rowIndex;

        // Base background — weekend / bank holiday / plain
        const baseBg = isBankHoliday ? "var(--status-healthy-bg)" : isWeekend ? "var(--muted)" : "";

        const scopeBand = scopeBracketCellStyle(iso, p.data, dateColFieldsRef.current);

        // Scope boundary divider — inset top shadow between scope groups
        const dividerShadow = p.data?._scopeDivider ? "0 2px 0 0 var(--border) inset" : "";

        const sel = selRef.current;
        if (sel && ri != null) {
          const n = normSel(sel);
          if (ri >= n.r1 && ri <= n.r2 && colIdx >= n.c1 && colIdx <= n.c2) {
            // Selection edges — blue inset shadows; scope divider stacks underneath.
            const edge = "var(--chart-1)";
            const top = ri === n.r1 ? `0 2px 0 0 ${edge} inset` : "";
            const bot = ri === n.r2 ? `0 -2px 0 0 ${edge} inset` : "";
            const lft = colIdx === n.c1 ? `2px 0 0 0 ${edge} inset` : "";
            const rgt = colIdx === n.c2 ? `-2px 0 0 0 ${edge} inset` : "";
            const shadows = [scopeBand.boxShadow, dividerShadow, top, bot, lft, rgt]
              .filter(Boolean)
              .join(", ");
            return {
              ...scopeBand,
              backgroundColor: "color-mix(in srgb, var(--chart-1) 12%, transparent)",
              boxShadow: shadows || "none",
            };
          }
        }

        if (fillPreviewSel && ri != null) {
          const fn = normSel(fillPreviewSel);
          if (ri >= fn.r1 && ri <= fn.r2 && colIdx >= fn.c1 && colIdx <= fn.c2) {
            const fillShadows = [scopeBand.boxShadow, dividerShadow].filter(Boolean).join(", ");
            return {
              ...scopeBand,
              backgroundColor: "color-mix(in srgb, var(--chart-1) 6%, transparent)",
              outline: "1px dashed var(--chart-1)",
              boxShadow: fillShadows || "none",
            };
          }
        }

        const mergedShadow =
          [scopeBand.boxShadow, dividerShadow].filter(Boolean).join(", ") || "none";
        return {
          ...scopeBand,
          backgroundColor: baseBg,
          boxShadow: mergedShadow,
        };
      },
      cellClass: (p) => {
        const classes = ["forecast-date-cell"];
        if (p.value != null && p.value !== "") classes.push("forecast-date-cell--has-value");
        if (p.node.id && pendingSet.has(`${p.node.id}:${iso}`))
          classes.push("forecast-date-cell--pending");
        return classes.join(" ");
      },
    };
  });

  // Group date columns by year so the year label spans above as a sub-header.
  // Each group header shows only the year — the individual columns show dd/mm.
  const byYear = new Map<number, ColDef<RowData>[]>();
  for (const col of dateCols) {
    const year = new Date(col.field as string).getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(col);
  }

  const yearGroups: ColGroupDef<RowData>[] = [...byYear.entries()].map(([year, cols]) => ({
    headerName: String(year),
    headerClass: "forecast-year-header",
    marryChildren: false,
    children: cols,
  }));

  return [...fixed, ...yearGroups];
}
