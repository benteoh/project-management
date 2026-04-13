/** Parses programme seed dates like `25-Nov-25` → `2025-11-25` (ISO). */
const MON: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function parseSeedDisplayDate(display: string): string {
  const m = display.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) {
    throw new Error(`Unrecognised seed date (expected dd-Mmm-yy): ${display}`);
  }
  const day = parseInt(m[1]!, 10);
  const monKey = m[2]!.slice(0, 3).toLowerCase();
  const month = MON[monKey];
  if (month == null) {
    throw new Error(`Unknown month in seed date: ${display}`);
  }
  const y2 = parseInt(m[3]!, 10);
  const year = 2000 + y2;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
