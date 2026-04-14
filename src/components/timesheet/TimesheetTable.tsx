"use client";

import { AlertTriangle, MousePointerClick } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ProgrammeNode } from "@/components/programme/types";
import { ColumnFilter } from "@/components/forecast/ColumnFilter";
import { FilterFunnelIcon } from "@/components/ui/FilterFunnelIcon";
import {
  buildEmployeeCellMatchSetFromGridPool,
  resolveEngineerFromEmployeeCell,
  type EngineerPoolRow,
} from "@/lib/timesheet/employeeCellMatch";
import { collectScopeNodes } from "@/lib/programme/programmeTree";
import {
  findParentScopeNameForActivity,
  resolveActivityForTimesheetCode,
  resolveScopeNodeForTaskIdCell,
} from "@/lib/timesheet/timesheetLinkedResolve";
import {
  buildActivityLinkTokens,
  segmentNotesWithActivityCodes,
  type NotesActivitySegment,
} from "@/lib/timesheet/timesheetNotesActivitySegments";
import {
  computeTimesheetRowIssues,
  TIMESHEET_ISSUE_IDS,
  TIMESHEET_ISSUE_LABELS,
  type TimesheetIssueId,
  type TimesheetRowIssue,
} from "@/lib/timesheet/timesheetRowIssues";
import { findCol } from "@/lib/xlsx/xlsxUtils";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { Project } from "@/types/project";

import { TimesheetLinkSidebar, type TimesheetSidebarPanel } from "./TimesheetLinkSidebar";
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

function poolToEngRows(pool: EngineerPoolEntry[]): EngineerPoolRow[] {
  return pool.map((p) => ({
    id: p.id,
    code: p.code,
    first_name: p.firstName ?? "",
    last_name: p.lastName ?? "",
  }));
}

function TimesheetDataCell({ value, issues }: { value: string; issues: TimesheetRowIssue[] }) {
  if (issues.length === 0) {
    return <>{value}</>;
  }
  return (
    <div className="relative pl-6">
      <span
        className="text-status-critical pointer-events-none absolute top-1/2 left-0 inline-flex -translate-y-1/2"
        aria-hidden
      >
        <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      </span>
      <span className="block">{value}</span>
    </div>
  );
}

function TimesheetNotesWithActivityTags({
  segments,
  issues,
  onCodeClick,
}: {
  segments: NotesActivitySegment[];
  issues: TimesheetRowIssue[];
  onCodeClick: (matchedText: string) => void;
}) {
  const body = (
    <span className="block max-w-md min-w-0 break-words whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <button
            key={i}
            type="button"
            className="bg-status-info-bg text-status-info hover:bg-status-info-bg/80 mx-0.5 inline rounded-sm px-1 py-0 align-baseline font-mono text-xs leading-snug font-medium transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onCodeClick(seg.text);
            }}
          >
            {seg.text}
          </button>
        )
      )}
    </span>
  );

  if (issues.length === 0) {
    return body;
  }
  return (
    <div className="relative pl-6">
      <span
        className="text-status-critical pointer-events-none absolute top-1/2 left-0 inline-flex -translate-y-1/2"
        aria-hidden
      >
        <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      </span>
      {body}
    </div>
  );
}

type LinkedSelection =
  | {
      rowIndex: number;
      colIndex: number;
      linkKind: "project" | "employee" | "scope";
      cellValue: string;
    }
  | {
      rowIndex: number;
      colIndex: number;
      linkKind: "activity";
      cellValue: string;
      matchedCode: string;
    }
  | null;

