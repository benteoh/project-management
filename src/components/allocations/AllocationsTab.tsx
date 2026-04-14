"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import type { ProgrammeNode } from "@/components/programme/types";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import {
  buildActivityLabelMap,
  buildScopeNameMap,
  ENGINEER_KEY_UNKNOWN,
  rollupForActivityView,
  rollupForScopeView,
  rollupsForProjectView,
  type ActivityViewSelection,
  type NamedHoursRow,
  type ScopeEngineerAllocationRow,
} from "@/lib/allocations/allocationsRollup";
import { collectActivityNodesUnderScopeId, collectScopeNodes } from "@/lib/programme/programmeTree";
import { cn } from "@/lib/utils";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { TimesheetAllocationRow } from "@/types/allocations";
import type { ForecastHoursByScopeRecord, ForecastHoursPerEngineer } from "@/types/forecast-scope";

const VIEWS = ["Engineers", "Scope", "Activity"] as const;
type AllocationsView = (typeof VIEWS)[number];

function formatHours(h: number): string {
  return `${h.toFixed(1)} h`;
}

const HOURS_COMPARE_TOL = 0.05;

function roundHours1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Colours **spent hours** relative to **baseline** (forecast or planned).
 * Green = on budget (within tolerance), yellow = under baseline, red = over baseline.
 */
function hoursComparisonClass(
  actual: number,
  baseline: number | null | undefined
): "text-status-healthy" | "text-status-warning" | "text-status-critical" | null {
  if (baseline == null || Number.isNaN(baseline)) return null;
  if (actual > baseline + HOURS_COMPARE_TOL) return "text-status-critical";
  if (Math.abs(actual - baseline) <= HOURS_COMPARE_TOL) return "text-status-healthy";
  return "text-status-warning";
}

function scopeForecastTotal(
  byScope: ForecastHoursByScopeRecord,
  scopeId: string
): { sum: number; hasRows: boolean } {
  const rows = byScope[scopeId];
  if (!rows?.length) return { sum: 0, hasRows: false };
  const sum = rows.reduce((a, r) => a + Number(r.hours), 0);
  return { sum: roundHours1(sum), hasRows: true };
}

/** Sum demand forecast hours per engineer across all scopes in the project. */
function forecastHoursByEngineerAcrossScopes(
  byScope: ForecastHoursByScopeRecord
): Map<string, number> {
  const m = new Map<string, number>();
  for (const list of Object.values(byScope)) {
    if (!list?.length) continue;
    for (const { engineerId, hours } of list) {
      const h = Number(hours);
      if (Number.isNaN(h)) continue;
      m.set(engineerId, roundHours1((m.get(engineerId) ?? 0) + h));
    }
  }
  return m;
}

function totalForecastHoursOnProject(byScope: ForecastHoursByScopeRecord): number {
  let t = 0;
  for (const list of Object.values(byScope)) {
    if (!list?.length) continue;
    for (const r of list) {
      const h = Number(r.hours);
      if (!Number.isNaN(h)) t += h;
    }
  }
  return roundHours1(t);
}

function projectHasForecastRows(byScope: ForecastHoursByScopeRecord): boolean {
  return Object.values(byScope).some((list) => (list?.length ?? 0) > 0);
}

/** `actual / forecast * 100`, one decimal; null if forecast missing or ~0. */
function actualVsForecastPercent(
  actual: number,
  forecast: number | null | undefined
): number | null {
  if (forecast == null || forecast <= HOURS_COMPARE_TOL) return null;
  return Math.round((actual / forecast) * 1000) / 10;
}

