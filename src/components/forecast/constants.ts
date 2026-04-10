/** Pinned summary column titles — matches {@link forecastColumnDefs} order. */
export function forecastSummaryColumnLabels(showRateAndSpendColumns: boolean): string[] {
  if (showRateAndSpendColumns) {
    return [
      "Scope",
      "Person",
      "Weekly limit",
      "Hour Rate",
      "Forecast hours",
      "Planned hours",
      "Total Spent",
    ];
  }
  return ["Scope", "Person", "Weekly limit", "Forecast hours", "Planned hours"];
}
export const NO_COL_W = "w-12";
export const SUMMARY_COL_W = "w-36";
export const DATE_COL_W = "w-8";
