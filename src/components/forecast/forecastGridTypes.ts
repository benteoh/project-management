// Internal types for the forecast AG Grid — not domain types.
// Domain types (ForecastGridRow, ScopeItem, etc.) live in ./types.

/** rowId → date field (ISO) → hours — shared by grid, autofill, draft, and persistence. */
export type CellValues = Record<string, Record<string, unknown>>;

export type RowData = {
  _id: string;
  _no: number;
  _scopeId: string;
  _scope: string;
  _person: string;
  _hourRate: number | null;
  _scopeDivider: boolean; // true on the first row of each new scope group
  /** First engineer row for this scope in the current (filtered) grid — used for scope date bracket. */
  _scopeLeadRow: boolean;
  /** ISO dates from programme scope — bracket spans [start, end] ∩ visible columns. */
  _scopeStartIso: string | null;
  _scopeEndIso: string | null;
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

/** Result of a pending autofill — shown in the confirmation bar until approved or discarded. */
export type PendingFill = {
  changes: HistoryChange[];
  warnings: string[];
  budgetWarnings: string[];
};
