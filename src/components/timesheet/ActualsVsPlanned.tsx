"use client";

import { useEffect, useState } from "react";

import {
  getProjectForecastHoursByScopeAction,
  getTimesheetProjectActualsAction,
} from "@/app/[office]/project/[id]/actions";
import { buildActualsVsPlanned } from "@/lib/timesheet/actualsVsPlanned";
import type { ActualsVsPlannedSummary } from "@/lib/timesheet/actualsVsPlanned";
import type { ProgrammeNode } from "@/components/programme/types";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { cn } from "@/lib/utils";

import { ActualsSwimLane, engineerDisplayName } from "./ActualsSwimLane";

type ViewMode = "scope" | "engineer";

interface Props {
  projectId: string;
  programmeTree: ProgrammeNode[];
  engineerPool: EngineerPoolEntry[];
}

export function ActualsVsPlanned({ projectId, programmeTree, engineerPool }: Props) {
  const [summary, setSummary] = useState<ActualsVsPlannedSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("scope");

  useEffect(() => {
    Promise.all([
      getTimesheetProjectActualsAction(projectId),
      getProjectForecastHoursByScopeAction(projectId),
    ]).then(([actualsRes, forecastRes]) => {
      if ("error" in actualsRes) {
        setError(actualsRes.error);
        setLoading(false);
        return;
      }
      const forecastByScope = "byScope" in forecastRes ? forecastRes.byScope : {};
      setSummary(buildActualsVsPlanned(actualsRes.rows, programmeTree, forecastByScope));
      setLoading(false);
    });
  }, [projectId, programmeTree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-status-critical text-sm">{error}</p>
      </div>
    );
  }

  if (!summary || summary.totalActuals === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12">
        <p className="text-foreground text-sm font-medium">No matched hours yet</p>
        <p className="text-muted-foreground max-w-xs text-center text-xs">
          Upload a timesheet and ensure scope entries are matched. Unmatched entries won&apos;t
          appear here.
        </p>
      </div>
    );
  }

  const hasForecast = summary.totalForecast !== null;
  const overallDelta = summary.totalBudget > 0 ? summary.totalActuals - summary.totalBudget : null;
  const overallIsOver = overallDelta !== null && overallDelta > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Budget" value={`${summary.totalBudget}h`} sub="total allocated" />
        <StatCard
          label="Forecast"
          value={hasForecast ? `${summary.totalForecast}h` : "—"}
          sub="planned to spend"
        />
        <StatCard
          label="Actuals"
          value={`${summary.totalActuals}h`}
          sub="hours logged"
          highlight={overallIsOver ? "critical" : undefined}
        />
        {overallDelta !== null ? (
          <StatCard
            label="vs Budget"
            value={overallDelta > 0 ? `+${overallDelta}h` : `${overallDelta}h`}
            sub={overallDelta > 0 ? "over budget" : "remaining"}
            highlight={overallIsOver ? "critical" : "healthy"}
          />
        ) : (
          <StatCard label="vs Budget" value="—" sub="no budget set" />
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="border-border flex overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => setViewMode("scope")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "scope"
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            By scope
          </button>
          <button
            type="button"
            onClick={() => setViewMode("engineer")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "engineer"
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            By engineer
          </button>
        </div>

        {/* Legend */}
        <div className="text-muted-foreground flex items-center gap-4 text-[10px]">
          {hasForecast && (
            <span className="flex items-center gap-1.5">
              <span className="bg-status-info-bg h-2 w-3 rounded-sm" />
              Forecast
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ background: "#475569" }} />
            Actuals
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="rounded-full"
              style={{ width: 9, height: 9, background: "var(--foreground)" }}
            />
            Budget ceiling
          </span>
        </div>
      </div>

      {/* Lanes */}
      <div className="bg-card border-border shadow-card overflow-hidden rounded-lg border">
        {viewMode === "scope"
          ? summary.scopes.map((scope, i) => (
              <ActualsSwimLane
                key={scope.scopeId}
                name={scope.scopeName}
                subLabel={`${scope.actualHours}h logged${scope.budgetHours ? ` · ${scope.budgetHours}h budget` : ""}`}
                actualHours={scope.actualHours}
                budgetHours={scope.budgetHours}
                forecastHours={scope.forecastHours}
                delta={scope.delta}
                pills={scope.engineers.map((e) => ({
                  engineerId: e.engineerId,
                  actualHours: e.actualHours,
                  comparedHours: e.plannedHrs ?? e.forecastHours,
                }))}
                engineerPool={engineerPool}
                isEven={i % 2 === 0}
              />
            ))
          : summary.engineers.map((eng, i) => {
              const name = engineerDisplayName(eng.engineerId, engineerPool);
              const planned = eng.plannedHrs ?? eng.forecastHours;
              const delta = planned !== null ? eng.actualHours - planned : null;
              return (
                <ActualsSwimLane
                  key={eng.engineerId}
                  name={name}
                  subLabel={`${eng.actualHours}h logged${planned ? ` · ${planned}h planned` : ""}`}
                  actualHours={eng.actualHours}
                  budgetHours={planned}
                  forecastHours={eng.forecastHours}
                  delta={delta}
                  pills={eng.scopes.map((s) => ({
                    engineerId: s.scopeId,
                    actualHours: s.actualHours,
                    comparedHours: null,
                  }))}
                  engineerPool={
                    // For scope pills we want scope names, not engineer names.
                    // Map scope IDs to fake EngineerPoolEntry so the pill shows scope abbreviations.
                    eng.scopes.map((s) => ({
                      id: s.scopeId,
                      code: s.scopeName.slice(0, 2).toUpperCase(),
                      firstName: s.scopeName.split(" ")[0],
                      lastName: s.scopeName.split(" ")[1] ?? "",
                    }))
                  }
                  isEven={i % 2 === 0}
                />
              );
            })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: "critical" | "healthy";
}) {
  return (
    <div className="bg-card border-border shadow-card flex flex-col gap-0.5 rounded-lg border p-3">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </div>
      <div
        className={cn(
          "text-xl leading-tight font-bold",
          highlight === "critical" && "text-status-critical",
          highlight === "healthy" && "text-status-healthy",
          !highlight && "text-foreground"
        )}
      >
        {value}
      </div>
      <div className="text-muted-foreground text-[10px]">{sub}</div>
    </div>
  );
}
