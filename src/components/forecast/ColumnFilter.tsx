"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ColumnFilterProps = {
  options: string[];
  /** null = all selected (no filter active) */
  selected: Set<string> | null;
  /** Bounding rect of the button that opened this dropdown */
  anchorRect: DOMRect;
  onChange: (next: Set<string> | null) => void;
  onClose: () => void;
};

export function ColumnFilter({
  options,
  selected,
  anchorRect,
  onChange,
  onClose,
}: ColumnFilterProps) {
  const sortedOptions = useMemo(() => [...options].sort(), [options]);

  // Local checked state — initialise from `selected` (null = all checked)
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selected ?? sortedOptions));
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const allChecked = checked.size === sortedOptions.length;
  const visible = search
    ? sortedOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : sortedOptions;

  function toggle(value: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  }

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(sortedOptions));
  }

  function apply() {
    if (checked.size === 0) {
      // Nothing selected — keep previous state, just close
      onClose();
      return;
    }
    onChange(checked.size === sortedOptions.length ? null : new Set(checked));
    onClose();
  }

  // Close on click outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
    zIndex: 9999,
    minWidth: 200,
  };

  return createPortal(
    <div
      ref={containerRef}
      style={style}
      className="bg-card border-border shadow-elevated rounded-lg border text-sm"
    >
      {/* Search */}
      <div className="border-border border-b px-3 py-2">
        <input
          autoFocus
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-border text-foreground placeholder:text-muted-foreground w-full rounded-md border px-2 py-1 text-xs focus:outline-none"
        />
      </div>

      {/* Select all */}
      <div className="border-border border-b px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="accent-gold"
          />
          <span className="text-foreground text-xs font-medium">Select All</span>
        </label>
      </div>

      {/* Options */}
      <div className="max-h-52 overflow-y-auto px-3 py-1">
        {visible.length === 0 ? (
          <p className="text-muted-foreground py-2 text-xs">No results</p>
        ) : (
          visible.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={checked.has(opt)}
                onChange={() => toggle(opt)}
                className="accent-gold"
              />
              <span className="text-foreground text-xs">{opt}</span>
            </label>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-border flex justify-end gap-2 border-t px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          className="bg-gold rounded-md px-3 py-1 text-xs font-medium text-white"
        >
          OK
        </button>
      </div>
    </div>,
    document.body
  );
}
