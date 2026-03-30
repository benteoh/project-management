"use client";

import { useMemo, useState } from "react";

import { deriveEngineerCodeBase } from "@/lib/engineers/engineerCode";
import { cloneCapacityDays, reconcileCapacityForSave } from "@/lib/engineers/engineerCapacity";
import { SUBTLE_FORM_INPUT_CLASS } from "@/components/ui/InlineEditableText";
import type { EngineerCapacityDays } from "@/types/engineer-pool";

import { EngineerCapacityFields } from "./EngineerCapacityFields";
import { EngineerRow } from "./EngineerRow";
import { Field } from "./Field";
import { DEFAULT_ENGINEER_CAPACITY } from "./types";
import { useEngineerManager } from "./useEngineerManager";

function cloneDays(d: EngineerCapacityDays): EngineerCapacityDays {
  return cloneCapacityDays(d);
}

export function EngineerManager() {
  const vm = useEngineerManager();

  const [showAddForm, setShowAddForm] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [capacityPerWeek, setCapacityPerWeek] = useState<number | null>(
    DEFAULT_ENGINEER_CAPACITY.capacityPerWeek
  );
  const [capacityDays, setCapacityDays] = useState<EngineerCapacityDays>(() =>
    cloneDays(DEFAULT_ENGINEER_CAPACITY.capacityDays)
  );

  const codePreview = useMemo(
    () => deriveEngineerCodeBase(firstName, lastName),
    [firstName, lastName]
  );

  const resetAddForm = () => {
    setFirstName("");
    setLastName("");
    setIsActive(true);
    setCapacityPerWeek(DEFAULT_ENGINEER_CAPACITY.capacityPerWeek);
    setCapacityDays(cloneDays(DEFAULT_ENGINEER_CAPACITY.capacityDays));
  };

  const handleCancelAdd = () => {
    resetAddForm();
    setShowAddForm(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <p className="text-muted-foreground shrink-0 text-xs">Manage engineer records.</p>
      {vm.isLoading && vm.sortedEngineers.length === 0 && (
        <p className="text-muted-foreground text-sm">Loading engineers…</p>
      )}
      {vm.error && (
        <div className="border-border bg-status-critical-bg text-status-critical rounded-md border px-3 py-2 text-sm">
          {vm.error}
        </div>
      )}

      {!showAddForm ? (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="border-border bg-background text-foreground hover:bg-muted w-fit rounded-md border px-4 py-2 text-sm font-medium"
        >
          Add engineer
        </button>
      ) : (
        <form
          className="border-border bg-card/40 shadow-card rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setIsSavingAdd(true);
              try {
                const cap = reconcileCapacityForSave(capacityPerWeek, capacityDays);
                const ok = await vm.create({
                  firstName,
                  lastName,
                  isActive,
                  capacityPerWeek: cap.capacityPerWeek,
                  capacityDays: cloneDays(cap.capacityDays),
                });
                if (ok) {
                  resetAddForm();
                  setShowAddForm(false);
                }
              } finally {
                setIsSavingAdd(false);
              }
            })();
          }}
        >
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <div className="w-[3.25rem] shrink-0">
              <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
                Code
              </span>
              <p className="text-muted-foreground text-xs leading-tight tabular-nums">
                {firstName.trim() && lastName.trim() ? (
                  <>
                    <span
                      className="text-foreground block truncate font-medium"
                      title={codePreview}
                    >
                      {codePreview}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <Field label="First name">
              <input
                className={SUBTLE_FORM_INPUT_CLASS}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                autoFocus
                required
              />
            </Field>
            <Field label="Last name">
              <input
                className={SUBTLE_FORM_INPUT_CLASS}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
              />
            </Field>
          </div>

          <EngineerCapacityFields
            capacityPerWeek={capacityPerWeek}
            capacityDays={capacityDays}
            disabled={vm.isPending || isSavingAdd}
            onCapacityCommit={(w, d) => {
              setCapacityPerWeek(w);
              setCapacityDays(d);
            }}
          />

          <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="border-border rounded"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCancelAdd}
                className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={vm.isPending || isSavingAdd}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                Save engineer
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {vm.sortedEngineers.map((engineer) => (
          <EngineerRow
            key={engineer.id}
            engineer={engineer}
            isPending={vm.isPending}
            onUpdate={vm.update}
          />
        ))}
        {!vm.isLoading && vm.sortedEngineers.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">No engineers yet.</p>
        )}
      </div>
    </div>
  );
}
