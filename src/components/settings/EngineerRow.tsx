"use client";

import { useState } from "react";

import type { Engineer } from "@/types/engineer-pool";

import type { EngineerUpdatePayload } from "./types";

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

  return (
    <div className="border-border grid grid-cols-[1.2fr_1.4fr_1.4fr_0.8fr_120px] gap-2 border-b px-3 py-2">
      <input
        className="border-border bg-card rounded-md border px-2 py-1.5 text-sm"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <input
        className="border-border bg-card rounded-md border px-2 py-1.5 text-sm"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <input
        className="border-border bg-card rounded-md border px-2 py-1.5 text-sm"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onUpdate({ id: engineer.id, code, firstName, lastName, isActive })}
          className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onDelete(engineer.id)}
          className="text-status-critical border-border rounded-md border px-2 py-1 text-xs disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