function EngineerForecastSpendBlock({
  actual,
  forecast,
  variant,
}: {
  actual: number;
  /** This engineer's total forecast hours across scopes; null if none in grid. */
  forecast: number | null;
  variant: "accordion-trailing" | "panel";
}) {
  const tone = hoursComparisonClass(actual, forecast) ?? "text-foreground";
  const pct = actualVsForecastPercent(actual, forecast);
  const inner = (
    <>
      {forecast != null ? (
        <>
          <span className="text-foreground font-medium">{formatHours(forecast)}</span>
          <span className="text-muted-foreground">forecast</span>
        </>
      ) : (
        <span className="text-muted-foreground">forecast —</span>
      )}
      <span className="text-muted-foreground">·</span>
      <span className={cn("font-medium", tone)}>{formatHours(actual)}</span>
      <span className="text-muted-foreground">hrs spent</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">billable</span>
      {pct != null ? (
        <span className={cn("font-medium", tone)}>{pct}%</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </>
  );
  if (variant === "accordion-trailing") {
    return (
      <span className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-xs tabular-nums">
        {inner}
      </span>
    );
  }
  return (
    <p className="text-muted-foreground flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm tabular-nums">
      {inner}
    </p>
  );
}

/** Column header row — light gray bar, design tokens only. */
const DATA_TABLE_HEAD =
  "text-muted-foreground border-border bg-muted border-b text-left text-xs font-medium tracking-wide uppercase";

/** Lighter bar for table card title (above column headers). */
const TABLE_SECTION_TITLE =
  "text-muted-foreground border-border bg-muted/45 border-b px-4 py-2 text-xs font-medium tracking-wide uppercase";

function tableRowStripe(index: number): string {
  return index % 2 === 0 ? "bg-card" : "bg-muted";
}

function AccordionChevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      className={cn(
        "text-muted-foreground size-4 shrink-0 transition-transform duration-200",
        open && "rotate-180"
      )}
      aria-hidden
    />
  );
}

function AccordionRow({
  open,
  onToggle,
  title,
  titleAttr,
  trailing,
  trailingClassName,
  trailingContent,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  /** Native tooltip; defaults to `title`. */
  titleAttr?: string;
  trailing?: string;
  /** When set (e.g. hrs spent vs forecast), overrides default muted trailing colour. */
  trailingClassName?: string;
  /** Rich trailing (e.g. forecast + hrs spent + billable %). Takes precedence over `trailing`. */
  trailingContent?: ReactNode;
  children: ReactNode;
}) {
  const tip = titleAttr ?? title;
  return (
    <div className="border-border border-b last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="hover:bg-background flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
      >
        <AccordionChevron open={open} />
        <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium" title={tip}>
          {title}
        </span>
        {trailingContent != null ? (
          <div className="max-w-[min(22rem,55%)] shrink-0">{trailingContent}</div>
        ) : trailing != null ? (
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              trailingClassName ?? "text-muted-foreground"
            )}
          >
            {trailing}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="border-border bg-background border-t px-4 py-4">{children}</div>
      ) : null}
    </div>
  );
}

/** Suffix for “no activity linked” in `expandedActivityKey` (`scopeId:…`). */
const ACTIVITY_UNMAPPED_SEGMENT = "__unmapped__";

function expandedActivityKeyFor(scopeId: string, segment: string): string {
  return `${scopeId}:${segment}`;
}

function activityDisplayLabelForNode(node: ProgrammeNode): string {
  const code = node.activityId?.trim();
  return code ? `${code} — ${node.name}` : node.name;
}

function NestedAccordionRow({
  open,
  onToggle,
  title,
  titleAttr,
  trailing,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  titleAttr?: string;
  trailing?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-card/90 overflow-hidden rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        title={titleAttr}
        className="hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
      >
        <AccordionChevron open={open} />
        <span className="text-foreground min-w-0 flex-1 font-medium">
          <span className="line-clamp-2">{title}</span>
        </span>
        {trailing != null ? (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{trailing}</span>
        ) : null}
      </button>
      {open ? <div className="border-border bg-muted/30 border-t px-3 py-3">{children}</div> : null}
    </div>
  );
}

