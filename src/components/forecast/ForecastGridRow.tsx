import { cn } from "@/lib/utils";
import { formatEngineerListLabel } from "@/lib/engineer-pool-display";

import { DATE_COL_W, NO_COL_W, SUMMARY_COL_W } from "./constants";
import type { ForecastGridRow as ForecastGridRowType } from "./types";
import { toISODate } from "./utils";

type ForecastGridRowProps = {
  row: ForecastGridRowType;
  index: number;
  dailyDates: Date[];
  bankHolidays: Set<string>;
};

export function ForecastGridRow({ row, index, dailyDates, bankHolidays }: ForecastGridRowProps) {
  const { scope, engineer } = row;

  return (
    <div className="border-border flex border-b">
      <div className={`border-border ${NO_COL_W} shrink-0 border-r px-3 py-2`}>
        <span className="text-muted-foreground text-sm">{index + 1}</span>
      </div>
      <div className={`border-border ${SUMMARY_COL_W} shrink-0 border-r px-4 py-2`}>
        <span className="text-foreground text-sm">{scope.label}</span>
      </div>
      <div className={`border-border ${SUMMARY_COL_W} shrink-0 border-r px-4 py-2`}>
        <span className="text-foreground text-sm font-medium">
          {formatEngineerListLabel(engineer, engineer.code)}
        </span>
      </div>
      <div className={`border-border ${SUMMARY_COL_W} shrink-0 border-r px-4 py-2`}>
        {row.hourRate != null && (
          <span className="text-foreground text-sm tabular-nums">£{row.hourRate.toFixed(2)}</span>
        )}
      </div>
      <div className={`border-border ${SUMMARY_COL_W} shrink-0 border-r px-4 py-2`} />
      <div className={`border-border ${SUMMARY_COL_W} shrink-0 border-r px-4 py-2`} />
      {dailyDates.map((date) => {
        const dow = date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isBankHoliday = bankHolidays.has(toISODate(date));
        return (
          <div
            key={date.toISOString()}
            className={cn(
              `border-border ${DATE_COL_W} shrink-0 border-r`,
              isBankHoliday ? "bg-green-100" : isWeekend && "bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}
