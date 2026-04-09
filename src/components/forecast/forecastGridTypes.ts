// Internal types for the forecast AG Grid — not domain types.
// Domain types (ForecastGridRow, ScopeItem, etc.) live in ./types.

export type RowData = {
  _id: string;
  _no: number;
  _scopeId: string;
  _scope: string;
  _person: string;
  _hourRate: number | null;
  _scopeDivider: boolean; // true on the first row of each new scope group
  [dateKey: string]: string | number | null | boolean;
};

// 2D rectangle of (row, col) indices into rowData / dateColFields arrays
export type SelRange = { r1: number; r2: number; c1: number; c2: number };

export type HistoryChange = {
  rowId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

export type HistoryEntry = HistoryChange[];
