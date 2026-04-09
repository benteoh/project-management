"use client";

import type { MouseEvent } from "react";
import { Plus } from "lucide-react";

import { renderProgrammeHeaderLabel } from "./programmeHeaderLabel";
import {
  PROGRAMME_HEADER_CELL_PAD,
  PROGRAMME_HEADER_ROW_MIN_H,
  programmeHeaderInteractiveButtonClass,
  programmeTableHeaderRowClassName,
} from "./programmeTableHeaderConstants";
import { ProgrammeHeaderFilterIcon, ProgrammeHeaderSortIcon } from "./programmeTableHeaderIcons";
import type { ActivitySort } from "./activityQuery";
import {
  programmeIsSortedColumn,
  programmeSortDirectionFor,
  type ProgrammeSortColumn,
} from "./programmeTableSort";
import { PROGRAMME_COLUMNS } from "./programmeColumns";

type ProgrammeTableHeaderProps = {
  sort: ActivitySort;
  statusFilterActive: boolean;
  onSort: (column: ProgrammeSortColumn) => void;
  onStatusFilterClick: (e: MouseEvent<HTMLElement>) => void;
  onAddScope?: () => void;
};

export function ProgrammeTableHeader({
  sort,
  statusFilterActive,
  onSort,
  onStatusFilterClick,
  onAddScope,
}: ProgrammeTableHeaderProps) {
  return (
    <div className={programmeTableHeaderRowClassName}>
      {PROGRAMME_COLUMNS.map((col) => {
        const h = col.header;

        if (h.type === "name") {
          return (
            <div
              key={col.key}
              className={`${col.widthClass} ${PROGRAMME_HEADER_ROW_MIN_H} flex items-center justify-between gap-2 px-2`}
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

        if (h.type === "sortable") {
          const direction = programmeSortDirectionFor(sort, h.sortColumn);
          const active = programmeIsSortedColumn(sort, h.sortColumn);
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => onSort(h.sortColumn)}
              className={programmeHeaderInteractiveButtonClass(col.widthClass, active)}
              title={`Click to sort by ${h.label.toLowerCase()}`}
            >
              {renderProgrammeHeaderLabel(h.label)}
              <ProgrammeHeaderSortIcon direction={direction} />
            </button>
          );
        }

        if (h.type === "static") {
          return (
            <div
              key={col.key}
              className={`${col.widthClass} ${PROGRAMME_HEADER_ROW_MIN_H} ${PROGRAMME_HEADER_CELL_PAD} flex items-center justify-center text-center`}
            >
              {renderProgrammeHeaderLabel(h.label)}
            </div>
          );
        }

        if (h.type === "status-filter") {
          return (
            <button
              key={col.key}
              type="button"
              onClick={onStatusFilterClick}
              className={programmeHeaderInteractiveButtonClass(col.widthClass, statusFilterActive)}
              title="Click to filter status"
            >
              {renderProgrammeHeaderLabel("STATUS")}
              <ProgrammeHeaderFilterIcon active={statusFilterActive} />
            </button>
          );
        }
      })}
    </div>
  );
}
