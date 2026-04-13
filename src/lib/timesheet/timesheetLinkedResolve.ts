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
      let found: ProgrammeNode | null = null;
      const findById = (nodes: ProgrammeNode[]) => {
        for (const n of nodes) {
          if (n.id === mappedScopeId) {
            found = n;
            return;
          }
          if (n.children.length > 0) findById(n.children);
        }
      };
      findById(programmeTree);
      if (found) return found;
    }
  }

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
