"use client";

import { useCallback, useEffect, useState } from "react";

import { SUBTLE_FORM_INPUT_CLASS } from "@/components/ui/InlineEditableText";
import { cn } from "@/lib/utils";
import type { Office } from "@/types/office";

type OfficeDraft = { name: string; location: string };

export function OfficeRow({
  office,
  isPending,
  onUpdate,
  onDelete,
}: {
  office: Office;
  isPending: boolean;
  onUpdate: (id: string, draft: OfficeDraft) => void;
  onDelete: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<OfficeDraft>({
    name: office.name,
    location: office.location,
  });

  const startEdit = useCallback(() => {
    setDraft({ name: office.name, location: office.location });
    setIsEditing(true);
  }, [office]);

  const cancelEdit = useCallback(() => {
    setDraft({ name: office.name, location: office.location });
    setIsEditing(false);
  }, [office]);

  const saveEdit = useCallback(() => {
    onUpdate(office.id, draft);
    setIsEditing(false);
  }, [office.id, draft, onUpdate]);

  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditing, cancelEdit]);

  if (!isEditing) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Edit office ${office.name}`}
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
        <p className="text-foreground text-sm font-medium">{office.name}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{office.location}</p>
      </div>
    );
  }

  return (
    <div className="border-border bg-card shadow-card ring-ring/20 rounded-lg border p-4 ring-1">
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
            Name
          </span>
          <input
            className={SUBTLE_FORM_INPUT_CLASS}
            value={draft.name}
            disabled={isPending}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
            Location
          </span>
          <input
            className={SUBTLE_FORM_INPUT_CLASS}
            value={draft.location}
            disabled={isPending}
            onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
          />
        </label>
      </div>

      <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onDelete(office.id)}
          className="text-status-critical hover:bg-status-critical-bg rounded-md px-2 py-1.5 text-sm transition-colors disabled:opacity-60"
        >
          Delete
        </button>
        <div className="flex items-center gap-2">
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
