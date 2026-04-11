/**
 * Pure helpers for resolving timesheet import columns (Proj. #, Task ID, Notes → activities).
 */

import type { ProjectDbRow } from "@/types/project";

const STOP_WORDS = new Set(["of", "the", "and", "for", "in", "at", "to", "a", "an"]);

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sigWords(s: string): string[] {
  return normalise(s)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Fraction of query words that appear in target text (directional). */
export function wordCoverage(queryWords: string[], targetText: string): number {
  const targetSet = new Set(sigWords(targetText));
  if (queryWords.length === 0) return 0;
  return queryWords.filter((w) => targetSet.has(w)).length / queryWords.length;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalise spreadsheet cell: BOM, NBSP, Excel dash variants → ASCII hyphen for parsing.
 */
export function normaliseProjCellRaw(raw: string): string {
  return raw
    .replace(/^\uFEFF|\uFEFF$/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .trim();
}

/**
 * Split Proj. # into `project_code` + optional name hint.
 * Supports `[CODE] - Name`, `CODE - Name` (name may be empty or abbreviated), and `CODE` alone.
 */
export function parseProjNumber(raw: string): { code: string; namePart: string } | null {
  const t = normaliseProjCellRaw(raw);
  if (!t) return null;
  const bracketed = t.match(/^\s*\[([^\]]+)\]\s*-\s*([\s\S]*?)\s*$/);
  if (bracketed) {
    return { code: bracketed[1].trim(), namePart: bracketed[2].trim() };
  }
  const plain = t.match(/^(.+?)\s*-\s*(.*)$/);
  if (plain) {
    return { code: plain[1].trim(), namePart: plain[2].trim() };
  }
  const codeOnly = t.match(/^(\S+)$/);
  if (codeOnly) {
    return { code: codeOnly[1].trim(), namePart: "" };
  }
  return null;
}

export type ProjectForImport = Pick<ProjectDbRow, "id" | "name" | "project_code">;

/**
 * Match parsed left segment to `project_code`, else to `projects.id` when code is unset in DB.
 * **Unique match wins** regardless of name suffix. If several rows share that code/id,
 * the name part disambiguates (fuzzy).
 */
export function resolveProjectFromProjCell(
  raw: string,
  projects: ProjectForImport[],
  nameMinCoverage: number
): string | null {
  const parsed = parseProjNumber(raw);
  if (!parsed) return null;
  const codeLc = parsed.code.toLowerCase();

  let candidates = projects.filter((p) => (p.project_code ?? "").trim().toLowerCase() === codeLc);
  /** Rows often have `project_code` unset; left segment may be `projects.id` (e.g. `1`). */
  if (candidates.length === 0) {
    candidates = projects.filter((p) => p.id.trim().toLowerCase() === codeLc);
  }
  if (candidates.length === 0) return null;

  if (candidates.length === 1) {
    return candidates[0].id;
  }

  const { namePart } = parsed;
  const nameTrim = namePart.trim();
  if (!nameTrim) {
    return null;
  }

  let bestId: string | null = null;
  let bestScore = nameMinCoverage - 0.001;

  for (const p of candidates) {
    if (normalise(namePart) === normalise(p.name)) return p.id;
    const wordsCell = sigWords(namePart);
    const wordsDb = sigWords(p.name);
    if (wordsCell.length === 0 && wordsDb.length === 0) {
      if (namePart.trim().toLowerCase() === p.name.trim().toLowerCase()) return p.id;
      continue;
    }
    /** Spreadsheet name often extends the formal name (e.g. "… HS2"); check both directions. */
    const score =
      wordsCell.length > 0 && wordsDb.length > 0
        ? Math.max(wordCoverage(wordsCell, p.name), wordCoverage(wordsDb, namePart))
        : wordsCell.length > 0
          ? wordCoverage(wordsCell, p.name)
          : wordCoverage(wordsDb, namePart);
    if (score >= nameMinCoverage && score > bestScore) {
      bestScore = score;
      bestId = p.id;
    }
  }
  return bestId;
}

function scopeNameMatchesTask(taskIdRaw: string, scopeName: string, minCoverage: number): boolean {
  if (normalise(taskIdRaw) === normalise(scopeName)) return true;
  const words = sigWords(taskIdRaw);
  if (words.length === 0) {
    return taskIdRaw.trim().toLowerCase() === scopeName.trim().toLowerCase();
  }
  return wordCoverage(words, scopeName) >= minCoverage;
}

function scopeMatchScore(taskIdRaw: string, scopeName: string): number {
  if (normalise(taskIdRaw) === normalise(scopeName)) return 1;
  const words = sigWords(taskIdRaw);
  if (words.length === 0) {
    return taskIdRaw.trim().toLowerCase() === scopeName.trim().toLowerCase() ? 1 : 0;
  }
  return wordCoverage(words, scopeName);
}

/** Best scope id for this project, or null. */
export function findBestScopeId(
  taskIdRaw: string,
  scopes: { id: string; name: string }[],
  minCoverage: number
): string | null {
  const t = taskIdRaw.trim();
  if (!t) return null;
  let bestId: string | null = null;
  let bestScore = minCoverage - 0.001;
  for (const s of scopes) {
    if (!scopeNameMatchesTask(t, s.name, minCoverage)) continue;
    const score = scopeMatchScore(t, s.name);
    if (score > bestScore) {
      bestScore = score;
      bestId = s.id;
    }
  }
  return bestId;
}

export interface ProgrammeNodeImportRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  type: string;
  name: string;
  activity_id: string | null;
}

function buildChildrenMap(nodes: ProgrammeNodeImportRow[]): Map<string | null, string[]> {
  const m = new Map<string | null, string[]>();
  for (const n of nodes) {
    const p = n.parent_id;
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(n.id);
  }
  return m;
}

/** All `activity` nodes under this scope (any depth). */
export function collectActivitiesUnderScope(
  scopeId: string,
  nodes: ProgrammeNodeImportRow[]
): ProgrammeNodeImportRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = buildChildrenMap(nodes);
  const out: ProgrammeNodeImportRow[] = [];
  const stack = [...(children.get(scopeId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    const n = byId.get(id);
    if (!n) continue;
    if (n.type === "activity") out.push(n);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return out;
}

/**
 * Resolve Activity column cell to a programme activity node under the scope
 * (`activity_id` column, node id, or name / fuzzy name).
 */
export function matchActivityFromSpecifier(
  spec: string,
  activities: ProgrammeNodeImportRow[],
  nameMinCoverage: number
): string | null {
  const t = spec.trim();
  if (!t) return null;
  const lower = t.toLowerCase();

  for (const a of activities) {
    if (a.id === t) return a.id;
  }
  for (const a of activities) {
    const aid = a.activity_id?.trim();
    if (aid && aid.toLowerCase() === lower) return a.id;
  }
  for (const a of activities) {
    if (a.name.trim().toLowerCase() === lower) return a.id;
  }
  for (const a of activities) {
    if (normalise(t) === normalise(a.name)) return a.id;
  }
  const words = sigWords(t);
  if (words.length > 0) {
    let bestId: string | null = null;
    let bestScore = nameMinCoverage - 0.001;
    for (const a of activities) {
      const sc = wordCoverage(words, a.name);
      if (sc >= nameMinCoverage && sc > bestScore) {
        bestScore = sc;
        bestId = a.id;
      }
    }
    if (bestId) return bestId;
  }
  return null;
}

/**
 * Leftmost match of token in notes. Multi-word / long tokens use case-insensitive substring;
 * short single tokens use word boundaries.
 */
function findTokenIndex(notes: string, token: string): number {
  const t = token.trim();
  if (!t) return -1;
  const lowerNotes = notes.toLowerCase();
  const lowerT = t.toLowerCase();
  if (t.includes(" ") || t.length >= 8) {
    return lowerNotes.indexOf(lowerT);
  }
  if (t.length >= 4) {
    const idx = notes.indexOf(t);
    if (idx >= 0) return idx;
    return lowerNotes.indexOf(lowerT);
  }
  const re = new RegExp(`\\b${escapeRegex(t)}\\b`, "i");
  const m = notes.match(re);
  return m?.index ?? -1;
}

/**
 * First matching activity (by position in notes), preferring longer tokens.
 * Checks node `id`, `activity_id` column, then `name`.
 */
export function matchActivityIdInNotes(
  notes: string,
  activities: ProgrammeNodeImportRow[]
): string | null {
  const text = notes;
  if (!text.trim()) return null;

  type Token = { nodeId: string; value: string };
  const tokens: Token[] = [];
  for (const a of activities) {
    tokens.push({ nodeId: a.id, value: a.id });
    if (a.activity_id?.trim()) {
      tokens.push({ nodeId: a.id, value: a.activity_id.trim() });
    }
    if (a.name.trim()) {
      tokens.push({ nodeId: a.id, value: a.name.trim() });
    }
  }

  tokens.sort((a, b) => b.value.length - a.value.length);

  let bestPos = Infinity;
  let bestNodeId: string | null = null;
  for (const { nodeId, value } of tokens) {
    const idx = findTokenIndex(text, value);
    if (idx >= 0 && idx < bestPos) {
      bestPos = idx;
      bestNodeId = nodeId;
    }
  }
  return bestNodeId;
}
