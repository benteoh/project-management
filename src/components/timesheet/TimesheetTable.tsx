"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";

import { ColumnFilter } from "@/components/forecast/ColumnFilter";
import { FilterFunnelIcon } from "@/components/ui/FilterFunnelIcon";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { buildEmployeeCellMatchSetFromGridPool } from "@/lib/timesheet/employeeCellMatch";
import {
  computeTimesheetRowIssues,
  TIMESHEET_ISSUE_IDS,
  TIMESHEET_ISSUE_LABELS,
  type TimesheetIssueId,
  type TimesheetRowIssue,
} from "@/lib/timesheet/timesheetRowIssues";
import { findCol } from "@/lib/xlsx/xlsxUtils";

import type { SheetData } from "./types";

function groupIssuesByColumn(issues: TimesheetRowIssue[]): Map<number, TimesheetRowIssue[]> {
  const map = new Map<number, TimesheetRowIssue[]>();
  for (const issue of issues) {
    const list = map.get(issue.columnIndex) ?? [];
    list.push(issue);
    map.set(issue.columnIndex, list);
  }
  return map;
}

function cellIssueTooltip(issues: TimesheetRowIssue[]): string | undefined {
  if (issues.length === 0) return undefined;
  return issues.map((i) => TIMESHEET_ISSUE_LABELS[i.issueId]).join(" · ");
}

function TimesheetDataCell({ value, issues }: { value: string; issues: TimesheetRowIssue[] }) {
  if (issues.length === 0) {
    return <>{value}</>;
  }
  return (
    <div className="relative pr-6">
      <span className="block">{value}</span>
      <span
        className="text-status-critical pointer-events-none absolute top-1/2 right-0 inline-flex -translate-y-1/2"
        aria-hidden
      >
        <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      </span>
    </div>
  );
}

export function TimesheetTable({
  sheet,
  engineerPool,
  scopeNames,
  projectForTimesheet,
}: {
  sheet: SheetData;
  engineerPool: EngineerPoolEntry[];
  scopeNames: string[];
  /** When set, validates a Project / Job column against this project. */
  projectForTimesheet: { projectCode: string | null; name: string } | null;
}) {
  const [activeFilters, setActiveFilters] = useState<Set<TimesheetIssueId> | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);

  const hoursIdx = findCol(sheet.headers, ["hours", "hrs", "hours worked"]);
  const employeeIdx = findCol(sheet.headers, [
    "employee",
    "engineer",
    "employee code",
    "emp code",
    "engineer code",
    "code",
  ]);
  const taskIdIdx = findCol(sheet.headers, ["task id", "task_id", "taskid", "scope id", "scope"]);
  const notesIdx = findCol(sheet.headers, ["notes", "note", "description", "comments", "comment"]);
  const projectIdx = findCol(sheet.headers, [
    "project",
    "project code",
    "project id",
    "job",
    "job code",
    "job number",
    "job no",
    "wbs project",
    "proj",
    "proj no",
    "proj. #",
    "project #",
  ]);

  const knownEmployees = useMemo(
    () => buildEmployeeCellMatchSetFromGridPool(engineerPool),
    [engineerPool]
  );

  const issuesContext = useMemo(
    () => ({
      hoursIdx,
      employeeIdx,
      taskIdIdx,
      notesIdx,
      projectIdx,
      scopeNames,
      knownEmployees,
      project: projectForTimesheet,
    }),
    [
      hoursIdx,
      employeeIdx,
      taskIdIdx,
      notesIdx,
      projectIdx,
      scopeNames,
      knownEmployees,
      projectForTimesheet,
    ]
  );

  const rowIssueRows = useMemo(
    () =>
      sheet.rows.map((row, ri) => {
        const issues = computeTimesheetRowIssues(row, issuesContext);
        return { row, ri, issues };
      }),
    [sheet.rows, issuesContext]
  );

  const issueLabelRecord = TIMESHEET_ISSUE_LABELS as Record<string, string>;

  const visibleRows =
    activeFilters === null
      ? rowIssueRows
      : rowIssueRows.filter(({ issues }) => issues.some((i) => activeFilters.has(i.issueId)));

  return (
    <div>
      {filterAnchor && (
        <ColumnFilter
          options={[...TIMESHEET_ISSUE_IDS]}
          optionLabels={issueLabelRecord}
          selected={activeFilters === null ? null : activeFilters}
          anchorRect={filterAnchor}
          onChange={(selected) => {
            if (selected === null) {
              setActiveFilters(new Set(TIMESHEET_ISSUE_IDS));
              return;
            }
            if (selected.size === 0) {
              setActiveFilters(null);
              return;
            }
            setActiveFilters(selected as Set<TimesheetIssueId>);
          }}
          onClose={() => setFilterAnchor(null)}
        />
      )}

      <div className="border-border bg-background flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        <p className="text-muted-foreground max-w-xl text-xs">
          Issues are marked with a small warning on the cell. Hover the marker for details.
        </p>
        <button
          type="button"
          onClick={(e) => setFilterAnchor(e.currentTarget.getBoundingClientRect())}
          title="Filter rows by issue type"
          className={`text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors ${activeFilters !== null ? "text-gold" : ""}`}
        >
          <FilterFunnelIcon />
          Filter by issue
        </button>
      </div>

      <table className="border-border w-max border-collapse text-sm">
        <thead className="bg-card sticky top-0 z-10">
          <tr>
            <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-right text-xs font-medium tracking-wide whitespace-nowrap uppercase select-none">
              No.
            </th>
            {sheet.headers.map((h, i) => (
              <th
                key={i}
                className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase"
              >
                {h ? (
                  normaliseHeaderLabel(h) === "task id" ? (
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
          {visibleRows.map(({ row, ri, issues }) => {
            const byCol = groupIssuesByColumn(issues);
            return (
              <tr key={ri} className="hover:bg-background">
                <td className="border-border text-muted-foreground border-r border-b px-4 py-2 text-right whitespace-nowrap tabular-nums select-none">
                  {ri + 1}
                </td>
                {row.map((cell, ci) => {
                  const cellIssues = byCol.get(ci) ?? [];
                  return (
                    <td
                      key={ci}
                      className="border-border text-foreground border-r border-b px-4 py-2 align-top whitespace-nowrap"
                      title={cellIssueTooltip(cellIssues)}
                    >
                      <TimesheetDataCell value={cell} issues={cellIssues} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function normaliseHeaderLabel(h: string): string {
  return h.trim().toLowerCase();
}
