"use client";

import type { ReactNode } from "react";

import { InlineEditableNumber } from "@/components/ui/InlineEditableNumber";
import {
  CAPACITY_MAX_DAY,
  CAPACITY_MAX_WEEK,
  CAPACITY_STEP,
  syncDaysFromWeek,
  syncWeekFromDays,
} from "@/lib/engineers/engineerCapacity";
import type { EngineerCapacityDays } from "@/types/engineer-pool";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

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
      capacityPerWeek: number | null;
      capacityDays: EngineerCapacityDays;
      disabled?: boolean;
    }
  | {
      readOnly?: false;
      capacityPerWeek: number | null;
      capacityDays: EngineerCapacityDays;
      disabled?: boolean;
      onCapacityCommit: (
        capacityPerWeek: number | null,
        capacityDays: EngineerCapacityDays
      ) => void;
    };

/**
 * Shared week + Mon–Fri capacity controls (settings add form and engineer rows).
 * Keeps layout and sync rules identical everywhere.
 */
export function EngineerCapacityFields(props: EngineerCapacityFieldsProps) {
  if (props.readOnly === true) {
    const { capacityPerWeek, capacityDays } = props;
    return (
      <CapacitySection>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="w-[4.5rem] shrink-0">
            <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
              Week
            </span>
            <p className="text-foreground px-1 py-0.5 text-xs leading-tight tabular-nums">
              {formatHourDisplay(capacityPerWeek, "—")}
            </p>
          </div>
          <div className="min-w-0">
            <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1">
              {WEEKDAY_LABELS.map((day, i) => (
                <div key={day} className="w-[2.75rem] shrink-0">
                  <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
                    {day}
                  </span>
                  <p className="text-foreground px-1 py-0.5 text-center text-xs leading-tight tabular-nums">
                    {formatHourDisplay(capacityDays[i], "—")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CapacitySection>
    );
  }

  const { capacityPerWeek, capacityDays, disabled = false, onCapacityCommit } = props;

  return (
    <CapacitySection>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="w-[4.5rem] shrink-0">
          <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
            Week
          </span>
          <InlineEditableNumber
            value={capacityPerWeek}
            disabled={disabled}
            placeholder="—"
            compact
            min={0}
            max={CAPACITY_MAX_WEEK}
            step={CAPACITY_STEP}
            className="w-full shrink-0"
            onCommit={(next) => {
              const { capacityPerWeek: w, capacityDays: d } = syncDaysFromWeek(next);
              onCapacityCommit(w, d);
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-nowrap items-end gap-0.5 sm:gap-1">
            {WEEKDAY_LABELS.map((day, i) => (
              <InlineEditableNumber
                key={day}
                label={day}
                value={capacityDays[i]}
                disabled={disabled}
                placeholder="—"
                compact
                min={0}
                max={CAPACITY_MAX_DAY}
                step={CAPACITY_STEP}
                className="w-[2.75rem] shrink-0"
                onCommit={(next) => {
                  const { capacityPerWeek: w, capacityDays: d } = syncWeekFromDays(
                    capacityDays,
                    i,
                    next
                  );
                  onCapacityCommit(w, d);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </CapacitySection>
  );
}
