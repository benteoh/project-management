"use client";

import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { parseFlexibleActivityDate } from "@/components/programme/dateUtils";
import { effectiveWeeklyScopeLimit } from "@/lib/forecast/effectiveWeeklyScopeLimit";
import { hourRateForScopeSlot } from "@/lib/forecast/hourRateForScopeSlot";
import {
  cellValuesHasPositiveHours,
  filterCellValuesToValidProgramme,
} from "@/lib/forecast/cellValuesUtils";
import { loadForecastEntries, saveForecastEntries } from "@/lib/forecast/forecastDb";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type ForecastDraftPayload,
} from "@/lib/forecast/forecastDraft";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { formatEngineerListLabel } from "@/lib/engineer-pool-display";

import { ColumnFilter } from "./ColumnFilter";
import { ForecastAgGrid, type ForecastAgGridHandle } from "./ForecastAgGrid";
import type { CellValues } from "./forecastGridTypes";
import type {
  ForecastFilterColumn,
  ForecastGridRow as ForecastGridRowType,
  ForecastProgrammeNode,
} from "./types";
import {
  addMonths,
  computeStartDate,
  generateDailyDates,
  msUntilNextSaturdayMidnight,
  scopesFromTree,
  startOfWeek,
  toISODate,
} from "./utils";

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
  const router = useRouter();
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(computeStartDate);
  const [engineers, setEngineers] = useState<EngineerPoolEntry[]>(initialEngineerPool);
  /** Must derive from programmeTree so new scopes from the Programme tab appear without a full page reload. */
  const scopes = useMemo(() => scopesFromTree(programmeTree), [programmeTree]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggle: show all dates from project start, or only from current week onward
  const [showPast, setShowPast] = useState(false);

  // Toggle: show only engineers assigned to each scope (default on)
  const [showAssignedOnly, setShowAssignedOnly] = useState(true);

  /** Hour rate + Total Spent columns — default hidden */
  const [showRateAndSpendColumns, setShowRateAndSpendColumns] = useState(false);

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

  const gridRef = useRef<ForecastAgGridHandle>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [hydratePayload, setHydratePayload] = useState<{
    key: number;
    values: CellValues;
  } | null>(null);
  const [draftConflict, setDraftConflict] = useState<{
    draft: ForecastDraftPayload;
    server: CellValues;
  } | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scheduleDraftSave = useCallback(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const vals = gridRef.current?.getCellValues() ?? {};
      saveDraft(projectId, vals);
    }, 300);
  }, [projectId]);

  const onPersistableChange = useCallback(() => {
    setHasUnsaved(true);
    scheduleDraftSave();
  }, [scheduleDraftSave]);

  useEffect(
    () => () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setForecastLoading(true);
      setSaveError(null);
      const serverRes = await loadForecastEntries(supabase, projectId);
      const draft = loadDraft(projectId);
      if (cancelled) return;

      const serverVals = serverRes.ok ? serverRes.values : {};
      const serverHas = serverRes.ok && cellValuesHasPositiveHours(serverVals);
      const draftHas = draft != null && cellValuesHasPositiveHours(draft.values);

      if (draftHas && serverHas) {
        setDraftConflict({ draft, server: serverVals });
        setHydratePayload({ key: Date.now(), values: serverVals });
      } else if (draftHas && (!serverRes.ok || !serverHas)) {
        setHydratePayload({ key: Date.now(), values: draft!.values });
      } else if (serverRes.ok) {
        setHydratePayload({ key: Date.now(), values: serverVals });
      } else {
        setHydratePayload({ key: Date.now(), values: {} });
      }
      setForecastLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSaveForecast = useCallback(async () => {
    setSavePending(true);
    setSaveError(null);
    const allowedScopeIds = new Set(scopes.map((s) => s.id));
    const allowedEngineerIds = new Set(engineers.map((e) => e.id));
    const raw = gridRef.current?.getCellValues() ?? {};
    const vals = filterCellValuesToValidProgramme(raw, allowedScopeIds, allowedEngineerIds);
    const res = await saveForecastEntries(supabase, projectId, vals);
    setSavePending(false);
    if (res.ok) {
      clearDraft(projectId);
      setHasUnsaved(false);
      router.refresh();
    } else {
      setSaveError(res.error);
    }
  }, [projectId, router, scopes, engineers]);

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

  // ── Date range ─────────────────────────────────────────────────────────────
  const todayIso = toISODate(new Date());

  const startDate = useMemo(
    () => (showPast ? startOfWeek(projectStartDate) : currentWeekStart),
    [showPast, projectStartDate, currentWeekStart]
  );

  const todayPlus1Month = useMemo(() => addMonths(todayIso, 1), [todayIso]);

  const endDate = useMemo(() => {
    if (projectIsFinished) {
      // TODO: when demand forecast persistence is added, use max(projectEndDate, last entry date)
      return projectEndDate;
    }
    // Active project: extend at least 1 month past today (lexicographic max works for ISO dates).
    return todayPlus1Month > projectEndDate ? todayPlus1Month : projectEndDate;
  }, [projectIsFinished, projectEndDate, todayPlus1Month]);

  const dailyDates = useMemo(() => generateDailyDates(startDate, endDate), [startDate, endDate]);
  const bankHolidays = useMemo(() => new Set(bankHolidayDates), [bankHolidayDates]);

  // ── Scope metadata map ────────────────────────────────────────────────────
  // Built from programmeTree once; used to populate enriched ForecastGridRow fields.
  const scopeMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        plannedHrsByEngineer: Map<string, number | null>;
        /** scope_engineers.weekly_limit_hrs per engineer (null = inherit pool) */
        weeklyScopeLimitHrsByEngineer: Map<string, number | null>;
        /** scope_engineers.rate (A–E) per engineer */
        rateByEngineer: Map<string, string>;
        startDate: string | null;
        endDate: string | null;
        status: string;
      }
    >();
    for (const node of programmeTree) {
      if (node.type !== "scope") continue;
      const plannedHrsByEngineer = new Map<string, number | null>();
      const weeklyScopeLimitHrsByEngineer = new Map<string, number | null>();
      const rateByEngineer = new Map<string, string>();
      if (node.engineers) {
        for (const e of node.engineers) {
          plannedHrsByEngineer.set(e.engineerId, e.plannedHrs ?? null);
          weeklyScopeLimitHrsByEngineer.set(e.engineerId, e.weeklyScopeLimitHrs ?? null);
          rateByEngineer.set(e.engineerId, e.rate ?? "A");
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
        weeklyScopeLimitHrsByEngineer,
        rateByEngineer,
        startDate: toIso(node.start),
        endDate: toIso(node.finish),
        status: node.status ?? "",
      });
    }
    return map;
  }, [programmeTree]);

  // ── Rows (one row per scope × engineer; dedupe stable row ids) ─────────────
  const allRows = useMemo<ForecastGridRowType[]>(() => {
    const seen = new Set<string>();
    const out: ForecastGridRowType[] = [];
    for (const scope of scopes) {
      for (const engineer of engineers) {
        const rid = `${scope.id}-${engineer.id}`;
        if (seen.has(rid)) continue;
        seen.add(rid);
        const meta = scopeMetaMap.get(scope.id);
        const rateSlot = meta?.rateByEngineer.get(engineer.id);
        const storedWeekly = meta?.weeklyScopeLimitHrsByEngineer.get(engineer.id) ?? null;
        out.push({
          scope,
          engineer,
          hourRate: hourRateForScopeSlot(engineer, rateSlot),
          plannedHrs: meta?.plannedHrsByEngineer.get(engineer.id) ?? null,
          scopeStartDate: meta?.startDate ?? null,
          scopeEndDate: meta?.endDate ?? null,
          scopeStatus: (meta?.status ?? "") as ForecastGridRowType["scopeStatus"],
          maxDailyHours: engineer.maxDailyHours ?? null,
          weeklyScopeLimit: effectiveWeeklyScopeLimit(storedWeekly, engineer),
          maxWeeklyHours: engineer.maxWeeklyHours ?? null,
        });
      }
    }
    return out;
  }, [scopes, engineers, scopeMetaMap]);

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
      {draftConflict && (
        <div
          className="bg-status-warning-bg text-status-warning border-border flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2 text-sm"
          role="status"
        >
          <p>
            You have a local draft from{" "}
            {new Date(draftConflict.draft.savedAt).toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            . Restore draft or use saved version?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="bg-card text-foreground border-border shadow-card rounded-md border px-3 py-1 text-xs font-medium"
              onClick={() => {
                gridRef.current?.hydrate(draftConflict.draft.values);
                setDraftConflict(null);
                setHasUnsaved(true);
              }}
            >
              Restore draft
            </button>
            <button
              type="button"
              className="bg-card text-foreground border-border shadow-card rounded-md border px-3 py-1 text-xs font-medium"
              onClick={() => {
                clearDraft(projectId);
                gridRef.current?.hydrate(draftConflict.server);
                setDraftConflict(null);
                setHasUnsaved(false);
              }}
            >
              Use saved
            </button>
          </div>
        </div>
      )}

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
          onClick={() => setShowRateAndSpendColumns((v) => !v)}
          title="Toggle hour rate and total spend columns"
          className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
            showRateAndSpendColumns
              ? "border-gold text-gold"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Rate & spend
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

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label={savePending ? "Saving forecast" : "Save forecast to database"}
            onClick={() => void handleSaveForecast()}
            disabled={forecastLoading || savePending || draftConflict !== null}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              savePending || forecastLoading || draftConflict
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : hasUnsaved
                  ? "bg-gold text-foreground hover:opacity-90"
                  : "border-gold/50 bg-gold/15 text-foreground hover:bg-gold/25 border"
            )}
          >
            {hasUnsaved && (
              <span
                className="border-background bg-status-warning absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-solid"
                title="Unsaved changes"
                aria-hidden
              />
            )}
            <Save className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {savePending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveError && <p className="text-status-critical shrink-0 px-4 pb-1 text-xs">{saveError}</p>}

      {/* AG Grid */}
      <div className="relative min-h-0 flex-1">
        {forecastLoading || hydratePayload === null ? (
          <div className="bg-muted/40 m-4 flex-1 animate-pulse rounded-lg" aria-hidden />
        ) : (
          <div className="absolute inset-0">
            <ForecastAgGrid
              ref={gridRef}
              rows={filteredRows}
              dailyDates={dailyDates}
              bankHolidays={bankHolidays}
              todayIso={todayIso}
              scrollToTodayRef={scrollToTodayRef}
              hydratePayload={hydratePayload}
              onPersistableChange={onPersistableChange}
              showRateAndSpendColumns={showRateAndSpendColumns}
            />
          </div>
        )}
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
