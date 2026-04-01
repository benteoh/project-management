"use client";

import type { ReactNode } from "react";

import { InlineEditableNumber } from "@/components/ui/InlineEditableNumber";
import {
  CAPACITY_MAX_DAY,
  CAPACITY_MAX_WEEK,
  CAPACITY_STEP,
  reconcileEngineerCapacityForSave,
} from "@/lib/engineers/engineerCapacity";

function formatHourDisplay(value: number | null, placeholder: string): string {
  if (value === null || Number.isNaN(value)) return placeholder;
  return String(value);
}

type CapacitySectionProps = { children: ReactNode };

function CapacitySection({ children }: CapacitySectionProps) {
  return (
    <div className="border-border mt-4 border-t pt-4">
      <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        Capacity (hours)
      </p>
      {children}
    </div>
  );
}

export type EngineerCapacityFieldsProps =
  | {
      readOnly: true;
      maxDailyHours: number | null;
      maxWeeklyHours: number | null;
      disabled?: boolean;
    }
  | {
      readOnly?: false;
      maxDailyHours: number | null;
      maxWeeklyHours: number | null;
      disabled?: boolean;
      onCapacityCommit: (maxDailyHours: number | null, maxWeeklyHours: number | null) => void;
    };

/**
 * Max hours per day and per week. On save, daily is capped so it cannot exceed weekly (e.g. 6h/week with 8h daily → 6h daily).
 */
export function EngineerCapacityFields(props: EngineerCapacityFieldsProps) {
  if (props.readOnly === true) {
    const { maxDailyHours, maxWeeklyHours } = props;
    return (
      <CapacitySection>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="w-[4.5rem] shrink-0">
            <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
              Daily max
            </span>
            <p className="text-foreground px-1 py-0.5 text-xs leading-tight tabular-nums">
              {formatHourDisplay(maxDailyHours, "—")}
            </p>
          </div>
          <div className="w-[4.5rem] shrink-0">
            <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
              Weekly max
            </span>
            <p className="text-foreground px-1 py-0.5 text-xs leading-tight tabular-nums">
              {formatHourDisplay(maxWeeklyHours, "—")}
            </p>
          </div>
        </div>
      </CapacitySection>
    );
  }

  const { maxDailyHours, maxWeeklyHours, disabled = false, onCapacityCommit } = props;

  const commit = (nextDaily: number | null, nextWeekly: number | null) => {
    const r = reconcileEngineerCapacityForSave(nextDaily, nextWeekly);
    onCapacityCommit(r.maxDailyHours, r.maxWeeklyHours);
  };

  return (
    <CapacitySection>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div className="w-[4.5rem] shrink-0">
          <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
            Daily max
          </span>
          <InlineEditableNumber
            value={maxDailyHours}
            disabled={disabled}
            placeholder="—"
            compact
            min={0}
            max={CAPACITY_MAX_DAY}
            step={CAPACITY_STEP}
            className="w-full shrink-0"
            onCommit={(next) => commit(next, maxWeeklyHours)}
          />
        </div>
        <div className="w-[4.5rem] shrink-0">
          <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
            Weekly max
          </span>
          <InlineEditableNumber
            value={maxWeeklyHours}
            disabled={disabled}
            placeholder="—"
            compact
            min={0}
            max={CAPACITY_MAX_WEEK}
            step={CAPACITY_STEP}
            className="w-full shrink-0"
            onCommit={(next) => commit(maxDailyHours, next)}
          />
        </div>
      </div>
    </CapacitySection>
  );
}
