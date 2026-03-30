"use client";

import { useState } from "react";

import { EngineerRow } from "./EngineerRow";
import { Field } from "./Field";
import { useEngineerManager } from "./useEngineerManager";

export function EngineerManager() {
  const vm = useEngineerManager();

  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isActive, setIsActive] = useState(true);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
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
        className="border-border bg-background grid grid-cols-5 items-end gap-2 rounded-lg border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          vm.create({ code, firstName, lastName, isActive });
          setCode("");
          setFirstName("");
          setLastName("");
          setIsActive(true);
        }}
      >
        <Field label="Code">
          <input
            className="border-border bg-card w-full rounded-md border px-2 py-1.5 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="JDo"
          />
        </Field>
        <Field label="First name">
          <input
            className="border-border bg-card w-full rounded-md border px-2 py-1.5 text-sm"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="John"
          />
        </Field>
        <Field label="Last name">
          <input
            className="border-border bg-card w-full rounded-md border px-2 py-1.5 text-sm"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Doe"
          />
        </Field>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
        <button
          type="submit"
          disabled={vm.isPending}
          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm disabled:opacity-60"
        >
          Add engineer
        </button>
      </form>

      <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="border-border bg-muted grid grid-cols-[1.2fr_1.4fr_1.4fr_0.8fr_120px] gap-2 border-b px-3 py-2 text-xs font-semibold tracking-wide uppercase">
          <span>Code</span>
          <span>First Name</span>
          <span>Last Name</span>
          <span>Active</span>
          <span>Actions</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
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
            <p className="text-muted-foreground p-4 text-sm">No engineers yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
