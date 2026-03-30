"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import type { EngineerPoolEntry } from "@/types/engineer-pool";

import type { EngineerAllocation } from "./types";

export function EngineerPopup({
  engineers,
  totalHours,
  forecastHours,
  engineerPool,
  rect,
  onChangeEngineers,
  onAddToPool,
  onClose,
}: {
  engineers: EngineerAllocation[];
  totalHours: number | null;
  forecastHours: number | null;
  engineerPool: EngineerPoolEntry[];
  rect: { top: number; left: number; width: number; height: number };
  onChangeEngineers: (engs: EngineerAllocation[]) => void;
  onAddToPool: (code: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EngineerAllocation[]>(engineers);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const count = draft.length || 1;
  const autoPlanned = totalHours != null ? parseFloat((totalHours / count).toFixed(2)) : null;
  const autoForecast =
    forecastHours != null ? parseFloat((forecastHours / count).toFixed(2)) : null;

  const changeEngineerId = (idx: number, engineerId: string) =>
    setDraft((prev) => prev.map((eng, i) => (i === idx ? { ...eng, engineerId } : eng)));

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

  const commitNewCode = () => {
    const code = newCode.trim();
    if (!code) return;
    onAddToPool(code);
    setNewCode("");
    setShowAddInput(false);
  };

  const handleAdd = () => {
    onChangeEngineers(draft);
    onClose();
  };

  const top = rect.top + rect.height + 6;
  const left = Math.min(
    rect.left,
    typeof window !== "undefined" ? window.innerWidth - 360 : rect.left
  );

  return (
    <>
      <div className="fixed inset-0 z-[118]" onClick={triggerShake} />
      <div
        className="border-border bg-card shadow-elevated fixed z-[119] w-80 rounded-lg border"
        style={{ top, left }}
      >
        <div className="p-3">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            Engineer Allocation
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-border text-muted-foreground border-b">
                <th className="pb-1.5 text-left font-medium">Engineer</th>
                <th className="pr-2 pb-1.5 text-right font-medium">Planned Hrs</th>
                <th className="pr-2 pb-1.5 text-right font-medium">Forecast Hrs</th>
                <th className="w-5 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {draft.map((eng, idx) => (
                <tr key={idx} className="border-border/60 border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    <select
                      className="border-border bg-background focus:ring-ring w-full rounded border px-1 py-0.5 text-xs focus:ring-1 focus:outline-none"
                      value={eng.engineerId}
                      onChange={(e) => {
                        if (e.target.value === "__add__") {
                          e.currentTarget.value = eng.engineerId;
                          setShowAddInput(true);
                        } else {
                          changeEngineerId(idx, e.target.value);
                        }
                      }}
                    >
                      {engineerPool.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code}
                        </option>
                      ))}
                      {!engineerPool.some((p) => p.id === eng.engineerId) && eng.engineerId && (
                        <option value={eng.engineerId}>{eng.engineerId}</option>
                      )}
                      <option value="__add__">＋ Add new code...</option>
                    </select>
                  </td>
                  <td className="text-muted-foreground py-1.5 pr-2 text-right tabular-nums">
                    {autoPlanned ?? "—"}
                  </td>
                  <td className="text-muted-foreground py-1.5 pr-2 text-right tabular-nums">
                    {autoForecast ?? "—"}
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

          {showAddInput && (
            <div className="border-border mt-2 flex items-center gap-1.5 border-t pt-2">
              <input
                autoFocus
                className="border-border bg-background focus:ring-ring flex-1 rounded border px-1.5 py-0.5 text-xs focus:ring-1 focus:outline-none"
                placeholder="New code e.g. JDo"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNewCode();
                  if (e.key === "Escape") {
                    setShowAddInput(false);
                    setNewCode("");
                  }
                }}
              />
              <button
                type="button"
                onClick={commitNewCode}
                className="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs hover:opacity-90"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddInput(false);
                  setNewCode("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        <div
          className={`border-border flex justify-end gap-2 border-t px-3 py-2.5 ${shake ? "animate-shake" : ""}`}
        >
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
    </>
  );
}
