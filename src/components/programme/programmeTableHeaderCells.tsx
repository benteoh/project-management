import {
  PROGRAMME_HEADER_CELL_PAD,
  PROGRAMME_HEADER_COL_WIDE,
  PROGRAMME_HEADER_ROW_MIN_H,
} from "./programmeTableHeaderConstants";

export function ProgrammeTableHeaderNameCell() {
  return (
    <div className={`min-w-0 flex-1 px-2 ${PROGRAMME_HEADER_ROW_MIN_H} flex items-center`}>
      Activity Name
    </div>
  );
}

export function ProgrammeTableHeaderForecastCell() {
  return (
    <div
      className={`${PROGRAMME_HEADER_COL_WIDE} ${PROGRAMME_HEADER_ROW_MIN_H} ${PROGRAMME_HEADER_CELL_PAD} flex items-center justify-center text-center`}
    >
      Forecast Hours
    </div>
  );
}
