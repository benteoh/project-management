"use client";

import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

/** Matches programme grid edit affordance: calm surface, ring on hover/focus. */
const DISPLAY_SURFACE =
  "w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:border-border hover:bg-muted/50 focus-visible:border-ring focus-visible:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40";

const EDIT_SURFACE =
  "w-full min-w-0 rounded-md border border-ring bg-card px-2 py-1.5 text-sm text-foreground outline-none ring-1 ring-ring/20";

/** Always-visible inputs (e.g. add form) — same hover/focus language as inline edit. */
export const SUBTLE_FORM_INPUT_CLASS =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-foreground transition-colors hover:border-border hover:bg-muted/50 focus:border-ring focus:bg-card focus:outline-none focus:ring-1 focus:ring-ring/40";

export type InlineEditableTextProps = {
  value: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Shown above the control (caption style). */
  label?: string;
  className?: string;
  /** Applied to the visible value (display, edit input, disabled text). */
  valueClassName?: string;
  /** For input id / aria */
  id?: string;
};

/**
 * Read-only-looking field: hover reveals affordance; click to edit; commit on blur (and Enter).
 * Reusable pattern aligned with programme row inline editing.
 */
export function InlineEditableText({
  value,
  onCommit,
  disabled = false,
  placeholder = "—",
  label,
  className,
  valueClassName,
  id: idProp,
}: InlineEditableTextProps) {
  const genId = useId();
  const id = idProp ?? `inline-edit-${genId}`;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== value.trim()) {
      onCommit(next);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (disabled) {
    return (
      <div className={cn("min-w-0", className)}>
        {label && (
          <label
            htmlFor={id}
            className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase"
          >
            {label}
          </label>
        )}
        <p className={cn("text-muted-foreground px-2 py-1.5 text-sm", valueClassName)}>
          {value || placeholder}
        </p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className={cn("min-w-0", className)}>
        {label && (
          <label
            htmlFor={id}
            className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase"
          >
            {label}
          </label>
        )}
        <input
          id={id}
          autoFocus
          className={cn(EDIT_SURFACE, valueClassName)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <span
          id={`${id}-label`}
          className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase"
        >
          {label}
        </span>
      )}
      <button
        type="button"
        id={id}
        aria-labelledby={label ? `${id}-label` : undefined}
        className={DISPLAY_SURFACE}
        onClick={() => setEditing(true)}
      >
        <span className={cn(value ? "text-foreground" : "text-muted-foreground", valueClassName)}>
          {value || placeholder}
        </span>
      </button>
    </div>
  );
}
