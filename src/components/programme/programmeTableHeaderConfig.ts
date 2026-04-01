import {
  PROGRAMME_HEADER_COL_TOTAL,
  PROGRAMME_HEADER_COL_WIDE,
} from "./programmeTableHeaderConstants";
import type { ProgrammeSortColumn } from "./programmeTableSort";

export type ProgrammeSortableHeaderColumn = {
  column: ProgrammeSortColumn;
  label: string;
  title: string;
  widthClass: string;
};

/** Declarative list — drives `ProgrammeTableHeader` sort buttons (order + copy + width). */
export const PROGRAMME_SORTABLE_HEADER_COLUMNS: readonly ProgrammeSortableHeaderColumn[] = [
  {
    column: "total",
    label: "TOTAL HOURS",
    title: "Click to sort total hours",
    widthClass: PROGRAMME_HEADER_COL_TOTAL,
  },
  {
    column: "start",
    label: "START",
    title: "Click to sort start date",
    widthClass: PROGRAMME_HEADER_COL_WIDE,
  },
  {
    column: "finish",
    label: "FINISH",
    title: "Click to sort finish date",
    widthClass: PROGRAMME_HEADER_COL_WIDE,
  },
];
