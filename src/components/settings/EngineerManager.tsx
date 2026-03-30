"use client";

import { useState } from "react";

import { SUBTLE_FORM_INPUT_CLASS } from "@/components/ui/InlineEditableText";

import { EngineerRow } from "./EngineerRow";
import { Field } from "./Field";
import { DEFAULT_ENGINEER_CAPACITY } from "./types";
import { useEngineerManager } from "./useEngineerManager";

export function EngineerManager() {
  const vm = useEngineerManager();

  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isActive, setIsActive] = useState(true);

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

      <form
        className="border-border bg-background flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          vm.create({
            code,
            firstName,
            lastName,
            isActive,
            ...DEFAULT_ENGINEER_CAPACITY,
          });
          setCode("");
          setFirstName("");
          setLastName("");
          setIsActive(true);
        }}
      >
        <Field label="Code">
          <input
            className={SUBTLE_FORM_INPUT_CLASS}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="JDo"
          />
        </Field>
        <Field label="First name">
          <input
            className={SUBTLE_FORM_INPUT_CLASS}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="John"
          />
        </Field>
        <Field label="Last name">
          <input
            className={SUBTLE_FORM_INPUT_CLASS}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Doe"
          />
        </Field>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="border-border rounded"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
        <button
          type="submit"
          disabled={vm.isPending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          Add engineer
        </button>
      </form>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {vm.sortedEngineers.map((engineer) => (
          <EngineerRow
            key={engineer.id}
            engineer={engineer}
            isPending={vm.isPending}
            onUpdate={vm.update}
            onDelete={vm.remove}
          />
        ))}
        {!vm.isLoading && vm.sortedEngineers.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">No engineers yet.</p>
        )}
      </div>
    </div>
  );
}
