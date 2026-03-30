"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import type { ProgrammeNode } from "@/components/programme/types";
import type { ProgrammeNodeDbRow } from "@/types/programme";
import { ColumnFilter } from "./ColumnFilter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanScopeLabel(name: string): string {
  return name
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

type ScopeItem = { id: string; label: string };

function scopesFromTree(tree: ProgrammeNode[]): ScopeItem[] {
  return tree
    .filter((n) => n.type === "scope")
    .map((n) => ({ id: n.id, label: cleanScopeLabel(n.name) }));
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeStartDate(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  return toISODate(monday);
}

function msUntilNextSaturdayMidnight(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  const nextSat = new Date(now);
  nextSat.setDate(now.getDate() + daysUntilSat);
  nextSat.setHours(0, 0, 0, 0);
  return nextSat.getTime() - now.getTime();
}

function generateDailyDates(startIso: string, endIso: string): Date[] {
  const dates: Date[] = [];
  const current = new Date(startIso);
  const end = new Date(endIso);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUMMARY_LABELS = ["Scope", "Person", "Hour Rate", "Total Hours", "Total Spent"] as const;
const END_DATE = "2027-04-30";
const NO_COL_W = "w-12";
const SUMMARY_COL_W = "w-36";
const DATE_COL_W = "w-8";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ForecastTabProps = {
  projectId: string;
  initialEngineerPool: string[];
  programmeTree: ProgrammeNode[];
};

export function ForecastTab({ projectId, initialEngineerPool, programmeTree }: ForecastTabProps) {
  const [startDate, setStartDate] = useState<string>(computeStartDate);
  const [engineers, setEngineers] = useState<string[]>(initialEngineerPool);
  const [scopes, setScopes] = useState<ScopeItem[]>(() => scopesFromTree(programmeTree));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // null = no filter active (show all); Set = only show these values
  const [scopeFilter, setScopeFilter] = useState<Set<string> | null>(null);
  const [personFilter, setPersonFilter] = useState<Set<string> | null>(null);
  const [openFilter, setOpenFilter] = useState<{
    column: "scope" | "person";
    rect: DOMRect;
  } | null>(null);

  // Advance start date every Saturday at midnight
  useEffect(() => {
    function scheduleNextUpdate() {
      timerRef.current = setTimeout(() => {
        setStartDate(computeStartDate());
        scheduleNextUpdate();
      }, msUntilNextSaturdayMidnight());
    }
    scheduleNextUpdate();
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  // Live-update engineer list on INSERT into engineer_pool
  useEffect(() => {
    const channel = supabase
      .channel("forecast_engineer_pool")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "engineer_pool" },
        (payload) => {
          const row = payload.new as { code: string; is_active: boolean };
          if (row.is_active) {
            setEngineers((prev) => (prev.includes(row.code) ? prev : [...prev, row.code].sort()));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Live-update scope list on INSERT into programme_nodes for this project
  useEffect(() => {
    const channel = supabase
      .channel("forecast_programme_nodes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "programme_nodes",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as ProgrammeNodeDbRow;
          if (row.type === "scope") {
            const label = cleanScopeLabel(row.name);
            setScopes((prev) =>
              prev.some((s) => s.id === row.id) ? prev : [...prev, { id: row.id, label }]
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const dailyDates = generateDailyDates(startDate, END_DATE);

  // All rows before filtering
  const allRows = useMemo(
    () => scopes.flatMap((scope) => engineers.map((code) => ({ scope, code }))),
    [scopes, engineers]
  );

  // Apply scope + person filters
  const filteredRows = useMemo(
    () =>
      allRows.filter(
        ({ scope, code }) =>
          (scopeFilter === null || scopeFilter.has(scope.label)) &&
          (personFilter === null || personFilter.has(code))
      ),
    [allRows, scopeFilter, personFilter]
  );

  // Unique option lists for each filter dropdown
  const scopeOptions = useMemo(() => [...new Set(scopes.map((s) => s.label))], [scopes]);
  const personOptions = useMemo(() => engineers, [engineers]);

  function openFilterFor(column: "scope" | "person", e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenFilter({ column, rect });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* ── Header row ── */}
          <div className="border-border flex border-b">
            <div
              className={`border-border flex ${NO_COL_W} shrink-0 items-center border-r px-3 py-3`}
            >
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                No.
              </span>
            </div>

            {SUMMARY_LABELS.map((label, i) => {
              const isFilterable = label === "Scope" || label === "Person";
              const column = label === "Scope" ? "scope" : "person";
              const isActive =
                (label === "Scope" && scopeFilter !== null) ||
                (label === "Person" && personFilter !== null);

              return (
                <div
                  key={label}
                  className={`border-border flex ${SUMMARY_COL_W} shrink-0 items-center justify-between px-4 py-3${i < SUMMARY_LABELS.length - 1 ? "border-r" : ""}`}
                >
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {label}
                  </span>
                  {isFilterable && (
                    <button
                      type="button"
                      onClick={(e) => openFilterFor(column, e)}
                      title={`Filter ${label}`}
                      className={`ml-1 rounded p-0.5 transition-colors ${isActive ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {/* Funnel icon */}
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M1 2h10L7 6.5V11L5 10V6.5L1 2z" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            {dailyDates.map((date: Date) => {
              const dow = date.getDay();
              const isWeekend = dow === 0 || dow === 6;
              const dd = String(date.getDate()).padStart(2, "0");
              const mm = String(date.getMonth() + 1).padStart(2, "0");
              const yyyy = date.getFullYear();
              return (
                <div
                  key={date.toISOString()}
                  className={`border-border flex ${DATE_COL_W} shrink-0 items-center justify-center border-r py-2${isWeekend ? "bg-muted" : ""}`}
                >
                  <span
                    className="text-muted-foreground text-xs"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {dd}/{mm}/{yyyy}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Data rows: one per scope × engineer (filtered) ── */}
          {filteredRows.map(({ scope, code }, idx) => (
            <div key={`${scope.id}-${code}`} className="border-border flex border-b">
              <div className={`border-border ${NO_COL_W} shrink-0 border-r px-3 py-2`}>
                <span className="text-muted-foreground text-sm">{idx + 1}</span>
              </div>
              <div className={`border-border ${SUMMARY_COL_W} shrink-0 border-r px-4 py-2`}>
                <span className="text-foreground text-sm">{scope.label}</span>
              </div>
              <div className={`border-border ${SUMMARY_COL_W} shrink-0 border-r px-4 py-2`}>
                <span className="text-foreground text-sm font-medium">{code}</span>
              </div>
              <div className={`border-border ${SUMMARY_COL_W} shrink-0 border-r px-4 py-2`} />
              <div className={`border-border ${SUMMARY_COL_W} shrink-0 border-r px-4 py-2`} />
              <div className={`${SUMMARY_COL_W} shrink-0 px-4 py-2`} />
              {dailyDates.map((date: Date) => {
                const dow = date.getDay();
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <div
                    key={date.toISOString()}
                    className={`border-border ${DATE_COL_W} shrink-0 border-r${isWeekend ? "bg-muted" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter dropdown (portaled) ── */}
      {openFilter && (
        <ColumnFilter
          options={openFilter.column === "scope" ? scopeOptions : personOptions}
          selected={openFilter.column === "scope" ? scopeFilter : personFilter}
          anchorRect={openFilter.rect}
          onChange={(next) => {
            if (openFilter.column === "scope") setScopeFilter(next);
            else setPersonFilter(next);
          }}
          onClose={() => setOpenFilter(null)}
        />
      )}
    </div>
  );
}
