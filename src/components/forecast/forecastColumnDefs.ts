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

import { toISODate } from "./utils";
import { normSel, cellNumeric } from "./forecastCellUtils";
import { NoColumnRenderer } from "./NoColumnRenderer";
import type { RowData, SelRange } from "./forecastGridTypes";

type Params = {
  dailyDates: Date[];
  bankHolidays: Set<string>;
  todayIso: string;
  selRef: React.MutableRefObject<SelRange | null>;
  dateColFieldsRef: React.MutableRefObject<string[]>;
  fillPreviewSel: SelRange | null;
};

export function forecastColumnDefs({
  dailyDates,
  bankHolidays,
  todayIso,
  selRef,
  dateColFieldsRef,
  fillPreviewSel,
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
      resizable: false,
    },
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
    {
      headerName: "Total Hours",
      width: 100,
      minWidth: 80,
      pinned: "left",
      editable: false,
      suppressMovable: true,
      resizable: false,
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
      resizable: false,
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
    const isToday = iso === todayIso;
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");

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
        const colIdx = dateColFieldsRef.current.indexOf(iso);
        const ri = p.node.rowIndex;

        // Base background — lowest priority, overridden by selection
        const baseBg = isBankHoliday ? "var(--status-healthy-bg)" : isWeekend ? "var(--muted)" : "";

        // Scope boundary divider — inset top shadow, merged with selection below
        const dividerShadow = p.data?._scopeDivider ? "0 2px 0 0 var(--border) inset" : "";

        const sel = selRef.current;
        if (sel && ri != null) {
          const n = normSel(sel);
          if (ri >= n.r1 && ri <= n.r2 && colIdx >= n.c1 && colIdx <= n.c2) {
            // Selection edges — blue inset shadows. Listed first so they layer above divider.
            const edge = "var(--chart-1)";
            const top = ri === n.r1 ? `0 2px 0 0 ${edge} inset` : "";
            const bot = ri === n.r2 ? `0 -2px 0 0 ${edge} inset` : "";
            const lft = colIdx === n.c1 ? `2px 0 0 0 ${edge} inset` : "";
            const rgt = colIdx === n.c2 ? `-2px 0 0 0 ${edge} inset` : "";
            // Selection takes full precedence — suppress divider shadow inside the range
            const shadows = [top, bot, lft, rgt].filter(Boolean).join(", ");
            return {
              backgroundColor: "color-mix(in srgb, var(--chart-1) 12%, transparent)",
              boxShadow: shadows || "none",
            };
          }
        }

        if (fillPreviewSel && ri != null) {
          const fn = normSel(fillPreviewSel);
          if (ri >= fn.r1 && ri <= fn.r2 && colIdx >= fn.c1 && colIdx <= fn.c2) {
            return {
              backgroundColor: "color-mix(in srgb, var(--chart-1) 6%, transparent)",
              outline: "1px dashed var(--chart-1)",
              boxShadow: "none",
            };
          }
        }

        // Always return an explicit boxShadow to clear any previously applied value.
        return { backgroundColor: baseBg, boxShadow: dividerShadow || "none" };
      },
      cellClass: (p) => {
        const classes = ["forecast-date-cell"];
        if (p.value != null && p.value !== "") classes.push("forecast-date-cell--has-value");
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
