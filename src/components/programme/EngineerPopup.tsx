"use client";

import { useRef, useState, type RefObject } from "react";
import { Plus, X } from "lucide-react";

import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { formatEngineerListLabel, formatEngineerPickerLabel } from "@/lib/engineer-pool-display";
import { useAnchoredFixedPosition } from "@/components/ui/useAnchoredFixedPosition";

import type { EngineerAllocation } from "./types";

export function EngineerPopup({
  engineers,
  engineerPool,
  rect,
  anchorRef,
  onChangeEngineers,
  onClose,
}: {
  engineers: EngineerAllocation[];
  engineerPool: EngineerPoolEntry[];
  rect: { top: number; left: number; width: number; height: number };
  /** Live anchor (engineer chip); keeps the popup aligned while the programme scrolls. */
  anchorRef: RefObject<HTMLElement | null>;
  onChangeEngineers: (engs: EngineerAllocation[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EngineerAllocation[]>(engineers);
  const popupRef = useRef<HTMLDivElement>(null);

  const changeEngineerId = (idx: number, engineerId: string) =>
    setDraft((prev) => prev.map((eng, i) => (i === idx ? { ...eng, engineerId } : eng)));

  const setPlannedHrs = (idx: number, raw: string) => {
    setDraft((prev) =>
      prev.map((eng, i) => {
        if (i !== idx) return eng;
        if (raw.trim() === "") return { ...eng, plannedHrs: null };
        const n = parseFloat(raw);
        if (Number.isNaN(n)) return eng;
        return { ...eng, plannedHrs: Math.round(n * 100) / 100 };
      })
    );
  };

  const setForecastHrs = (idx: number, raw: string) => {
    setDraft((prev) =>
      prev.map((eng, i) => {
        if (i !== idx) return eng;
        if (raw.trim() === "") return { ...eng, forecastHrs: null };
        const n = parseFloat(raw);
        if (Number.isNaN(n)) return eng;
        return { ...eng, forecastHrs: Math.round(n * 100) / 100 };
      })
    );
  };

  const remove = (idx: number) => setDraft((prev) => prev.filter((_, i) => i !== idx));

  const addRow = () =>
    setDraft((prev) => [
      ...prev,
      {
        engineerId: engineerPool[0]?.id ?? "",
        isLead: false,
        plannedHrs: null,
        forecastHrs: null,
      },
    ]);

  const handleAdd = () => {
    onChangeEngineers(draft);
    onClose();
  };

  const { top, left } = useAnchoredFixedPosition({
    anchorRect: rect,
    elementRef: popupRef,
    anchorRef,
    offset: 6,
    viewportPadding: 8,
  });

  return (
    <div
      ref={popupRef}
      className="border-border bg-card shadow-elevated pointer-events-auto fixed z-[119] w-[min(100vw-1rem,26rem)] rounded-lg border sm:max-w-none"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Engineer Allocation
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-border text-muted-foreground border-b">
              <th className="pb-1.5 text-left font-medium">Engineer</th>
              <th className="w-[4.5rem] pr-1 pb-1.5 text-right font-medium">Planned</th>
              <th className="w-[4.5rem] pr-1 pb-1.5 text-right font-medium">Forecast</th>
              <th className="w-5 pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {draft.map((eng, idx) => (
              <tr key={idx} className="border-border/60 border-b last:border-0">
                <td className="py-1.5 pr-2">
                  <select
                    className="border-border bg-background focus:ring-ring max-w-full rounded border px-1 py-0.5 text-xs focus:ring-1 focus:outline-none"
                    value={eng.engineerId}
                    onChange={(e) => changeEngineerId(idx, e.target.value)}
                  >
                    {engineerPool.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatEngineerPickerLabel(p)}
                      </option>
                    ))}
                    {!engineerPool.some((p) => p.id === eng.engineerId) && eng.engineerId && (
                      <option value={eng.engineerId}>
                        {formatEngineerListLabel(undefined, eng.engineerId)}
                      </option>
                    )}
                  </select>
                </td>
                <td className="py-1.5 pr-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    aria-label="Planned hours"
                    className="border-border bg-background focus:ring-ring w-full min-w-0 rounded border px-1 py-0.5 text-right text-xs tabular-nums focus:ring-1 focus:outline-none"
                    value={eng.plannedHrs ?? ""}
                    onChange={(e) => setPlannedHrs(idx, e.target.value)}
                  />
                </td>
                <td className="py-1.5 pr-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    aria-label="Forecast hours"
                    className="border-border bg-background focus:ring-ring w-full min-w-0 rounded border px-1 py-0.5 text-right text-xs tabular-nums focus:ring-1 focus:outline-none"
                    value={eng.forecastHrs ?? ""}
                    onChange={(e) => setForecastHrs(idx, e.target.value)}
                  />
                </td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={addRow}
          className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1 text-xs"
        >
          <Plus size={11} /> Add engineer
        </button>
      </div>

      <div className="border-border flex justify-end gap-2 border-t px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm hover:opacity-90"
        >
          Update
        </button>
      </div>
    </div>
  );
}
