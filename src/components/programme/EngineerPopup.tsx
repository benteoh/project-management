"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { Plus, X } from "lucide-react";

import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { DEFAULT_MAX_WEEKLY_HOURS } from "@/types/engineer-pool";
import type { ForecastHoursPerEngineer } from "@/types/forecast-scope";
import { formatEngineerListLabel, formatEngineerPickerLabel } from "@/lib/engineer-pool-display";
import { useAnchoredFixedPosition } from "@/components/ui/useAnchoredFixedPosition";

import {
  SCOPE_RATE_SLOTS,
  deriveScopeRateFromAllocations,
  normalizeScopeRate,
  type ScopeRateSlot,
} from "@/lib/programme/scopeRateSlots";
import { renderProgrammeHeaderLabel } from "./programmeHeaderLabel";
import { programmeTableHeaderRowClassName } from "./programmeTableHeaderConstants";
import type { EngineerAllocation } from "./types";

/** Match programme table rhythm; popup is slightly tighter than the main grid. */
const COL_ENGINEER = "min-w-0 flex-1";
const COL_HOURS = "w-[4.5rem] min-w-[4.5rem] shrink-0 px-1 py-1 text-center";
/** Icon-only control — keep narrow so hour columns stay visually under their headers. */
const COL_ACTION = "w-7 shrink-0 flex items-center justify-center";
const POPUP_HEADER_ROW = `${programmeTableHeaderRowClassName} !py-1`;

