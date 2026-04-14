/**
 * Resolve timesheet cell values to programme / domain entities for the link sidebar.
 */

import type { ProgrammeNode } from "@/components/programme/types";
import { normalise, sigWords, wordCoverage } from "@/lib/timesheet/timesheetImportResolve";

const SCOPE_TASK_MIN_COVERAGE = 0.8;

function scoreTaskIdAgainstScopeName(csvValue: string, scopeName: string): number {
  const t = csvValue.trim();
  const name = scopeName.trim();
  if (!t || !name) return 0;
  if (t.toLowerCase() === name.toLowerCase()) return 1;
  const aWords = sigWords(t);
  if (aWords.length === 0) {
    return t.toLowerCase() === name.toLowerCase() ? 1 : 0;
  }
  if (normalise(t) === normalise(name)) return 1;
  return wordCoverage(aWords, name);
}

/**
 * Best programme scope node for a Task ID / scope cell.
 *
 * Checks `scopeMappings` (normalised rawText → scopeId) first, then falls back
 * to the ≥80% word-coverage fuzzy match against scope names.
 */
function findScopeNodeById(nodes: ProgrammeNode[], id: string): ProgrammeNode | null {
  for (const n of nodes) {
    if (n.type === "scope" && n.id === id) return n;
    if (n.children.length > 0) {
      const d = findScopeNodeById(n.children, id);
      if (d) return d;
    }
  }
  return null;
}

export function resolveScopeNodeForTaskIdCell(
  csvValue: string,
  programmeTree: ProgrammeNode[],
  scopeMappings?: Map<string, string>
): ProgrammeNode | null {
  const t = csvValue.trim();
  if (!t) return null;

  // Check explicit mapping first
  if (scopeMappings && scopeMappings.size > 0) {
    const mappedScopeId = scopeMappings.get(normalise(t));
    if (mappedScopeId) {
      const found = findScopeNodeById(programmeTree, mappedScopeId);
      if (found) return found;
    }
  }

  // Exact programme scope id (e.g. seed CSV Task column = `s11`)
  const byExactId = findScopeNodeById(programmeTree, t);
  if (byExactId) return byExactId;

  // Fuzzy match fallback
  let bestNode: ProgrammeNode | null = null;
  let bestScore = -1;

  const visit = (nodes: ProgrammeNode[]) => {
    for (const n of nodes) {
      if (n.type === "scope") {
        const score = scoreTaskIdAgainstScopeName(t, n.name);
        if (score >= SCOPE_TASK_MIN_COVERAGE && score > bestScore) {
          bestScore = score;
          bestNode = n;
        }
      }
      if (n.children.length > 0) visit(n.children);
    }
  };

  visit(programmeTree);
  return bestNode;
}

/** Activities nested under a scope node (recursive). */
export function collectActivityNodesUnderScope(scope: ProgrammeNode | null): ProgrammeNode[] {
  if (!scope) return [];
  const out: ProgrammeNode[] = [];
  const walk = (nodes: ProgrammeNode[]) => {
    for (const n of nodes) {
      if (n.type === "activity") out.push(n);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(scope.children);
  return out;
}

function collectAllActivityNodes(programmeTree: ProgrammeNode[]): ProgrammeNode[] {
  const out: ProgrammeNode[] = [];
  const walk = (nodes: ProgrammeNode[]) => {
    for (const n of nodes) {
      if (n.type === "activity") out.push(n);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(programmeTree);
  return out;
}

/**
 * Nearest enclosing scope name for an activity node id (for sidebar context).
 */
export function findParentScopeNameForActivity(
  programmeTree: ProgrammeNode[],
  activityNodeId: string
): string | null {
  const visit = (nodes: ProgrammeNode[], parentScope: ProgrammeNode | null): string | null => {
    for (const n of nodes) {
      const scope = n.type === "scope" ? n : parentScope;
      if (n.type === "activity" && n.id === activityNodeId) {
        return parentScope?.name ?? null;
      }
      const found = visit(n.children, scope);
      if (found !== null) return found;
    }
    return null;
  };
  return visit(programmeTree, null);
}

/**
 * Resolve a clicked activity code to a programme activity: prefer activities under the row’s
 * resolved scope (from the Task ID cell), then search the whole tree.
 */
export function resolveActivityForTimesheetCode(
  matchedText: string,
  taskIdCellValue: string,
  programmeTree: ProgrammeNode[],
  scopeMappings: Map<string, string>
): ProgrammeNode | null {
  const scope = resolveScopeNodeForTaskIdCell(taskIdCellValue, programmeTree, scopeMappings);
  const underScope = collectActivityNodesUnderScope(scope);
  const t = matchedText.trim();
  const lower = t.toLowerCase();

  for (const a of underScope) {
    if (a.activityId?.trim().toLowerCase() === lower) return a;
    if (a.id === t) return a;
  }

  for (const a of collectAllActivityNodes(programmeTree)) {
    if (a.activityId?.trim().toLowerCase() === lower) return a;
    if (a.id === t) return a;
  }

  return null;
}