function ActivityHoursPanel({
  allocationRows,
  scopeId,
  selection,
  activityDisplayLabel,
  engineerLabel,
  scopeForecastEngineers,
}: {
  allocationRows: TimesheetAllocationRow[];
  scopeId: string;
  selection: ActivityViewSelection;
  activityDisplayLabel: string;
  engineerLabel: (engineerId: string | null) => string;
  /** Per-engineer forecast hours for this scope (from demand forecast grid). */
  scopeForecastEngineers: ForecastHoursPerEngineer[];
}) {
  const rollup = rollupForActivityView(
    allocationRows,
    scopeId,
    selection,
    activityDisplayLabel,
    engineerLabel
  );

  const forecastByEngineerId = new Map(
    scopeForecastEngineers.map((e) => [e.engineerId, roundHours1(Number(e.hours))])
  );
  const totalForecast =
    scopeForecastEngineers.length > 0
      ? roundHours1(scopeForecastEngineers.reduce((s, e) => s + Number(e.hours), 0))
      : null;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-foreground text-sm font-semibold">{rollup.activityLabel}</p>
        <p className="text-muted-foreground text-sm">
          <span
            className={cn(
              "font-medium tabular-nums",
              hoursComparisonClass(rollup.spentHours, totalForecast) ?? "text-foreground"
            )}
          >
            {formatHours(rollup.spentHours)}
          </span>
          <span> spent</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-foreground font-medium tabular-nums">
            {totalForecast != null ? formatHours(totalForecast) : "—"}
          </span>
          <span> forecast (scope total)</span>
        </p>
      </div>

      {rollup.byEngineer.length === 0 ? (
        <div className="border-border bg-muted/40 rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Engineers on this activity
          </p>
          <p className="text-muted-foreground mt-2 text-sm">No rows.</p>
        </div>
      ) : (
        <div className="border-border bg-card shadow-card overflow-hidden rounded-lg border">
          <p className={TABLE_SECTION_TITLE}>Engineers on this activity</p>
          <table className="w-full text-sm">
            <thead>
              <tr className={DATA_TABLE_HEAD}>
                <th className="px-4 py-2.5">Engineer</th>
                <th className="px-4 py-2.5 text-right">Hrs spent</th>
                <th className="px-4 py-2.5 text-right">Forecast</th>
              </tr>
            </thead>
            <tbody>
              {rollup.byEngineer.map((r, i) => {
                const fc = r.id ? (forecastByEngineerId.get(r.id) ?? null) : null;
                return (
                  <tr
                    key={`${r.label}-${i}`}
                    className={cn("border-border/70 border-b last:border-b-0", tableRowStripe(i))}
                  >
                    <td
                      className="text-foreground max-w-[14rem] truncate px-4 py-2.5"
                      title={r.label}
                    >
                      {r.label}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-medium tabular-nums",
                        hoursComparisonClass(r.hours, fc) ?? "text-foreground"
                      )}
                    >
                      {formatHours(r.hours)}
                    </td>
                    <td className="text-foreground px-4 py-2.5 text-right tabular-nums">
                      {fc != null ? formatHours(fc) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Spent = saved timesheet hours on this activity. Forecast = demand forecast hours for this
        scope per engineer. Spent is <span className="text-status-healthy">green</span> when it
        matches forecast, <span className="text-status-warning">amber</span> when under,{" "}
        <span className="text-status-critical">red</span> when over.
      </p>
    </div>
  );
}

function useEngineerLabel(pool: EngineerPoolEntry[]) {
  return useCallback(
    (engineerId: string | null): string => {
      if (!engineerId) return "Unknown engineer";
      const e = pool.find((x) => x.id === engineerId);
      if (!e) return "Engineer not in pool";
      const name = [e.firstName, e.lastName].filter(Boolean).join(" ").trim();
      return name ? `${name} (${e.code})` : e.code;
    },
    [pool]
  );
}

function HoursTable({
  title,
  rows,
  nameHeader,
  hoursHeader = "Hours",
}: {
  title: string;
  rows: NamedHoursRow[];
  nameHeader: string;
  /** Right-hand numeric column label (e.g. `Hrs spent` in activity breakdown). */
  hoursHeader?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-border bg-muted/40 rounded-lg border p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</p>
        <p className="text-muted-foreground mt-2 text-sm">No rows.</p>
      </div>
    );
  }
  return (
    <div className="border-border bg-card shadow-card overflow-hidden rounded-lg border">
      <p className={TABLE_SECTION_TITLE}>{title}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className={DATA_TABLE_HEAD}>
            <th className="px-4 py-2.5">{nameHeader}</th>
            <th className="px-4 py-2.5 text-right">{hoursHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.label}-${i}`}
              className={cn("border-border/70 border-b last:border-b-0", tableRowStripe(i))}
            >
              <td
                className="text-foreground max-w-[14rem] truncate px-4 py-2.5"
                title={r.subtitle ? `${r.label}\n${r.subtitle}` : r.label}
              >
                {r.label}
              </td>
              <td className="text-foreground px-4 py-2.5 text-right tabular-nums">
                {formatHours(r.hours)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function forecastHoursForEngineerOnScope(
  forecastHoursByScope: ForecastHoursByScopeRecord,
  scopeId: string | null,
  engineerId: string | null
): number | null {
  if (!scopeId || !engineerId) return null;
  const list = forecastHoursByScope[scopeId];
  if (!list?.length) return null;
  const hit = list.find((e) => e.engineerId === engineerId);
  if (!hit) return null;
  const h = Number(hit.hours);
  if (Number.isNaN(h)) return null;
  return roundHours1(h);
}

/** By-scope breakdown for one engineer: forecast, hrs spent, and billable % per scope. */
function EngineerByScopeTable({
  rows,
  engineerId,
  forecastHoursByScope,
}: {
  rows: NamedHoursRow[];
  engineerId: string | null;
  forecastHoursByScope: ForecastHoursByScopeRecord;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-border bg-muted/40 rounded-lg border p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          By scope
        </p>
        <p className="text-muted-foreground mt-2 text-sm">No rows.</p>
      </div>
    );
  }
  return (
    <div className="border-border bg-card shadow-card overflow-hidden rounded-lg border">
      <p className={TABLE_SECTION_TITLE}>By scope</p>
      <table className="w-full text-sm">
        <thead>
          <tr className={DATA_TABLE_HEAD}>
            <th className="px-4 py-2.5">Scope</th>
            <th className="px-4 py-2.5 text-right">Forecast</th>
            <th className="px-4 py-2.5 text-right">Hrs spent</th>
            <th className="px-4 py-2.5 text-right">Billable %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const fc = forecastHoursForEngineerOnScope(forecastHoursByScope, r.id, engineerId);
            const pct = actualVsForecastPercent(r.hours, fc);
            const actualTone = hoursComparisonClass(r.hours, fc) ?? "text-foreground";
            return (
              <tr
                key={`${r.label}-${i}`}
                className={cn("border-border/70 border-b last:border-b-0", tableRowStripe(i))}
              >
                <td
                  className="text-foreground max-w-[10rem] truncate px-4 py-2.5 sm:max-w-[14rem]"
                  title={r.subtitle ? `${r.label}\n${r.subtitle}` : r.label}
                >
                  {r.label}
                </td>
                <td className="text-foreground px-4 py-2.5 text-right tabular-nums">
                  {fc != null ? formatHours(fc) : "—"}
                </td>
                <td className={cn("px-4 py-2.5 text-right tabular-nums", actualTone)}>
                  {formatHours(r.hours)}
                </td>
                <td className={cn("px-4 py-2.5 text-right tabular-nums", actualTone)}>
                  {pct != null ? `${pct}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-muted-foreground border-border bg-muted/50 border-t px-4 py-2 text-xs">
        Forecast = demand forecast for this engineer on each scope. Billable % = (hrs spent /
        forecast) × 100. Colours match hrs spent vs forecast.
      </p>
    </div>
  );
}

function ScopeEngineersTable({ rows }: { rows: ScopeEngineerAllocationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="border-border bg-muted/40 rounded-lg border p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Engineers
        </p>
        <p className="text-muted-foreground mt-2 text-sm">No rows.</p>
      </div>
    );
  }
  return (
    <div className="border-border bg-card shadow-card overflow-hidden rounded-lg border">
      <p className={TABLE_SECTION_TITLE}>Engineers</p>
      <table className="w-full text-sm">
        <thead>
          <tr className={DATA_TABLE_HEAD}>
            <th className="px-4 py-2.5">Engineer</th>
            <th className="px-4 py-2.5 text-right">Forecast</th>
            <th className="px-4 py-2.5 text-right">Hrs spent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.engineerId ?? "unknown"}-${i}`}
              className={cn("border-border/70 border-b last:border-b-0", tableRowStripe(i))}
            >
              <td className="text-foreground max-w-[14rem] truncate px-4 py-2.5" title={r.label}>
                {r.label}
              </td>
              <td className="text-foreground px-4 py-2.5 text-right tabular-nums">
                {r.forecastHours != null ? formatHours(r.forecastHours) : "—"}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right tabular-nums",
                  hoursComparisonClass(r.actualHours, r.forecastHours) ?? "text-foreground"
                )}
              >
                {formatHours(r.actualHours)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground border-border bg-muted/50 border-t px-4 py-2 text-xs">
        Forecast = demand forecast for this scope. Hrs spent = timesheet hours. Hrs spent is{" "}
        <span className="text-status-healthy">green</span> when it matches forecast,{" "}
        <span className="text-status-warning">amber</span> when under,{" "}
        <span className="text-status-critical">red</span> when over.
      </p>
    </div>
  );
}

export function AllocationsTab({
  projectId,
  allocationRows,
  programmeTree,
  engineerPool,
  forecastHoursByScope,
}: {
  projectId: string;
  allocationRows: TimesheetAllocationRow[];
  programmeTree: ProgrammeNode[];
  engineerPool: EngineerPoolEntry[];
  forecastHoursByScope: ForecastHoursByScopeRecord;
}) {
  const [view, setView] = usePersistedTab<AllocationsView>(
    `allocations-view:${projectId}`,
    "Engineers",
    VIEWS
  );
  const [expandedEngineerKey, setExpandedEngineerKey] = useState<string | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<string>("");
  /** Activity view: `${scopeId}:${nodeId}` or `${scopeId}:${ACTIVITY_UNMAPPED_SEGMENT}`; one open at a time. */
  const [expandedActivityKey, setExpandedActivityKey] = useState<string | null>(null);

  const engineerLabel = useEngineerLabel(engineerPool);

  const scopeNameMap = useMemo(() => buildScopeNameMap(programmeTree), [programmeTree]);
  const activityLabelMap = useMemo(() => buildActivityLabelMap(programmeTree), [programmeTree]);
  const scopes = useMemo(() => collectScopeNodes(programmeTree), [programmeTree]);

  const hoursByScopeId = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of allocationRows) {
      if (!row.scopeId) continue;
      m.set(row.scopeId, (m.get(row.scopeId) ?? 0) + row.hours);
    }
    return m;
  }, [allocationRows]);

  const projectRollups = useMemo(
    () => rollupsForProjectView(allocationRows, scopeNameMap, activityLabelMap, programmeTree),
    [allocationRows, scopeNameMap, activityLabelMap, programmeTree]
  );

  const totalProjectHours = useMemo(
    () => projectRollups.reduce((s, r) => s + r.totalHours, 0),
    [projectRollups]
  );

  const forecastHoursByEngineerId = useMemo(
    () => forecastHoursByEngineerAcrossScopes(forecastHoursByScope),
    [forecastHoursByScope]
  );

  const totalForecastOnProject = useMemo(
    () => totalForecastHoursOnProject(forecastHoursByScope),
    [forecastHoursByScope]
  );

  const hasForecastOnProject = useMemo(
    () => projectHasForecastRows(forecastHoursByScope),
    [forecastHoursByScope]
  );

  const totalActualVsForecastPct = actualVsForecastPercent(
    totalProjectHours,
    hasForecastOnProject ? totalForecastOnProject : null
  );

  const activitiesByScopeId = useMemo(() => {
    const m = new Map<string, ProgrammeNode[]>();
    for (const s of scopes) {
      m.set(s.id, collectActivityNodesUnderScopeId(programmeTree, s.id));
    }
    return m;
  }, [programmeTree, scopes]);

  const scopeRollup = useMemo(() => {
    if (!selectedScopeId) return null;
    return rollupForScopeView(
      allocationRows,
      selectedScopeId,
      scopeNameMap,
      activityLabelMap,
      engineerLabel,
      programmeTree,
      forecastHoursByScope
    );
  }, [
    allocationRows,
    selectedScopeId,
    scopeNameMap,
    activityLabelMap,
    engineerLabel,
    programmeTree,
    forecastHoursByScope,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-border flex shrink-0 flex-wrap items-center gap-1 border-b px-4 py-2">
        {VIEWS.map((v) => {
          const active = v === view;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {allocationRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No saved timesheet rows for this project yet. Upload and save a timesheet on the
            Timesheet tab to see allocations.
          </p>
        ) : view === "Engineers" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Engineers
              </p>
              <p className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-xs">
                <span>
                  Forecast:{" "}
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      hasForecastOnProject ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {hasForecastOnProject ? formatHours(totalForecastOnProject) : "—"}
                  </span>
                </span>
                <span className="text-muted-foreground">·</span>
                <span>
                  Total hrs spent:{" "}
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      hoursComparisonClass(
                        totalProjectHours,
                        hasForecastOnProject ? totalForecastOnProject : null
                      ) ?? "text-foreground"
                    )}
                  >
                    {formatHours(totalProjectHours)}
                  </span>
                </span>
                {totalActualVsForecastPct != null ? (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Billable %:</span>{" "}
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        hoursComparisonClass(
                          totalProjectHours,
                          hasForecastOnProject ? totalForecastOnProject : null
                        ) ?? "text-foreground"
                      )}
                    >
                      {totalActualVsForecastPct}%
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="border-border bg-card shadow-card overflow-hidden rounded-lg border">
              {projectRollups.map((row) => {
                const open = expandedEngineerKey === row.engineerKey;
                const label =
                  row.engineerKey === ENGINEER_KEY_UNKNOWN
                    ? "Unknown engineer"
                    : engineerLabel(row.engineerId);
                const engineerFc =
                  row.engineerId != null && forecastHoursByEngineerId.has(row.engineerId)
                    ? forecastHoursByEngineerId.get(row.engineerId)!
                    : null;
                return (
                  <AccordionRow
                    key={row.engineerKey}
                    open={open}
                    onToggle={() =>
                      setExpandedEngineerKey((k) =>
                        k === row.engineerKey ? null : row.engineerKey
                      )
                    }
                    title={label}
                    titleAttr={
                      row.unmappedHours > 0
                        ? `${label}\n${formatHours(row.unmappedHours)} unmapped`
                        : label
                    }
                    trailingContent={
                      <EngineerForecastSpendBlock
                        actual={row.totalHours}
                        forecast={engineerFc}
                        variant="accordion-trailing"
                      />
                    }
                  >
                    <div className="space-y-4">
                      <div className="border-border bg-muted/25 rounded-lg border px-3 py-2">
                        <EngineerForecastSpendBlock
                          actual={row.totalHours}
                          forecast={engineerFc}
                          variant="panel"
                        />
                      </div>
                      {row.unmappedHours > 0 ? (
                        <p className="text-foreground text-sm">
                          <span className="text-muted-foreground">Unmapped: </span>
                          <span className="text-status-warning font-medium tabular-nums">
                            {formatHours(row.unmappedHours)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            — hours on rows missing engineer or scope (activity may still be
                            linked).
                          </span>
                        </p>
                      ) : null}
                      <div className="grid gap-4 md:grid-cols-2">
                        <EngineerByScopeTable
                          rows={row.byScope}
                          engineerId={row.engineerId}
                          forecastHoursByScope={forecastHoursByScope}
                        />
                        <HoursTable
                          title="By activity"
                          rows={row.byActivity}
                          nameHeader="Activity"
                          hoursHeader="Hrs spent"
                        />
                      </div>
                    </div>
                  </AccordionRow>
                );
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              Per engineer: hrs spent vs demand forecast (all scopes). Billable % = (hrs spent /
              forecast) × 100. <span className="text-status-healthy">Green</span> on forecast,{" "}
              <span className="text-status-warning">amber</span> under,{" "}
              <span className="text-status-critical">red</span> over.
            </p>
          </div>
        ) : view === "Scope" ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Scope
            </p>
            {scopes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No scopes in this programme.</p>
            ) : (
              <div className="border-border bg-card shadow-card overflow-hidden rounded-lg border">
                {scopes.map((s) => {
                  const open = selectedScopeId === s.id;
                  const scopeHoursActual = hoursByScopeId.get(s.id);
                  const { sum: forecastSum, hasRows: hasForecastForScope } = scopeForecastTotal(
                    forecastHoursByScope,
                    s.id
                  );
                  const trailing =
                    scopeHoursActual != null && scopeHoursActual > 0
                      ? formatHours(scopeHoursActual)
                      : undefined;
                  const scopeTrailingTone =
                    trailing != null && hasForecastForScope && scopeHoursActual != null
                      ? hoursComparisonClass(scopeHoursActual, forecastSum)
                      : null;
                  const trailingClassName =
                    trailing != null ? (scopeTrailingTone ?? "text-muted-foreground") : undefined;
                  return (
                    <AccordionRow
                      key={s.id}
                      open={open}
                      onToggle={() => {
                        setSelectedScopeId((prev) => {
                          if (prev === s.id) return "";
                          return s.id;
                        });
                      }}
                      title={s.name}
                      trailing={trailing}
                      trailingClassName={trailingClassName}
                    >
                      {scopeRollup && selectedScopeId === s.id ? (
                        <div className="space-y-4">
                          <p className="text-foreground text-sm">
                            <span className="font-semibold">{scopeRollup.scopeLabel}</span>
                            <span className="text-muted-foreground"> · Forecast </span>
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                hasForecastForScope ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
                              {hasForecastForScope ? formatHours(forecastSum) : "—"}
                            </span>
                            <span className="text-muted-foreground"> · Hrs spent </span>
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                hoursComparisonClass(
                                  scopeRollup.totalHours,
                                  hasForecastForScope ? forecastSum : null
                                ) ?? "text-foreground"
                              )}
                            >
                              {formatHours(scopeRollup.totalHours)}
                            </span>
                          </p>
                          <div className="grid gap-4 md:grid-cols-2">
                            <HoursTable
                              title="By activity"
                              rows={scopeRollup.byActivity}
                              nameHeader="Activity"
                              hoursHeader="Hrs spent"
                            />
                            <ScopeEngineersTable rows={scopeRollup.byEngineer} />
                          </div>
                        </div>
                      ) : null}
                    </AccordionRow>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Scope and activity
            </p>
            {scopes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No scopes in this programme.</p>
            ) : (
              <div className="border-border bg-card shadow-card overflow-hidden rounded-lg border">
                {scopes.map((s) => {
                  const open = selectedScopeId === s.id;
                  const scopeHoursActual = hoursByScopeId.get(s.id);
                  const { sum: forecastSum, hasRows: hasForecastForScope } = scopeForecastTotal(
                    forecastHoursByScope,
                    s.id
                  );
                  const trailing =
                    scopeHoursActual != null && scopeHoursActual > 0
                      ? formatHours(scopeHoursActual)
                      : undefined;
                  const actTrailingTone =
                    trailing != null && hasForecastForScope && scopeHoursActual != null
                      ? hoursComparisonClass(scopeHoursActual, forecastSum)
                      : null;
                  const trailingClassName =
                    trailing != null ? (actTrailingTone ?? "text-muted-foreground") : undefined;
                  const acts = activitiesByScopeId.get(s.id) ?? [];
                  const keyUnmapped = expandedActivityKeyFor(s.id, ACTIVITY_UNMAPPED_SEGMENT);
                  const openUnmapped = expandedActivityKey === keyUnmapped;
                  return (
                    <AccordionRow
                      key={s.id}
                      open={open}
                      onToggle={() => {
                        setSelectedScopeId((prev) => {
                          if (prev === s.id) {
                            setExpandedActivityKey(null);
                            return "";
                          }
                          setExpandedActivityKey(null);
                          return s.id;
                        });
                      }}
                      title={s.name}
                      trailing={trailing}
                      trailingClassName={trailingClassName}
                    >
                      {open ? (
                        <div className="border-border ml-1 space-y-2 border-l-2 pl-3 md:ml-2 md:pl-4">
                          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            Activity
                          </p>
                          <NestedAccordionRow
                            open={openUnmapped}
                            onToggle={() =>
                              setExpandedActivityKey((k) =>
                                k === keyUnmapped ? null : keyUnmapped
                              )
                            }
                            title="No activity linked"
                            titleAttr={`No activity linked\nScope: ${s.name}`}
                          >
                            <ActivityHoursPanel
                              allocationRows={allocationRows}
                              scopeId={s.id}
                              selection={{ mode: "unmapped" }}
                              activityDisplayLabel="No activity linked"
                              engineerLabel={engineerLabel}
                              scopeForecastEngineers={forecastHoursByScope[s.id] ?? []}
                            />
                          </NestedAccordionRow>
                          {acts.map((a) => {
                            const lab = activityDisplayLabelForNode(a);
                            const keyA = expandedActivityKeyFor(s.id, a.id);
                            const openA = expandedActivityKey === keyA;
                            return (
                              <NestedAccordionRow
                                key={a.id}
                                open={openA}
                                onToggle={() =>
                                  setExpandedActivityKey((k) => (k === keyA ? null : keyA))
                                }
                                title={lab}
                                titleAttr={`${lab}\nScope: ${s.name}`}
                              >
                                <ActivityHoursPanel
                                  allocationRows={allocationRows}
                                  scopeId={s.id}
                                  selection={{ mode: "node", node: a }}
                                  activityDisplayLabel={lab}
                                  engineerLabel={engineerLabel}
                                  scopeForecastEngineers={forecastHoursByScope[s.id] ?? []}
                                />
                              </NestedAccordionRow>
                            );
                          })}
                        </div>
                      ) : null}
                    </AccordionRow>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
