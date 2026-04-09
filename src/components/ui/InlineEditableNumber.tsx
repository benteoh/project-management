"use client";

import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

const DISPLAY_SURFACE =
  "w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-sm text-foreground tabular-nums transition-colors hover:border-border hover:bg-muted/50 focus-visible:border-ring focus-visible:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40";

const DISPLAY_SURFACE_COMPACT =
  "w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-left text-xs text-foreground tabular-nums transition-colors hover:border-border hover:bg-muted/50 focus-visible:border-ring focus-visible:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40";

const EDIT_SURFACE =
  "no-input-spinner w-full min-w-0 rounded-md border border-ring bg-card px-2 py-1.5 text-sm text-foreground tabular-nums outline-none ring-1 ring-ring/20";

const EDIT_SURFACE_COMPACT =
  "no-input-spinner w-full min-w-0 rounded-md border border-ring bg-card px-1 py-0.5 text-xs text-foreground tabular-nums outline-none ring-1 ring-ring/20";

function formatDisplay(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "";
  return String(value);
}

function parseInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export type InlineEditableNumberProps = {
  value: number | null;
  onCommit: (next: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
  id?: string;
  min?: number;
  max?: number;
  step?: number | string;
  /** Tighter padding and text for dense grids (e.g. capacity weekday row). */
  compact?: boolean;
};

/** Same interaction model as {@link InlineEditableText}, for numeric hours. */
export function InlineEditableNumber({
  value,
  onCommit,
  disabled = false,
  placeholder = "—",
  label,
  className,
  id: idProp,
  min = 0,
  max,
  step = 0.5,
  compact = false,
}: InlineEditableNumberProps) {
  const genId = useId();
  const id = idProp ?? `inline-num-${genId}`;
  const displaySurface = compact ? DISPLAY_SURFACE_COMPACT : DISPLAY_SURFACE;
  const editSurface = compact ? EDIT_SURFACE_COMPACT : EDIT_SURFACE;
  const labelClass = compact
    ? "text-muted-foreground mb-0.5 block text-[10px] font-medium uppercase tracking-wide"
    : "text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => formatDisplay(value));

  useEffect(() => {
    setDraft(formatDisplay(value));
  }, [value]);

  const valuesEqual = (a: number | null, b: number | null) => {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return Math.abs(a - b) < 1e-9;
  };

  const commit = () => {
    setEditing(false);
    const next = parseInput(draft);
    if (!valuesEqual(next, value)) {
      onCommit(next);
    }
  };

  const cancel = () => {
    setDraft(formatDisplay(value));
    setEditing(false);
  };

  if (disabled) {
    return (
      <div className={cn("min-w-0", className)}>
        {label && <span className={labelClass}>{label}</span>}
        <p
          className={cn(
            "text-muted-foreground tabular-nums",
            compact ? "px-1 py-0.5 text-xs" : "px-2 py-1.5 text-sm"
          )}
        >
          {value !== null ? formatDisplay(value) : placeholder}
        </p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className={cn("min-w-0", className)}>
        {label && (
          <label htmlFor={id} className={labelClass}>
            {label}
          </label>
        )}
        <input
          id={id}
          type="number"
          autoFocus
          min={min}
          max={max}
          step={step}
          className={editSurface}
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
        <span id={`${id}-label`} className={labelClass}>
          {label}
        </span>
      )}
      <button type="button" id={id} className={displaySurface} onClick={() => setEditing(true)}>
        <span className={value !== null ? "text-foreground" : "text-muted-foreground"}>
          {value !== null ? formatDisplay(value) : placeholder}
        </span>
      </button>
    </div>
  );
}
