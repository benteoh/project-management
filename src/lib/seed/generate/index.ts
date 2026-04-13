/** Programme demo CSV generators (forecast + timesheet rows from seed scope specs). */
export {
  DEMO_FORECAST_VARIANCE_FACTOR_MAX,
  DEMO_FORECAST_VARIANCE_FACTOR_MIN,
  demoExactPlannedScopeIds,
  type GenerateForecastRowsForScopeParams,
  type GenerateProgrammeForecastRowsParams,
  generateForecastRowsForScope,
  generateProgrammeForecastRows,
  type ProgrammeForecastRow,
  type ScopeForecastAllocation,
} from "./generateProgrammeForecastRows";
export {
  type GenerateTimesheetFromForecastParams,
  generateTimesheetRowsFromForecast,
  type ProgrammeTimesheetCsvRow,
  timesheetRowMatchesAlignedForecast,
  type TimesheetFromForecastResult,
  type TimesheetFromForecastStats,
} from "./generateProgrammeTimesheetFromForecast";