export function EngineerPopup({
  engineers,
  engineerPool,
  forecastByEngineer,
  rect,
  anchorRef,
  onChangeEngineers,
  onClose,
}: {
  engineers: EngineerAllocation[];
  engineerPool: EngineerPoolEntry[];
  /** Per-engineer totals from `forecast_entries` (Demand Forecast grid) — read-only display. */
  forecastByEngineer: ForecastHoursPerEngineer[];
  rect: { top: number; left: number; width: number; height: number };
  /** Live anchor (engineer chip); keeps the popup aligned while the programme scrolls. */
  anchorRef: RefObject<HTMLElement | null>;
  onChangeEngineers: (engs: EngineerAllocation[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EngineerAllocation[]>(engineers);
  const [scopeRate, setScopeRate] = useState<ScopeRateSlot>(() =>
    deriveScopeRateFromAllocations(engineers)
  );
  const popupRef = useRef<HTMLDivElement>(null);

  const applyScopeRate = (slot: ScopeRateSlot) => {
    setScopeRate(slot);
    setDraft((prev) => prev.map((e) => ({ ...e, rate: slot })));
  };

  const forecastHrsByEngineerId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of forecastByEngineer) {
      m.set(r.engineerId, r.hours);
    }
    return m;
  }, [forecastByEngineer]);

  const changeEngineerId = (idx: number, engineerId: string) =>
    setDraft((prev) =>
      prev.map((eng, i) => {
        if (i !== idx) return eng;
        const pool = engineerPool.find((p) => p.id === engineerId);
        return {
          ...eng,
          engineerId,
          weeklyLimitHrs: defaultWeeklyLimit(pool),
        };
      })
    );

  const defaultWeeklyLimit = (pool: EngineerPoolEntry | undefined) =>
    pool?.maxWeeklyHours ?? DEFAULT_MAX_WEEKLY_HOURS;

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

  const setWeeklyLimit = (idx: number, raw: string) => {
    setDraft((prev) =>
      prev.map((eng, i) => {
        if (i !== idx) return eng;
        // Empty = inherit engineer default on save; keep null so the field stays clear while editing
        if (raw.trim() === "") return { ...eng, weeklyLimitHrs: null };
        const n = parseFloat(raw);
        if (Number.isNaN(n)) return eng;
        return { ...eng, weeklyLimitHrs: Math.max(0, Math.round(n)) };
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
        weeklyLimitHrs: defaultWeeklyLimit(engineerPool[0]),
        rate: scopeRate,
      },
    ]);

  const handleAdd = () => {
    onChangeEngineers(
      draft.map((eng) => {
        const pool = engineerPool.find((p) => p.id === eng.engineerId);
        return {
          ...eng,
          weeklyLimitHrs: eng.weeklyLimitHrs ?? defaultWeeklyLimit(pool),
        };
      })
    );
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
      className="border-border bg-card shadow-elevated pointer-events-auto fixed z-[119] w-[min(100vw-1rem,32rem)] rounded-lg border sm:max-w-none"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Engineer Allocation
          </p>
          <label className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <span className="shrink-0">Scope rate</span>
            <select
              className="border-border bg-background focus:ring-ring rounded border px-2 py-1 text-xs font-medium tabular-nums focus:ring-1 focus:outline-none"
              value={scopeRate}
              onChange={(e) => applyScopeRate(normalizeScopeRate(e.target.value))}
              title="Costing rate band for this scope (applies to all engineers below)"
              aria-label="Scope rate band A to E"
            >
              {SCOPE_RATE_SLOTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Header + rows share one full-bleed width — header used to sit in `p-3` while body used `-mx-3`, which misaligned columns. */}
        <div className="border-border -mx-3 border-x border-b">
          <div className={POPUP_HEADER_ROW}>
            <div
              className={`${COL_ENGINEER} flex min-h-[2.5rem] items-center px-1.5 text-left text-xs font-medium tracking-wide uppercase`}
            >
              Engineer
            </div>
            <div
              className={`${COL_HOURS} flex min-h-[2.5rem] flex-col items-center justify-center text-xs font-medium tracking-wide uppercase`}
            >
              {renderProgrammeHeaderLabel("Forecast")}
            </div>
            <div
              className={`${COL_HOURS} flex min-h-[2.5rem] flex-col items-center justify-center text-xs font-medium tracking-wide uppercase`}
            >
              {renderProgrammeHeaderLabel("Planned")}
            </div>
            <div
              className={`${COL_HOURS} flex min-h-[2.5rem] flex-col items-center justify-center text-xs font-medium tracking-wide uppercase`}
              title="Max hours per week on this scope (forecast autofill uses this instead of the engineer global weekly cap)"
            >
              Wk limit
            </div>
            <div className={`${COL_ACTION} min-h-[2.5rem]`} aria-hidden />
          </div>

          {draft.map((eng, idx) => {
            const forecastHrs = forecastHrsByEngineerId.get(eng.engineerId);
            return (
              <div
                key={idx}
                className="border-border flex items-center border-b text-sm last:border-b-0"
              >
                <div className={`${COL_ENGINEER} px-1.5 py-1`}>
                  <select
                    className="border-border bg-background focus:ring-ring w-full max-w-full min-w-0 rounded border px-1.5 py-0.5 text-xs focus:ring-1 focus:outline-none"
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
                </div>
                <div
                  className={`text-muted-foreground ${COL_HOURS} text-sm tabular-nums`}
                  title="From Demand Forecast grid (saved cells)"
                >
                  {forecastHrs != null && !Number.isNaN(forecastHrs)
                    ? Math.round(forecastHrs)
                    : "—"}
                </div>
                <div className={COL_HOURS}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    aria-label="Planned hours"
                    className="border-border bg-background focus:ring-ring no-input-spinner w-full rounded border px-1.5 py-0.5 text-center text-xs tabular-nums focus:ring-1 focus:outline-none"
                    value={eng.plannedHrs ?? ""}
                    onChange={(e) => setPlannedHrs(idx, e.target.value)}
                  />
                </div>
                <div className={COL_HOURS}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    aria-label="Weekly limit on this scope"
                    title="Hours per week on this scope. Leave empty to use the engineer’s default weekly hours."
                    placeholder={String(
                      defaultWeeklyLimit(engineerPool.find((p) => p.id === eng.engineerId))
                    )}
                    className="border-border bg-background focus:ring-ring no-input-spinner w-full rounded border px-1 py-0.5 text-center text-xs tabular-nums focus:ring-1 focus:outline-none"
                    value={eng.weeklyLimitHrs ?? ""}
                    onChange={(e) => setWeeklyLimit(idx, e.target.value)}
                  />
                </div>
                <div className={`${COL_ACTION} py-1`}>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="text-muted-foreground hover:text-destructive inline-flex size-7 shrink-0 items-center justify-center rounded transition-colors"
                    aria-label="Remove engineer"
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

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
          className="bg-foreground text-background rounded px-3 py-1.5 text-sm hover:opacity-90"
        >
          Save
        </button>
      </div>
    </div>
  );
}
