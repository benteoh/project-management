// Date utilities for the programme tree.
// Dates are stored in dd-Mon-yy format (e.g. "06-Aug-25") to match
// the format used in DSP's existing Excel programmes.

export const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const DAY_NAMES   = ["Mo","Tu","We","Th","Fr","Sa","Su"];

export function parseProgrammeDate(str: string): Date | null {
  if (!str) return null;
  const parts = str.split("-");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const mi  = MONTH_NAMES.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
  if (mi === -1 || isNaN(day)) return null;
  const yr  = parseInt(parts[2], 10);
  return new Date(yr < 100 ? 2000 + yr : yr, mi, day);
}

export function formatProgrammeDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_NAMES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}
