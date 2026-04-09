"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import type { ProgrammeNodeDbRow } from "@/types/programme";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { formatEngineerListLabel } from "@/lib/engineer-pool-display";

import { ColumnFilter } from "./ColumnFilter";
import { ForecastAgGrid } from "./ForecastAgGrid";
import type {
  ForecastFilterColumn,
  ForecastGridRow as ForecastGridRowType,
  ForecastProgrammeNode,
  ScopeItem,
} from "./types";
import {
  addMonths,
  cleanScopeLabel,
  computeStartDate,
  generateDailyDates,
  msUntilNextSaturdayMidnight,
  scopesFromTree,
  startOfWeek,
  toISODate,
} from "./utils";
import { parseFlexibleActivityDate } from "@/components/programme/dateUtils";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ForecastTabProps = {
  projectId: string;
  projectStartDate: string; // ISO — start of the project
  projectEndDate: string; // ISO — scheduled end of the project
  projectIsFinished: boolean; // drives the right-edge cutoff
  initialEngineerPool: EngineerPoolEntry[];
  programmeTree: ForecastProgrammeNode[];
  bankHolidays: string[];
};

export function ForecastTab({
  projectId,
  projectStartDate,
  projectEndDate,
  projectIsFinished,
  initialEngineerPool,
  programmeTree,
  bankHolidays: bankHolidayDates,
}: ForecastTabProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(computeStartDate);
  const [engineers, setEngineers] = useState<EngineerPoolEntry[]>(initialEngineerPool);
  const [scopes, setScopes] = useState<ScopeItem[]>(() => scopesFromTree(programmeTree));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggle: show all dates from project start, or only from current week onward
  const [showPast, setShowPast] = useState(false);

  // Toggle: show only engineers assigned to each scope (default on)
  const [showAssignedOnly, setShowAssignedOnly] = useState(true);

  // Set of "${scopeId}-${engineerId}" pairs for fast assignment lookup
  const assignedSet = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const node of programmeTree) {
      if (node.type === "scope" && node.engineers) {
        for (const { engineerId } of node.engineers) {
          set.add(`${node.id}-${engineerId}`);
        }
      }
    }
    return set;
  }, [programmeTree]);

  // Ref to call scroll-to-today on the grid imperatively
  const scrollToTodayRef = useRef<(() => void) | null>(null);

  // null = no filter active (show all); Set = only show these values
  const [scopeFilter, setScopeFilter] = useState<Set<string> | null>(null);
  const [personFilter, setPersonFilter] = useState<Set<string> | null>(null);
  const [openFilter, setOpenFilter] = useState<{
    column: ForecastFilterColumn;
    rect: DOMRect;
  } | null>(null);

  // Advance current week every Saturday at midnight
  useEffect(() => {
    function scheduleNextUpdate() {
      timerRef.current = setTimeout(() => {
        setCurrentWeekStart(computeStartDate());
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
          const row = payload.new as {
            id: string;
            code: string;
            first_name: string;
            last_name: string;
            is_active: boolean;
          };
          if (row.is_active) {
            const entry: EngineerPoolEntry = {
              id: row.id,
              code: row.code,
              firstName: row.first_name,
              lastName: row.last_name,
            };
            setEngineers((prev) =>
              prev.some((e) => e.id === entry.id)
                ? prev
                : [...prev, entry].sort((a, b) => a.code.localeCompare(b.code))
            );
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

  // ── Date range ─────────────────────────────────────────────────────────────
  const todayIso = toISODate(new Date());

  const startDate = useMemo(
    () => (showPast ? startOfWeek(projectStartDate) : currentWeekStart),
    [showPast, projectStartDate, currentWeekStart]
  );

  const endDate = useMemo(() => {
    if (projectIsFinished) {
      // TODO: when demand forecast persistence is added, use max(projectEndDate, last entry date)
      return projectEndDate;
    }
    // Active project: extend at least 1 month past today
    const todayPlus1m = addMonths(todayIso, 1);
    return todayPlus1m > projectEndDate ? todayPlus1m : projectEndDate;
  }, [projectIsFinished, projectEndDate, todayIso]);

  const dailyDates = useMemo(() => generateDailyDates(startDate, endDate), [startDate, endDate]);
  const bankHolidays = useMemo(() => new Set(bankHolidayDates), [bankHolidayDates]);

  // ── Scope metadata map ────────────────────────────────────────────────────
  // Built from programmeTree once; used to populate enriched ForecastGridRow fields.
  const scopeMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        plannedHrsByEngineer: Map<string, number | null>;
        startDate: string | null;
        endDate: string | null;
        status: string;
      }
    >();
    for (const node of programmeTree) {
      if (node.type !== "scope") continue;
      const plannedHrsByEngineer = new Map<string, number | null>();
      if (node.engineers) {
        for (const e of node.engineers) {
          plannedHrsByEngineer.set(e.engineerId, e.plannedHrs ?? null);
        }
      }
      // Dates may be stored as "dd-Mon-yy" (programme format) — convert to ISO for comparisons
      const toIso = (raw: string | undefined | null): string | null => {
        if (!raw) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const d = parseFlexibleActivityDate(raw);
        return d ? toISODate(d) : null;
      };
      map.set(node.id, {
        plannedHrsByEngineer,
        startDate: toIso(node.start),
        endDate: toIso(node.finish),
        status: node.status ?? "",
      });
    }
    return map;
  }, [programmeTree]);

  // ── Rows ───────────────────────────────────────────────────────────────────
  const allRows = useMemo<ForecastGridRowType[]>(
    () =>
      scopes.flatMap((scope) =>
        engineers.map((engineer) => {
          const meta = scopeMetaMap.get(scope.id);
          return {
            scope,
            engineer,
            plannedHrs: meta?.plannedHrsByEngineer.get(engineer.id) ?? null,
            scopeStartDate: meta?.startDate ?? null,
            scopeEndDate: meta?.endDate ?? null,
            scopeStatus: (meta?.status ?? "") as ForecastGridRowType["scopeStatus"],
            maxDailyHours: engineer.maxDailyHours ?? null,
            maxWeeklyHours: engineer.maxWeeklyHours ?? null,
          };
        })
      ),
    [scopes, engineers, scopeMetaMap]
  );

  const filteredRows = useMemo(
    () =>
      allRows.filter(
        ({ scope, engineer }) =>
          (scopeFilter === null || scopeFilter.has(scope.label)) &&
          (personFilter === null ||
            personFilter.has(formatEngineerListLabel(engineer, engineer.code))) &&
          (!showAssignedOnly || assignedSet.has(`${scope.id}-${engineer.id}`))
      ),
    [allRows, scopeFilter, personFilter, showAssignedOnly, assignedSet]
  );

  // ── Filter dropdown state ──────────────────────────────────────────────────
  const scopeOptions = useMemo(() => [...new Set(scopes.map((s) => s.label))], [scopes]);
  const personOptions = useMemo(
    () => engineers.map((e) => formatEngineerListLabel(e, e.code)),
    [engineers]
  );
  const scopeFilterSignature = useMemo(() => {
    const selected = scopeFilter ? [...scopeFilter].sort().join("|") : "all";
    return `${scopeOptions.join("|")}::${selected}`;
  }, [scopeOptions, scopeFilter]);
  const personFilterSignature = useMemo(() => {
    const selected = personFilter ? [...personFilter].sort().join("|") : "all";
    return `${personOptions.join("|")}::${selected}`;
  }, [personOptions, personFilter]);

  function openFilterFor(column: ForecastFilterColumn, e: MouseEvent<HTMLButtonElement>) {
    setOpenFilter({ column, rect: e.currentTarget.getBoundingClientRect() });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="border-border flex shrink-0 items-center gap-2 border-b px-4 py-2">
        {/* Filters */}
        {/* Assigned only toggle */}
        <button
          type="button"
          onClick={() => setShowAssignedOnly((v) => !v)}
          className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
            showAssignedOnly
              ? "border-gold text-gold"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Assigned only
        </button>

        <button
          type="button"
          onClick={(e) => openFilterFor("scope", e)}
          className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
            scopeFilter !== null
              ? "border-gold text-gold"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Scope{scopeFilter !== null ? ` (${scopeFilter.size})` : ""}
        </button>
        <button
          type="button"
          onClick={(e) => openFilterFor("person", e)}
          className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
            personFilter !== null
              ? "border-gold text-gold"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Person{personFilter !== null ? ` (${personFilter.size})` : ""}
        </button>
        {(scopeFilter !== null || personFilter !== null) && (
          <button
            type="button"
            onClick={() => {
              setScopeFilter(null);
              setPersonFilter(null);
            }}
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Clear filters
          </button>
        )}

        <div className="bg-border mx-1 h-4 w-px" />

        {/* Show past toggle */}
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
            showPast
              ? "border-gold text-gold"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {showPast ? "Showing all dates" : "Show all dates"}
        </button>

        {/* Go to today */}
        <button
          type="button"
          onClick={() => scrollToTodayRef.current?.()}
          className="border-border text-muted-foreground hover:text-foreground rounded-md border px-3 py-1 text-xs font-medium transition-colors"
        >
          Today
        </button>
      </div>

      {/* AG Grid */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <ForecastAgGrid
            rows={filteredRows}
            dailyDates={dailyDates}
            bankHolidays={bankHolidays}
            todayIso={todayIso}
            scrollToTodayRef={scrollToTodayRef}
          />
        </div>
      </div>

      {/* Filter dropdown */}
      {openFilter && (
        <ColumnFilter
          key={openFilter.column === "scope" ? scopeFilterSignature : personFilterSignature}
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
