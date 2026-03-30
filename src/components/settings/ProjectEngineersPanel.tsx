"use client";

import { useCallback, useEffect, useState } from "react";

import {
  addAllEngineersToProjectAction,
  addProjectEngineerAction,
  loadProjectEngineersAction,
  removeProjectEngineerAction,
  setProjectEngineerRateSlotAction,
  type ProjectEngineersView,
} from "@/app/settings/projectEngineersActions";
import { InlineEditableNumber } from "@/components/ui/InlineEditableNumber";
import { SUBTLE_FORM_INPUT_CLASS } from "@/components/ui/InlineEditableText";
import {
  PROJECT_ENGINEER_RATE_SLOT_COUNT,
  PROJECT_ENGINEER_RATE_SLOT_LABELS,
  type ProjectEngineerRateSlotIndex,
} from "@/types/project-engineer";

function fullName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "—";
}

export function ProjectEngineersPanel({ projectId }: { projectId: string }) {
  const [view, setView] = useState<ProjectEngineersView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const applyResult = useCallback((r: Awaited<ReturnType<typeof loadProjectEngineersAction>>) => {
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setView(r.view);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await loadProjectEngineersAction(projectId);
      if (cancelled) return;
      applyResult(r);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, applyResult]);

  const run = async (fn: () => Promise<Awaited<ReturnType<typeof loadProjectEngineersAction>>>) => {
    setPending(true);
    try {
      const r = await fn();
      applyResult(r);
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading engineers…</p>;
  }

  if (!view) {
    return (
      <div className="border-border bg-status-critical-bg text-status-critical rounded-lg border px-4 py-2 text-sm">
        {error ?? "Could not load project engineers."}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <div className="border-border bg-status-critical-bg text-status-critical rounded-lg border px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Choose which engineers are on this project, then set up to five rates (A–E) per person.
        Assignments are per project only.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Add engineer
        </label>
        <select
          disabled={pending || view.poolForAdd.length === 0}
          className={SUBTLE_FORM_INPUT_CLASS + " max-w-[220px]"}
          defaultValue=""
          key={view.poolForAdd.length + view.assignments.length}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return;
            void run(() => addProjectEngineerAction(projectId, id));
            e.target.value = "";
          }}
        >
          <option value="">Choose…</option>
          {view.poolForAdd.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code} — {fullName(e.firstName, e.lastName)}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => addAllEngineersToProjectAction(projectId))}
          className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
        >
          Add all active engineers
        </button>
      </div>

      {view.assignments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No engineers on this project yet. Add people from the pool above.
        </p>
      ) : (
        <div className="border-border shadow-card min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-lg border">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-border bg-muted/40 border-b">
                <th
                  scope="col"
                  className="border-border text-muted-foreground bg-card sticky left-0 z-20 w-[10rem] border-r px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Engineer
                </th>
                {Array.from({ length: PROJECT_ENGINEER_RATE_SLOT_COUNT }, (_, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-border text-muted-foreground min-w-[7.5rem] border-r px-2 py-3 text-left text-xs font-medium tracking-wide uppercase"
                  >
                    Rate {PROJECT_ENGINEER_RATE_SLOT_LABELS[i]}
                  </th>
                ))}
                <th
                  scope="col"
                  className="text-muted-foreground bg-card min-w-[4.5rem] px-2 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  {/* remove */}
                </th>
              </tr>
            </thead>
            <tbody>
              {view.assignments.map((row) => (
                <tr key={row.id} className="border-border border-b last:border-b-0">
                  <th
                    scope="row"
                    title={fullName(row.firstName, row.lastName)}
                    className="border-border bg-card sticky left-0 z-10 border-r px-4 py-3 text-left font-medium"
                  >
                    <span className="text-foreground cursor-default">{row.code}</span>
                  </th>
                  {Array.from({ length: PROJECT_ENGINEER_RATE_SLOT_COUNT }, (_, slot) => (
                    <td key={slot} className="border-border border-r px-2 py-1 align-middle">
                      <InlineEditableNumber
                        value={row.rates[slot as ProjectEngineerRateSlotIndex]}
                        placeholder="—"
                        disabled={pending}
                        min={0}
                        step={0.01}
                        onCommit={(next) =>
                          void run(() =>
                            setProjectEngineerRateSlotAction(projectId, row.id, slot, next)
                          )
                        }
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 align-middle">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void run(() => removeProjectEngineerAction(projectId, row.id))}
                      className="text-muted-foreground hover:text-status-critical rounded px-2 py-1 text-xs font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