export function TimesheetTable({
  sheet,
  engineerPool,
  scopeNames,
  project,
  programmeTree,
  scopeMappings,
  onAddMapping,
}: {
  sheet: SheetData;
  engineerPool: EngineerPoolEntry[];
  scopeNames: string[];
  project: Project | null;
  programmeTree: ProgrammeNode[];
  scopeMappings: Map<string, string>;
  onAddMapping: (rawText: string, scopeId: string) => Promise<void>;
}) {
  const [activeFilters, setActiveFilters] = useState<Set<TimesheetIssueId> | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const [linkedSelection, setLinkedSelection] = useState<LinkedSelection>(null);

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
  const activityColIdx = findCol(sheet.headers, [
    "activity",
    "activity code",
    "activity id",
    "activity_id",
    "activity no",
    "activity no.",
  ]);
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

  const engRows = useMemo(() => poolToEngRows(engineerPool), [engineerPool]);

  const programmeScopes = useMemo(() => collectScopeNodes(programmeTree), [programmeTree]);

  const activityLinkTokens = useMemo(() => buildActivityLinkTokens(programmeTree), [programmeTree]);

  const issuesContext = useMemo(
    () => ({
      hoursIdx,
      employeeIdx,
      taskIdIdx,
      notesIdx,
      projectIdx,
      scopeNames,
      knownEmployees,
      project: project ? { projectCode: project.projectCode, name: project.name } : null,
      scopeMappings,
    }),
    [
      hoursIdx,
      employeeIdx,
      taskIdIdx,
      notesIdx,
      projectIdx,
      scopeNames,
      knownEmployees,
      project,
      scopeMappings,
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

  const openLinkedPanel = useCallback(
    (ri: number, ci: number, cell: string) => {
      const linkKind: "project" | "employee" | "scope" | null =
        project && projectIdx >= 0 && ci === projectIdx
          ? "project"
          : employeeIdx >= 0 && ci === employeeIdx
            ? "employee"
            : taskIdIdx >= 0 && ci === taskIdIdx
              ? "scope"
              : null;

      if (!linkKind) return;
      if (linkKind === "project" && !project) return;

      setLinkedSelection({ rowIndex: ri, colIndex: ci, linkKind, cellValue: cell });
    },
    [employeeIdx, project, projectIdx, taskIdIdx]
  );

  const openActivityPanel = useCallback(
    (ri: number, ci: number, cell: string, matchedCode: string) => {
      setLinkedSelection({
        rowIndex: ri,
        colIndex: ci,
        linkKind: "activity",
        cellValue: cell,
        matchedCode,
      });
    },
    []
  );

  const sidebarPanel = useMemo((): TimesheetSidebarPanel | null => {
    if (!linkedSelection) return null;
    const { linkKind, cellValue, rowIndex } = linkedSelection;
    if (linkKind === "project") {
      if (!project) return null;
      return { kind: "project", project, cellValue };
    }
    if (linkKind === "employee") {
      const { engineerId } = resolveEngineerFromEmployeeCell(cellValue, engRows);
      const engineer = engineerId ? (engineerPool.find((e) => e.id === engineerId) ?? null) : null;
      return { kind: "employee", engineer, cellValue };
    }
    if (linkKind === "scope") {
      const scope = resolveScopeNodeForTaskIdCell(cellValue, programmeTree, scopeMappings);
      return { kind: "scope", scope, cellValue };
    }
    if (linkKind === "activity") {
      const taskCell = taskIdIdx >= 0 ? (sheet.rows[rowIndex]?.[taskIdIdx] ?? "") : "";
      const { matchedCode } = linkedSelection;
      const activity = resolveActivityForTimesheetCode(
        matchedCode,
        taskCell,
        programmeTree,
        scopeMappings
      );
      const parentScopeName = activity
        ? findParentScopeNameForActivity(programmeTree, activity.id)
        : null;
      return { kind: "activity", activity, cellValue, matchedCode, parentScopeName };
    }
    return null;
  }, [
    linkedSelection,
    project,
    engRows,
    engineerPool,
    programmeTree,
    scopeMappings,
    sheet.rows,
    taskIdIdx,
  ]);

  useEffect(() => {
    if (!linkedSelection) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLinkedSelection(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [linkedSelection]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

      <div className="border-border bg-background flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        <button
          type="button"
          onClick={(e) => setFilterAnchor(e.currentTarget.getBoundingClientRect())}
          title="Filter rows by issue type"
          className={`text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors ${activeFilters !== null ? "text-gold" : ""}`}
        >
          <FilterFunnelIcon />
          Filter by issue
        </button>
        <p className="text-muted-foreground max-w-xl text-xs">
          Issues are marked with a small warning on the cell. Hover the marker for details. Click
          project, employee, or task / scope cells to see details on the right. Recognised activity
          codes in notes / description / activity columns appear as blue tags — click a tag for the
          activity sidebar.
        </p>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className={`min-h-0 min-w-0 flex-1 overflow-auto ${linkedSelection ? "pr-[min(20rem,100vw)]" : ""}`}
        >
          <table className="border-border w-max border-collapse text-sm">
            <thead className="bg-card sticky top-0 z-10">
              <tr>
                <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-right text-xs font-medium tracking-wide whitespace-nowrap uppercase select-none">
                  No.
                </th>
                {sheet.headers.map((h, i) => {
                  const isProjectLink = Boolean(project && projectIdx >= 0 && i === projectIdx);
                  const isEmployeeLink = employeeIdx >= 0 && i === employeeIdx;
                  const isScopeLink = taskIdIdx >= 0 && i === taskIdIdx;
                  const isNotesOrActivityTags =
                    (notesIdx >= 0 && i === notesIdx) ||
                    (activityColIdx >= 0 && i === activityColIdx);
                  const isLinkedCol =
                    isProjectLink || isEmployeeLink || isScopeLink || isNotesOrActivityTags;
                  const linkHint = isProjectLink
                    ? "Linked to this project — click any cell for details"
                    : isEmployeeLink
                      ? "Linked to the engineer pool — click any cell for details"
                      : isScopeLink
                        ? "Linked to programme scopes — click any cell for details"
                        : isNotesOrActivityTags
                          ? "Activity codes matching the programme appear as clickable tags"
                          : undefined;

                  return (
                    <th
                      key={i}
                      title={linkHint}
                      className={`border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase ${
                        isLinkedCol ? "bg-muted/25" : ""
                      }`}
                    >
                      <span className="inline-flex max-w-full items-center gap-1.5">
                        <span className="min-w-0 truncate">
                          {h ? (
                            normaliseHeaderLabel(h) === "task id" ? (
                              "Task ID (Scope)"
                            ) : (
                              h
                            )
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </span>
                        {isProjectLink || isEmployeeLink || isScopeLink ? (
                          <MousePointerClick
                            className="text-gold h-3.5 w-3.5 shrink-0"
                            strokeWidth={2}
                            aria-hidden
                          />
                        ) : null}
                      </span>
                    </th>
                  );
                })}
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
                      const isProjectLink = Boolean(
                        project && projectIdx >= 0 && ci === projectIdx
                      );
                      const isEmployeeLink = employeeIdx >= 0 && ci === employeeIdx;
                      const isScopeLink = taskIdIdx >= 0 && ci === taskIdIdx;
                      const isNotesOrActivityTags =
                        (notesIdx >= 0 && ci === notesIdx) ||
                        (activityColIdx >= 0 && ci === activityColIdx);
                      const isLinked = isProjectLink || isEmployeeLink || isScopeLink;
                      const isActivityTagCol =
                        isNotesOrActivityTags && activityLinkTokens.length > 0;
                      const segments = isActivityTagCol
                        ? segmentNotesWithActivityCodes(cell, activityLinkTokens)
                        : null;
                      const hasActivityTags = Boolean(segments?.some((s) => s.kind === "code"));
                      const isActivitySidebar =
                        linkedSelection?.linkKind === "activity" &&
                        linkedSelection.rowIndex === ri &&
                        linkedSelection.colIndex === ci;
                      const isSelected =
                        (linkedSelection?.rowIndex === ri &&
                          linkedSelection?.colIndex === ci &&
                          linkedSelection.linkKind !== "activity") ||
                        isActivitySidebar;

                      return (
                        <td
                          key={ci}
                          role={isLinked ? "button" : undefined}
                          tabIndex={isLinked ? 0 : undefined}
                          className={`border-border text-foreground border-r border-b px-4 py-2 align-top ${
                            hasActivityTags || (notesIdx >= 0 && ci === notesIdx)
                              ? "max-w-md whitespace-normal"
                              : "whitespace-nowrap"
                          } ${
                            isLinked
                              ? "hover:bg-muted/50 focus-visible:ring-gold cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
                              : ""
                          } ${isSelected ? "bg-gold/10 ring-gold ring-1 ring-inset" : ""}`}
                          title={cellIssueTooltip(cellIssues)}
                          onClick={
                            isLinked
                              ? () => {
                                  openLinkedPanel(ri, ci, cell);
                                }
                              : undefined
                          }
                          onKeyDown={
                            isLinked
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openLinkedPanel(ri, ci, cell);
                                  }
                                }
                              : undefined
                          }
                        >
                          {segments && hasActivityTags ? (
                            <TimesheetNotesWithActivityTags
                              segments={segments}
                              issues={cellIssues}
                              onCodeClick={(code) => openActivityPanel(ri, ci, cell, code)}
                            />
                          ) : (
                            <TimesheetDataCell value={cell} issues={cellIssues} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <TimesheetLinkSidebar
          panel={sidebarPanel}
          engineerPool={engineerPool}
          programmeScopes={programmeScopes}
          onAddMapping={onAddMapping}
          onClose={() => setLinkedSelection(null)}
        />
      </div>
    </div>
  );
}

function normaliseHeaderLabel(h: string): string {
  return h.trim().toLowerCase();
}
