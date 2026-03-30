"use client";

import { useCallback, useEffect, useState } from "react";

import { SUBTLE_FORM_INPUT_CLASS } from "@/components/ui/InlineEditableText";
import { cn } from "@/lib/utils";
import { cloneCapacityDays } from "@/lib/engineers/engineerCapacity";
import type { Engineer, EngineerCapacityDays } from "@/types/engineer-pool";

import { EngineerCapacityFields } from "./EngineerCapacityFields";
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

function cloneDays(d: EngineerCapacityDays): EngineerCapacityDays {
  return cloneCapacityDays(d);
}

type Draft = Omit<EngineerUpdatePayload, "id">;

function engineerToDraft(e: Engineer): Draft {
  return {
    firstName: e.firstName,
    lastName: e.lastName,
    isActive: e.isActive,
    capacityPerWeek: e.capacityPerWeek,
    capacityDays: cloneDays(e.capacityDays),
  };
}

function payloadDirty(engineer: Engineer, payload: EngineerUpdatePayload): boolean {
  return !(
    payload.firstName === engineer.firstName &&
    payload.lastName === engineer.lastName &&
    payload.isActive === engineer.isActive &&
    numEq(payload.capacityPerWeek, engineer.capacityPerWeek) &&
    capacityDaysEq(payload.capacityDays, engineer.capacityDays)
  );
}

export function EngineerRow({
  engineer,
  isPending,
  onUpdate,
}: {
  engineer: Engineer;
  isPending: boolean;
  onUpdate: (payload: EngineerUpdatePayload) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => engineerToDraft(engineer));

  const startEdit = useCallback(() => {
    setDraft(engineerToDraft(engineer));
    setIsEditing(true);
  }, [engineer]);

  const cancelEdit = useCallback(() => {
    setDraft(engineerToDraft(engineer));
    setIsEditing(false);
  }, [engineer]);

  const toPayload = useCallback(
    (d: Draft): EngineerUpdatePayload => ({
      id: engineer.id,
      firstName: d.firstName,
      lastName: d.lastName,
      isActive: d.isActive,
      capacityPerWeek: d.capacityPerWeek,
      capacityDays: cloneDays(d.capacityDays),
    }),
    [engineer.id]
  );

  const saveEdit = useCallback(() => {
    const payload = toPayload(draft);
    if (payloadDirty(engineer, payload)) {
      onUpdate(payload);
    }
    setIsEditing(false);
  }, [draft, engineer, onUpdate, toPayload]);

  useEffect(() => {
    if (!isEditing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditing, cancelEdit]);

  const nameBlock = (opts: { label: string; value: string; onChange?: (v: string) => void }) => (
    <div className="min-w-[min(100%,10rem)] flex-[1_1_180px]">
      <span className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
        {opts.label}
      </span>
      {opts.onChange ? (
        <input
          type="text"
          className={SUBTLE_FORM_INPUT_CLASS}
          value={opts.value}
          disabled={isPending}
          onChange={(e) => opts.onChange!(e.target.value)}
          aria-label={opts.label}
        />
      ) : (
        <p
          className={cn(
            "px-2 py-1.5 text-sm",
            opts.value.trim() ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {opts.value.trim() || "—"}
        </p>
      )}
    </div>
  );

  if (!isEditing) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Edit engineer ${engineer.firstName} ${engineer.lastName}`}
        className={cn(
          "border-border bg-card/40 shadow-card rounded-lg border p-4 text-left transition-colors",
          "hover:bg-card/70 focus-visible:ring-ring/40 cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
        )}
        onClick={startEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEdit();
          }
        }}
      >
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div className="w-[3.25rem] shrink-0">
            <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
              Code
            </span>
            <p
              className="text-foreground truncate px-0 py-0.5 text-xs leading-tight tabular-nums"
              title={`${engineer.code} — derived from name; not editable`}
            >
              {engineer.code}
            </p>
          </div>
          {nameBlock({
            label: "First name",
            value: engineer.firstName,
          })}
          {nameBlock({
            label: "Last name",
            value: engineer.lastName,
          })}
        </div>

        <EngineerCapacityFields
          readOnly
          capacityPerWeek={engineer.capacityPerWeek}
          capacityDays={engineer.capacityDays}
        />

        <div className="border-border mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
          <span className="text-muted-foreground text-sm">
            {engineer.isActive ? (
              <span className="text-foreground">Active</span>
            ) : (
              <span>Inactive</span>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border bg-card shadow-card ring-ring/20 rounded-lg border p-4 ring-1">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="w-[3.25rem] shrink-0">
          <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
            Code
          </span>
          <p
            className="text-foreground truncate px-0 py-0.5 text-xs leading-tight tabular-nums"
            title={`${engineer.code} — derived from name; not editable`}
          >
            {engineer.code}
          </p>
        </div>
        {nameBlock({
          label: "First name",
          value: draft.firstName,
          onChange: (v) => setDraft((d) => ({ ...d, firstName: v })),
        })}
        {nameBlock({
          label: "Last name",
          value: draft.lastName,
          onChange: (v) => setDraft((d) => ({ ...d, lastName: v })),
        })}
      </div>

      <EngineerCapacityFields
        capacityPerWeek={draft.capacityPerWeek}
        capacityDays={draft.capacityDays}
        disabled={isPending}
        onCapacityCommit={(capacityPerWeek, capacityDays) =>
          setDraft((d) => ({
            ...d,
            capacityPerWeek,
            capacityDays: cloneDays(capacityDays),
          }))
        }
      />

      <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="border-border rounded"
            checked={draft.isActive}
            disabled={isPending}
            onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
          />
          Active
        </label>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={cancelEdit}
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={saveEdit}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
