"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseProgrammeDate, formatProgrammeDate, MONTH_NAMES, DAY_NAMES } from "./dateUtils";

export function MiniCalendar({
  value,
  anchorRect,
  onChange,
  onClose,
}: {
  value: string;
  anchorRect: { top: number; left: number; width: number; height: number };
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const parsed = parseProgrammeDate(value);
  const [view, setView] = useState<Date>(parsed ?? new Date());
  const year = view.getFullYear();
  const month = view.getMonth();

  const firstDow = (() => {
    const d = new Date(year, month, 1).getDay() - 1;
    return d < 0 ? 6 : d;
  })();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <div className="fixed inset-0 z-[99]" onClick={onClose} />
      <div
        className="border-border bg-card shadow-elevated fixed z-[100] w-56 rounded-lg border p-3"
        style={{ top: anchorRect.top + anchorRect.height + 4, left: anchorRect.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="mb-2.5 flex items-center justify-between">
          <button
            className="text-muted-foreground hover:bg-muted rounded p-1"
            onClick={() => setView(new Date(year, month - 1, 1))}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-foreground text-xs font-semibold">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            className="text-muted-foreground hover:bg-muted rounded p-1"
            onClick={() => setView(new Date(year, month + 1, 1))}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="mb-1 grid grid-cols-7">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="text-muted-foreground py-0.5 text-center text-[10px] font-medium"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const isSelected =
              parsed &&
              parsed.getFullYear() === year &&
              parsed.getMonth() === month &&
              parsed.getDate() === day;
            return (
              <div key={i} className="flex justify-center">
                <button
                  className={`h-7 w-7 rounded-full text-xs transition-colors ${
                    isSelected
                      ? "bg-foreground text-background font-semibold"
                      : "text-foreground hover:bg-muted"
                  }`}
                  onClick={() => {
                    onChange(formatProgrammeDate(new Date(year, month, day)));
                    onClose();
                  }}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
