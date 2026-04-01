import { Plus } from "lucide-react";

import {
  PROGRAMME_HEADER_CELL_PAD,
  PROGRAMME_HEADER_COL_WIDE,
  PROGRAMME_HEADER_ROW_MIN_H,
} from "./programmeTableHeaderConstants";

type ProgrammeTableHeaderNameCellProps = {
  onAddScope?: () => void;
};

export function ProgrammeTableHeaderNameCell({ onAddScope }: ProgrammeTableHeaderNameCellProps) {
  return (
    <div
      className={`min-w-0 flex-1 px-2 ${PROGRAMME_HEADER_ROW_MIN_H} flex items-center justify-between gap-2`}
    >
      <span className="min-w-0">Activity Name</span>
      {onAddScope && (
        <button
          type="button"
          onClick={onAddScope}
          className="text-foreground hover:bg-muted border-border inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
        >
          <Plus size={14} className="text-muted-foreground" aria-hidden />
          Scope
        </button>
      )}
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
