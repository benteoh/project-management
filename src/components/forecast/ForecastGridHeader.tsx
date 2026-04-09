import type { MouseEvent } from "react";

import { FilterFunnelIcon } from "@/components/ui/FilterFunnelIcon";
import { cn } from "@/lib/utils";

import { DATE_COL_W, NO_COL_W, SUMMARY_COL_W, SUMMARY_LABELS } from "./constants";
import type { ForecastFilterColumn } from "./types";
import { toISODate } from "./utils";

type ForecastGridHeaderProps = {
  dailyDates: Date[];
  bankHolidays: Set<string>;
  scopeFilterActive: boolean;
  personFilterActive: boolean;
  onOpenFilter: (column: ForecastFilterColumn, e: MouseEvent<HTMLButtonElement>) => void;
};

export function ForecastGridHeader({
  dailyDates,
  bankHolidays,
  scopeFilterActive,
  personFilterActive,
  onOpenFilter,
}: ForecastGridHeaderProps) {
  return (
    <div className="border-border flex border-b">
      <div className={`border-border flex ${NO_COL_W} shrink-0 items-center border-r px-3 py-3`}>
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          No.
        </span>
      </div>

      {SUMMARY_LABELS.map((label) => {
        const isFilterable = label === "Scope" || label === "Person";
        const column: ForecastFilterColumn = label === "Scope" ? "scope" : "person";
        const isActive =
          (label === "Scope" && scopeFilterActive) || (label === "Person" && personFilterActive);

        return (
          <div
            key={label}
            className={cn(
              `border-border flex ${SUMMARY_COL_W} shrink-0 items-center justify-between border-r px-4 py-3`
            )}
          >
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {label}
            </span>
            {isFilterable && (
              <button
                type="button"
                onClick={(e) => onOpenFilter(column, e)}
                title={`Filter ${label}`}
                className={`ml-1 rounded p-0.5 transition-colors ${isActive ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}
              >
                <FilterFunnelIcon />
              </button>
            )}
          </div>
        );
      })}

      {dailyDates.map((date) => {
        const dow = date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isBankHoliday = bankHolidays.has(toISODate(date));
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yyyy = date.getFullYear();
        return (
          <div
            key={date.toISOString()}
            className={cn(
              `border-border flex ${DATE_COL_W} shrink-0 items-center justify-center border-r py-2`,
              isBankHoliday ? "bg-green-100" : isWeekend && "bg-muted"
            )}
          >
            <span
              className="text-muted-foreground text-xs"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              {dd}/{mm}/{yyyy}
            </span>
          </div>
        );
      })}
    </div>
  );
}
