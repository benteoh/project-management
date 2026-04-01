"use client";

import type { MouseEvent } from "react";

import { renderProgrammeHeaderLabel } from "./programmeHeaderLabel";
import { PROGRAMME_SORTABLE_HEADER_COLUMNS } from "./programmeTableHeaderConfig";
import {
  PROGRAMME_HEADER_COL_WIDE,
  programmeHeaderInteractiveButtonClass,
  programmeTableHeaderRowClassName,
} from "./programmeTableHeaderConstants";
import {
  ProgrammeTableHeaderForecastCell,
  ProgrammeTableHeaderNameCell,
} from "./programmeTableHeaderCells";
import { ProgrammeHeaderFilterIcon, ProgrammeHeaderSortIcon } from "./programmeTableHeaderIcons";
import type { ActivitySort } from "./activityQuery";
import {
  programmeIsSortedColumn,
  programmeSortDirectionFor,
  type ProgrammeSortColumn,
} from "./programmeTableSort";

type SortableHeaderButtonProps = (typeof PROGRAMME_SORTABLE_HEADER_COLUMNS)[number] & {
  sort: ActivitySort;
  onSort: (column: ProgrammeSortColumn) => void;
};

function SortableHeaderButton({
  column,
  label,
  title,
  widthClass,
  sort,
  onSort,
}: SortableHeaderButtonProps) {
  const direction = programmeSortDirectionFor(sort, column);
  const active = programmeIsSortedColumn(sort, column);

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={programmeHeaderInteractiveButtonClass(widthClass, active)}
      title={title}
    >
      {renderProgrammeHeaderLabel(label)}
      <ProgrammeHeaderSortIcon direction={direction} />
    </button>
  );
}

type ProgrammeTableHeaderProps = {
  sort: ActivitySort;
  statusFilterActive: boolean;
  onSort: (column: ProgrammeSortColumn) => void;
  onStatusFilterClick: (e: MouseEvent<HTMLElement>) => void;
};

export function ProgrammeTableHeader({
  sort,
  statusFilterActive,
  onSort,
  onStatusFilterClick,
}: ProgrammeTableHeaderProps) {
  return (
    <div className={programmeTableHeaderRowClassName}>
      <ProgrammeTableHeaderNameCell />

      {PROGRAMME_SORTABLE_HEADER_COLUMNS.map((col) => (
        <SortableHeaderButton key={col.column} {...col} sort={sort} onSort={onSort} />
      ))}

      <ProgrammeTableHeaderForecastCell />

      <button
        type="button"
        onClick={onStatusFilterClick}
        className={programmeHeaderInteractiveButtonClass(
          PROGRAMME_HEADER_COL_WIDE,
          statusFilterActive
        )}
        title="Click to filter status"
      >
        {renderProgrammeHeaderLabel("STATUS")}
        <ProgrammeHeaderFilterIcon active={statusFilterActive} />
      </button>
    </div>
  );
}
