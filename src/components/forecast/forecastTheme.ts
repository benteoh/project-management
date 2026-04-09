import { themeQuartz } from "ag-grid-community";

import { DEFAULT_ROW_H } from "./forecastGridConstants";

export const forecastTheme = themeQuartz.withParams({
  fontFamily: "Inter, ui-sans-serif, sans-serif",
  fontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 500,
  rowHeight: DEFAULT_ROW_H,
  headerHeight: 80,
  cellHorizontalPaddingScale: 0.6,
  borderColor: "var(--border)",
  columnBorder: true,
  rowHoverColor: "var(--muted)",
  selectedRowBackgroundColor: "var(--status-info-bg)",
});
