/**
 * Pure rules for timesheet preview issues (which column, which issue id).
 * Used by the timesheet table for per-cell markers and row filters.
 */

import type { ProgrammeNode } from "@/components/programme/types";
import { employeeCellIsKnown } from "@/lib/timesheet/employeeCellMatch";
import {
  activityCodeMatchLengthAt,
  normalise,
  normaliseProjCellRaw,
  sigWords,
  wordCoverage,
} from "@/lib/timesheet/timesheetImportResolve";
import {
  collectActivityNodesUnderScope,
  resolveScopeNodeForTaskIdCell,
} from "@/lib/timesheet/timesheetLinkedResolve";

const SCOPE_TASK_MIN_COVERAGE = 0.8;

export const TIMESHEET_ISSUE_IDS = [
  "hours_over_daily_cap",
  "unknown_employee",
  "scope_unmatched",
  "project_unmatched",
  "activity_not_under_scope",
  "activity_not_in_notes",
] as const;

export type TimesheetIssueId = (typeof TIMESHEET_ISSUE_IDS)[number];

export const TIMESHEET_ISSUE_LABELS: Record<TimesheetIssueId, string> = {
  hours_over_daily_cap: "Hours exceed 8",
  unknown_employee: "Unregistered employee",
  scope_unmatched: "Can't match to scope",
  project_unmatched: "Can't match to project",
  activity_not_under_scope: "Activity not under scope",
  activity_not_in_notes: "Activity ID not in notes",
};

export type TimesheetRowIssue = {
  issueId: TimesheetIssueId;
  /** Column index in the sheet row (same as `row` array index). */
  columnIndex: number;
};

export type TimesheetIssuesContext = {
  hoursIdx: number;
  employeeIdx: number;
  taskIdIdx: number;
  activityColIdx: number;
  notesIdx: number;
  projectIdx: number;
  scopeNames: string[];
  knownEmployees: Set<string>;
  /** When null, project column checks are skipped. */
  project: { projectCode: string | null; name: string } | null;
  /**
   * Explicit user-defined mappings: normalised raw text → scope node id.
   * Built from `timesheet_scope_mappings` for the project.
   * A hit here suppresses the `scope_unmatched` issue.
   */
  scopeMappings: Map<string, string>;
  /** Full programme tree for resolving activity → scope relationships. */
  programmeTree: ProgrammeNode[];
};

function matchesAnyScope(
  csvValue: string,
  scopeNames: string[],
  scopeMappings: Map<string, string>
): boolean {
  const t = csvValue.trim();
  if (!t) return false;
  if (scopeMappings.has(normalise(t))) return true;
  const aWords = sigWords(t);
  if (aWords.length === 0) {
    return scopeNames.some((name) => t.toLowerCase() === name.trim().toLowerCase());
  }
  return scopeNames.some(
    (name) =>
      normalise(t) === normalise(name) || wordCoverage(aWords, name) >= SCOPE_TASK_MIN_COVERAGE
  );
}

function scopeMatchForRow(
  row: string[],
  taskIdIdx: number,
  scopeNames: string[],
  scopeMappings: Map<string, string>
): boolean | null {
  if (scopeNames.length === 0 && scopeMappings.size === 0) return null;
  if (taskIdIdx < 0) return null;
  const val = (row[taskIdIdx] ?? "").trim();
  if (!val) return null;
  return matchesAnyScope(val, scopeNames, scopeMappings);
}

/**
 * Cell is OK when empty. Non-empty must align with this project's code or name
 * (case-insensitive, light normalisation).
 */
export function timesheetProjectCellMatches(
  cell: string,
  project: { projectCode: string | null; name: string }
): boolean {
  const t = normaliseProjCellRaw(cell).trim().toLowerCase();
  if (!t) return true;

  const code = project.projectCode?.trim();
  if (code) {
    const c = code.toLowerCase();
    if (t === c) return true;
    const tCompact = t.replace(/[^a-z0-9]/g, "");
    const cCompact = c.replace(/[^a-z0-9]/g, "");
    if (
      tCompact &&
      cCompact &&
      (tCompact === cCompact || tCompact.includes(cCompact) || cCompact.includes(tCompact))
    ) {
      return true;
    }
  }

  const n = normaliseProjCellRaw(project.name).trim().toLowerCase();
  if (t === n) return true;
  const tCompact = t.replace(/[^a-z0-9]/g, "");
  const nCompact = n.replace(/[^a-z0-9]/g, "");
  if (tCompact && nCompact && (tCompact === nCompact || t.includes(n) || n.includes(t))) {
    return true;
  }
  return false;
}

