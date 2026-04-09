"use client";

import { useMemo, useState } from "react";

import { ColumnFilter } from "@/components/forecast/ColumnFilter";
import { FilterFunnelIcon } from "@/components/ui/FilterFunnelIcon";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { findCol } from "@/lib/xlsx/xlsxUtils";

import type { SheetData } from "./types";

// ---------------------------------------------------------------------------
// Employee lookup
// ---------------------------------------------------------------------------

function buildEmployeeSet(pool: EngineerPoolEntry[]): Set<string> {
  const set = new Set<string>();
  for (const eng of pool) {
    if (eng.lastName && eng.firstName) {
      set.add(`${eng.lastName} ${eng.firstName[0]}.`.toLowerCase());
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// Scope matching
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set(["of", "the", "and", "for", "in", "at", "to", "a", "an"]);

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns significant words: length > 2 and not a stop word. */
function sigWords(s: string): string[] {
  return normalise(s)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Returns the fraction of `queryWords` that appear in `targetText`.
 * Used by both scope and notes matching (≥0.9 = match, <0.9 = mismatch).
 */
function wordCoverage(queryWords: string[], targetText: string): number {
  const targetSet = new Set(sigWords(targetText));
  return queryWords.filter((w) => targetSet.has(w)).length / queryWords.length;
}

/**
 * A scope matches if ≥90% of the task ID's significant words appear in the
 * scope name. Direction matters: we ask "does the scope contain the task ID
 * words?" not "how similar are both strings?". This means a short task ID like
 * "+17mOD +13mOD" correctly matches a longer scope name that contains those
 * tokens, while "Utilities North Soil" correctly fails against a scope that
 * only shares one word.
 */
function matchesAnyScope(csvValue: string, scopeNames: string[]): boolean {
  const aWords = sigWords(csvValue);
  if (aWords.length === 0) return false;
  return scopeNames.some(
    (name) => normalise(csvValue) === normalise(name) || wordCoverage(aWords, name) >= 0.9
  );
}

/**
 * Returns true if ≥90% of the task ID's significant words appear in the notes
 * text. Returns null when either value is empty (excluded from alert logic).
 */
function notesMatchTaskId(notes: string, taskId: string): boolean | null {
  const taskWords = sigWords(taskId);
  if (taskWords.length === 0) return null;
  const noteWords = sigWords(notes);
  if (noteWords.length === 0) return null;
  return wordCoverage(taskWords, notes) >= 0.9;
}

/**
 * Per-row scope match results:
 *   null  → empty task ID value, excluded from all counts
 *   true  → matched a scope (≥90% of task ID words found in a scope name)
 *   false → task ID words could not be matched to any scope — flag as 3
 *
 * Every non-empty task ID is checked, including short codes and single words.
 * Guard: if scopeNames is empty the whole check is skipped (all null) so that
 * an unloaded programme tree does not produce spurious alerts.
 */
function computeScopeMatchResults(
  rows: string[][],
  taskIdIdx: number,
  scopeNames: string[]
): (boolean | null)[] {
  if (scopeNames.length === 0 || taskIdIdx < 0) {
    return rows.map(() => null);
  }

  return rows.map((row) => {
    const val = (row[taskIdIdx] ?? "").trim();
    if (!val) return null;
    return matchesAnyScope(val, scopeNames);
  });
}

// ---------------------------------------------------------------------------
// Legend + filter config
// ---------------------------------------------------------------------------

const ALERT_OPTIONS: { code: string; label: string }[] = [
  { code: "1", label: ">8: hours exceed 8" },
  { code: "2", label: "UE: unregistered employee" },
  { code: "3", label: "MS: mismatch scope" },
  { code: "4", label: "MN: wrong input code" },
];

const ALERT_CODES = ALERT_OPTIONS.map((o) => o.code);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimesheetTable({
  sheet,
  engineerPool,
  scopeNames,
}: {
  sheet: SheetData;
  engineerPool: EngineerPoolEntry[];
  scopeNames: string[];
}) {
  // null = no filter active (all rows shown); Set = show only rows with those alert codes
  const [activeFilters, setActiveFilters] = useState<Set<string> | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);

  const hoursIdx = findCol(sheet.headers, ["hours", "hrs", "hours worked"]);
  const employeeIdx = findCol(sheet.headers, [
    "employee",
    "employee code",
    "emp code",
    "engineer code",
    "code",
    "engineer",
  ]);
  const taskIdIdx = findCol(sheet.headers, ["task id", "task_id", "taskid", "scope id", "scope"]);
  const notesIdx = findCol(sheet.headers, ["notes", "note", "description", "comments", "comment"]);

  const knownEmployees = useMemo(() => buildEmployeeSet(engineerPool), [engineerPool]);

  const scopeMatchResults = useMemo(
    () => computeScopeMatchResults(sheet.rows, taskIdIdx, scopeNames),
    [sheet.rows, taskIdIdx, scopeNames]
  );

  const rowAlertData = useMemo(
    () =>
      sheet.rows.map((row, ri) => {
        const alertCodes: string[] = [];
        const detailLabels: string[] = [];

        const hoursVal = hoursIdx >= 0 ? parseFloat(row[hoursIdx] ?? "") : NaN;
        if (!isNaN(hoursVal) && hoursVal > 8) {
          alertCodes.push("1");
          detailLabels.push(">8");
        }

        if (employeeIdx >= 0) {
          const empRaw = (row[employeeIdx] ?? "").trim().toLowerCase();
          if (empRaw && !knownEmployees.has(empRaw)) {
            alertCodes.push("2");
            detailLabels.push("UE");
          }
        }

        const isMismatchScope = scopeMatchResults[ri] === false;
        if (isMismatchScope) {
          alertCodes.push("3");
          detailLabels.push("MS");
        }

        const notesVal = notesIdx >= 0 ? (row[notesIdx] ?? "").trim() : "";
        const taskIdVal = taskIdIdx >= 0 ? (row[taskIdIdx] ?? "").trim() : "";
        if (isMismatchScope || notesMatchTaskId(notesVal, taskIdVal) === false) {
          alertCodes.push("4");
          detailLabels.push("MN");
        }

        return { row, ri, alertCodes, detailLabels };
      }),

    [sheet.rows, hoursIdx, employeeIdx, notesIdx, taskIdIdx, knownEmployees, scopeMatchResults]
  );

  const visibleRows =
    activeFilters === null
      ? rowAlertData
      : rowAlertData.filter(({ alertCodes }) => alertCodes.some((c) => activeFilters.has(c)));

  return (
    <div>
      {filterAnchor && (
        <ColumnFilter
          options={ALERT_CODES}
          selected={activeFilters ?? new Set()}
          anchorRect={filterAnchor}
          onChange={(selected) =>
            // null = all checked in ColumnFilter ("no filter") → show only alerted rows
            // empty set = none checked → reset to show all rows (null)
            setActiveFilters(
              selected === null ? new Set(ALERT_CODES) : selected.size === 0 ? null : selected
            )
          }
          onClose={() => setFilterAnchor(null)}
        />
      )}
      {/* Legend */}
      <div className="border-border bg-background flex flex-wrap gap-4 border-b px-4 py-2">
        {ALERT_OPTIONS.map(({ code, label }) => (
          <span key={code} className="text-muted-foreground text-xs">
            <span className="text-status-critical font-semibold">{code}</span>
            {" — "}
            {label}
          </span>
        ))}
      </div>

      <table className="border-border w-max border-collapse text-sm">
        <thead className="bg-card sticky top-0 z-10">
          <tr>
            <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-right text-xs font-medium tracking-wide whitespace-nowrap uppercase select-none">
              No.
            </th>
            <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase">
              <span className="flex items-center gap-0.5">
                Alert
                <button
                  type="button"
                  onClick={(e) => setFilterAnchor(e.currentTarget.getBoundingClientRect())}
                  title="Filter by alert"
                  className={`ml-1 rounded p-0.5 transition-colors ${activeFilters !== null ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <FilterFunnelIcon />
                </button>
              </span>
            </th>
            <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase">
              Details
            </th>
            {sheet.headers.map((h, i) => (
              <th
                key={i}
                className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase"
              >
                {h ? (
                  h.trim().toLowerCase() === "task id" ? (
                    "Task ID (Scope)"
                  ) : (
                    h
                  )
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(({ row, ri, alertCodes, detailLabels }) => {
            const hasAlert = alertCodes.length > 0;
            return (
              <tr key={ri} className="hover:bg-background">
                <td className="border-border text-muted-foreground border-r border-b px-4 py-2 text-right whitespace-nowrap tabular-nums select-none">
                  {ri + 1}
                </td>
                <td className="border-border text-status-critical border-r border-b px-4 py-2 font-medium whitespace-nowrap">
                  {hasAlert ? alertCodes.join(", ") : ""}
                </td>
                <td className="border-border text-muted-foreground border-r border-b px-4 py-2 whitespace-nowrap">
                  {hasAlert ? detailLabels.join(", ") : ""}
                </td>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-border text-foreground border-r border-b px-4 py-2 whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
