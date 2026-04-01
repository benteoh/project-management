"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import type { ProgrammeNodeDbRow } from "@/types/programme";
import type { EngineerPoolEntry } from "@/types/engineer-pool";

import { ColumnFilter } from "./ColumnFilter";
import { END_DATE } from "./constants";
import { ForecastGridHeader } from "./ForecastGridHeader";
import { ForecastGridRow } from "./ForecastGridRow";
import type {
  ForecastFilterColumn,
  ForecastGridRow as ForecastGridRowType,
  ForecastProgrammeNode,
  ScopeItem,
} from "./types";
import {
  cleanScopeLabel,
  computeStartDate,
  generateDailyDates,
  msUntilNextSaturdayMidnight,
  scopesFromTree,
} from "./utils";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ForecastTabProps = {
  projectId: string;
  initialEngineerPool: EngineerPoolEntry[];
  programmeTree: ForecastProgrammeNode[];
};

export function ForecastTab({ projectId, initialEngineerPool, programmeTree }: ForecastTabProps) {
  const [startDate, setStartDate] = useState<string>(computeStartDate);
  const [engineers, setEngineers] = useState<EngineerPoolEntry[]>(initialEngineerPool);
  const [scopes, setScopes] = useState<ScopeItem[]>(() => scopesFromTree(programmeTree));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // null = no filter active (show all); Set = only show these values
  const [scopeFilter, setScopeFilter] = useState<Set<string> | null>(null);
  const [personFilter, setPersonFilter] = useState<Set<string> | null>(null);
  const [openFilter, setOpenFilter] = useState<{
    column: ForecastFilterColumn;
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

  const dailyDates = useMemo(() => generateDailyDates(startDate, END_DATE), [startDate]);

  // All rows before filtering
  const allRows = useMemo<ForecastGridRowType[]>(
    () => scopes.flatMap((scope) => engineers.map((engineer) => ({ scope, engineer }))),
    [scopes, engineers]
  );

  // Apply scope + person filters
  const filteredRows = useMemo(
    () =>
      allRows.filter(
        ({ scope, engineer }) =>
          (scopeFilter === null || scopeFilter.has(scope.label)) &&
          (personFilter === null || personFilter.has(engineer.code))
      ),
    [allRows, scopeFilter, personFilter]
  );

  // Unique option lists for each filter dropdown
  const scopeOptions = useMemo(() => [...new Set(scopes.map((s) => s.label))], [scopes]);
  const personOptions = useMemo(() => engineers.map((e) => e.code), [engineers]);
  const scopeFilterSignature = useMemo(() => {
    const selected = scopeFilter ? [...scopeFilter].sort().join("|") : "all";
    return `${scopeOptions.join("|")}::${selected}`;
  }, [scopeOptions, scopeFilter]);
  const personFilterSignature = useMemo(() => {
    const selected = personFilter ? [...personFilter].sort().join("|") : "all";
    return `${personOptions.join("|")}::${selected}`;
  }, [personOptions, personFilter]);

  function openFilterFor(column: ForecastFilterColumn, e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenFilter({ column, rect });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-max">
          <ForecastGridHeader
            dailyDates={dailyDates}
            scopeFilterActive={scopeFilter !== null}
            personFilterActive={personFilter !== null}
            onOpenFilter={openFilterFor}
          />

          {filteredRows.map((row, idx) => (
            <ForecastGridRow
              key={`${row.scope.id}-${row.engineer.id}`}
              row={row}
              index={idx}
              dailyDates={dailyDates}
            />
          ))}
        </div>
      </div>

      {/* ── Filter dropdown (portaled) ── */}
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
