/**
 * Timesheet Employee column: values are **names** (not primary engineer codes).
 * Code is only a last-resort fallback for legacy sheets.
 */

import type { EngineerDbRow } from "@/types/engineer-pool";

export type EngineerPoolRow = Pick<EngineerDbRow, "id" | "code" | "first_name" | "last_name">;

function normaliseCell(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addCellKeys(set: Set<string>, raw: string): void {
  const t = raw.trim();
  if (!t) return;
  set.add(t.toLowerCase());
  const n = normaliseCell(t);
  if (n) set.add(n);
}

/**
 * All cell variants recognised for this engineer (for UE alerts / quick lookup).
 */
export function buildEmployeeCellMatchSet(pool: EngineerPoolRow[]): Set<string> {
  const set = new Set<string>();
  for (const e of pool) {
    addCellKeys(set, e.code);
    const fn = e.first_name?.trim();
    const ln = e.last_name?.trim();
    if (!fn || !ln) continue;
    addCellKeys(set, `${ln} ${fn[0]}.`);
    addCellKeys(set, `${ln} ${fn[0]}`);
    addCellKeys(set, `${ln}, ${fn}`);
    addCellKeys(set, `${ln}, ${fn[0]}.`);
    addCellKeys(set, `${ln}, ${fn[0]}`);
    addCellKeys(set, `${fn} ${ln}`);
    addCellKeys(set, `${ln} ${fn}`);
  }
  return set;
}

/** Pool entry shape from programme UI (optional names). */
export function buildEmployeeCellMatchSetFromGridPool(
  pool: { code: string; firstName?: string; lastName?: string }[]
): Set<string> {
  const rows: EngineerPoolRow[] = pool.map((p) => ({
    id: "",
    code: p.code,
    first_name: p.firstName ?? "",
    last_name: p.lastName ?? "",
  }));
  return buildEmployeeCellMatchSet(rows);
}

export function normaliseEmployeeCell(s: string): string {
  return normaliseCell(s);
}

/** True if `cellRaw` is in the precomputed set (tries lower + normalised). */
export function employeeCellIsKnown(cellRaw: string, known: Set<string>): boolean {
  const t = cellRaw.trim();
  if (!t) return false;
  if (known.has(t.toLowerCase())) return true;
  const n = normaliseCell(t);
  return n.length > 0 && known.has(n);
}

/**
 * Resolve Employee cell to pool row. Name patterns first; engineer **code** only as fallback.
 */
export function resolveEngineerFromEmployeeCell(
  raw: string,
  pool: EngineerPoolRow[]
): { engineerId: string | null } {
  const cell = raw.trim();
  if (!cell) return { engineerId: null };
  const lower = cell.toLowerCase();
  const norm = normaliseCell(cell);

  for (const e of pool) {
    const fn = e.first_name?.trim();
    const ln = e.last_name?.trim();
    if (!fn || !ln) continue;
    const labelDot = `${ln} ${fn[0]}.`.toLowerCase();
    const labelNoDot = `${ln} ${fn[0]}`.toLowerCase();
    if (lower === labelDot || lower === labelNoDot) {
      return { engineerId: e.id };
    }
  }

  for (const e of pool) {
    const fn = e.first_name?.trim();
    const ln = e.last_name?.trim();
    if (!fn || !ln) continue;
    const commaForms = [
      `${ln}, ${fn}`.toLowerCase(),
      `${ln}, ${fn[0]}.`.toLowerCase(),
      `${ln}, ${fn[0]}`.toLowerCase(),
    ];
    if (commaForms.includes(lower)) {
      return { engineerId: e.id };
    }
  }

  for (const e of pool) {
    const fn = e.first_name?.trim();
    const ln = e.last_name?.trim();
    if (!fn || !ln) continue;
    if (norm === normaliseCell(`${fn} ${ln}`) || norm === normaliseCell(`${ln} ${fn}`)) {
      return { engineerId: e.id };
    }
  }

  for (const e of pool) {
    if (e.code === cell || e.code.toLowerCase() === lower) {
      return { engineerId: e.id };
    }
  }

  return { engineerId: null };
}
