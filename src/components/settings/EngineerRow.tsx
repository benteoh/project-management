"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { InlineEditableNumber } from "@/components/ui/InlineEditableNumber";
import { InlineEditableText } from "@/components/ui/InlineEditableText";
import type { Engineer, EngineerCapacityDays } from "@/types/engineer-pool";

import type { EngineerUpdatePayload } from "./types";

function numEq(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 1e-9;
}

function capacityDaysEq(a: EngineerCapacityDays, b: EngineerCapacityDays): boolean {
  for (let i = 0; i < 5; i++) {
    if (!numEq(a[i], b[i])) return false;
  }
  return true;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function cloneDays(d: EngineerCapacityDays): EngineerCapacityDays {
  return [d[0], d[1], d[2], d[3], d[4]];
}

export function EngineerRow({
  engineer,
  isPending,
  onUpdate,
  onDelete,
}: {
  engineer: Engineer;
  isPending: boolean;
  onUpdate: (payload: EngineerUpdatePayload) => void;
  onDelete: (id: string) => void;
}) {
  const [code, setCode] = useState(engineer.code);
  const [firstName, setFirstName] = useState(engineer.firstName);
  const [lastName, setLastName] = useState(engineer.lastName);
  const [isActive, setIsActive] = useState(engineer.isActive);
  const [capacityPerWeek, setCapacityPerWeek] = useState(engineer.capacityPerWeek);
  const [capacityDays, setCapacityDays] = useState<EngineerCapacityDays>(() =>
    cloneDays(engineer.capacityDays)
  );

  useEffect(() => {
    setCode(engineer.code);
    setFirstName(engineer.firstName);
    setLastName(engineer.lastName);
    setIsActive(engineer.isActive);
    setCapacityPerWeek(engineer.capacityPerWeek);
    setCapacityDays(cloneDays(engineer.capacityDays));
  }, [engineer]);

  const toPayload = (): EngineerUpdatePayload => ({
    id: engineer.id,
    code,
    firstName,
    lastName,
    isActive,
    capacityPerWeek,
    capacityDays: cloneDays(capacityDays),
  });

  const saveIfChanged = (payload: EngineerUpdatePayload) => {
    if (
      payload.code === engineer.code &&
      payload.firstName === engineer.firstName &&
      payload.lastName === engineer.lastName &&
      payload.isActive === engineer.isActive &&
      numEq(payload.capacityPerWeek, engineer.capacityPerWeek) &&
      capacityDaysEq(payload.capacityDays, engineer.capacityDays)
    ) {
      return;
    }
    onUpdate(payload);
  };

  return (
    <div className="border-border bg-card/40 shadow-card rounded-lg border p-4">
      <div className="flex flex-wrap gap-x-8 gap-y-5">
        <InlineEditableText
          label="Code"
          value={code}
          disabled={isPending}
          placeholder="Code"
          className="min-w-[min(100%,10rem)] flex-[1_1_160px]"
          onCommit={(next) => {
            setCode(next);
            saveIfChanged({ ...toPayload(), code: next });
          }}
        />
        <InlineEditableText
          label="First name"
          value={firstName}
          disabled={isPending}
          placeholder="First name"
          className="min-w-[min(100%,10rem)] flex-[1_1_180px]"
          onCommit={(next) => {
            setFirstName(next);
            saveIfChanged({ ...toPayload(), firstName: next });
          }}
        />
        <InlineEditableText
          label="Last name"
          value={lastName}
          disabled={isPending}
          placeholder="Last name"
          className="min-w-[min(100%,10rem)] flex-[1_1_180px]"
          onCommit={(next) => {
            setLastName(next);
            saveIfChanged({ ...toPayload(), lastName: next });
          }}
        />
      </div>

      <div className="border-border mt-5 border-t pt-5">
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          Capacity (hours)
        </p>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <InlineEditableNumber
            label="Per week"
            value={capacityPerWeek}
            disabled={isPending}
            placeholder="—"
            className="min-w-[min(100%,7rem)] flex-[0_1_120px]"
            onCommit={(next) => {
              setCapacityPerWeek(next);
              saveIfChanged({ ...toPayload(), capacityPerWeek: next });
            }}
          />
          <div className="min-w-0 flex-[1_1_280px]">
            <span className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
              Per weekday
            </span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((day, i) => (
                <InlineEditableNumber
                  key={day}
                  label={day}
                  value={capacityDays[i]}
                  disabled={isPending}
                  placeholder="—"
                  className="min-w-[3.25rem] flex-1 basis-[3.25rem]"
                  onCommit={(next) => {
                    const nextDays: EngineerCapacityDays = cloneDays(capacityDays);
                    nextDays[i] = next;
                    setCapacityDays(nextDays);
                    saveIfChanged({ ...toPayload(), capacityDays: nextDays });
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="border-border rounded"
            checked={isActive}
            disabled={isPending}
            onChange={(e) => {
              const next = e.target.checked;
              setIsActive(next);
              saveIfChanged({ ...toPayload(), isActive: next });
            }}
          />
          Active
        </label>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onDelete(engineer.id)}
          className="text-status-critical border-border hover:bg-status-critical-bg inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60"
        >
          <Trash2 size={14} strokeWidth={2} aria-hidden />
          Remove
        </button>
      </div>
    </div>
  );
}