function findActivityNodeByCode(code: string, nodes: ProgrammeNode[]): ProgrammeNode | null {
  const lower = code.toLowerCase();
  const walk = (ns: ProgrammeNode[]): ProgrammeNode | null => {
    for (const n of ns) {
      if (n.type === "activity") {
        if (n.activityId?.trim().toLowerCase() === lower || n.id === code) return n;
      }
      if (n.children.length > 0) {
        const found = walk(n.children);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(nodes);
}

export function computeTimesheetRowIssues(
  row: string[],
  ctx: TimesheetIssuesContext
): TimesheetRowIssue[] {
  const issues: TimesheetRowIssue[] = [];

  const {
    hoursIdx,
    employeeIdx,
    taskIdIdx,
    activityColIdx,
    notesIdx,
    projectIdx,
    scopeNames,
    knownEmployees,
    project,
    scopeMappings,
    programmeTree,
  } = ctx;

  if (hoursIdx >= 0) {
    const hoursVal = parseFloat(row[hoursIdx] ?? "");
    if (!isNaN(hoursVal) && hoursVal > 8) {
      issues.push({ issueId: "hours_over_daily_cap", columnIndex: hoursIdx });
    }
  }

  if (employeeIdx >= 0) {
    const empCell = (row[employeeIdx] ?? "").trim();
    if (empCell && !employeeCellIsKnown(empCell, knownEmployees)) {
      issues.push({ issueId: "unknown_employee", columnIndex: employeeIdx });
    }
  }

  const scopeResult = scopeMatchForRow(row, taskIdIdx, scopeNames, scopeMappings);
  if (scopeResult === false && taskIdIdx >= 0) {
    issues.push({ issueId: "scope_unmatched", columnIndex: taskIdIdx });
  }

  if (project && projectIdx >= 0) {
    const projCell = (row[projectIdx] ?? "").trim();
    if (projCell && !timesheetProjectCellMatches(projCell, project)) {
      issues.push({ issueId: "project_unmatched", columnIndex: projectIdx });
    }
  }

  // Notes present but contain no programme activity code
  if (notesIdx >= 0 && programmeTree.length > 0) {
    const notesText = (row[notesIdx] ?? "").trim();
    if (notesText) {
      const activityCodes: string[] = [];
      const collectCodes = (nodes: ProgrammeNode[]) => {
        for (const n of nodes) {
          if (n.type === "activity" && n.activityId?.trim()) {
            activityCodes.push(n.activityId.trim());
          }
          if (n.children.length > 0) collectCodes(n.children);
        }
      };
      collectCodes(programmeTree);

      if (activityCodes.length > 0) {
        const found = activityCodes.some((code) => {
          for (let i = 0; i < notesText.length; i++) {
            if (activityCodeMatchLengthAt(notesText, i, code) !== null) return true;
          }
          return false;
        });
        if (!found) {
          issues.push({ issueId: "activity_not_in_notes", columnIndex: notesIdx });
        }
      }
    }
  }

  // Activity code present in the programme but not under the matched scope
  if (activityColIdx >= 0 && taskIdIdx >= 0 && programmeTree.length > 0) {
    const activityCode = (row[activityColIdx] ?? "").trim();
    if (activityCode) {
      const matchedActivity = findActivityNodeByCode(activityCode, programmeTree);
      if (matchedActivity) {
        const scopeCell = (row[taskIdIdx] ?? "").trim();
        const scope = resolveScopeNodeForTaskIdCell(scopeCell, programmeTree, scopeMappings);
        if (scope) {
          const underScope = collectActivityNodesUnderScope(scope);
          if (!underScope.some((a) => a.id === matchedActivity.id)) {
            issues.push({ issueId: "activity_not_under_scope", columnIndex: activityColIdx });
          }
        }
      }
    }
  }

  return issues;
}
