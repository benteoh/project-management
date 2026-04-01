import type { EngineerPoolEntry } from "@/types/engineer-pool";

/** e.g. "Jane D." — first name plus last initial; falls back to code or id when names are missing. */
export function formatEngineerListLabel(
  entry: EngineerPoolEntry | undefined,
  fallbackId: string
): string {
  if (!entry) return fallbackId;
  const fn = entry.firstName?.trim();
  const ln = entry.lastName?.trim();
  if (fn && ln) return `${fn} ${ln[0]}.`;
  if (fn) return fn;
  if (ln) return `${ln[0]}.`;
  return entry.code;
}

/** Label for engineer pickers (e.g. allocation dropdown): full name when available, code in parentheses. */
export function formatEngineerPickerLabel(entry: EngineerPoolEntry): string {
  const name = formatEngineerListLabel(entry, entry.code);
  if (name === entry.code) return entry.code;
  return `${name} (${entry.code})`;
}
