import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { DEFAULT_MAX_WEEKLY_HOURS } from "@/types/engineer-pool";

/** Resolves `scope_engineers.weekly_limit_hrs` with engineer pool fallback. */
export function effectiveWeeklyScopeLimit(
  stored: number | null | undefined,
  engineer: EngineerPoolEntry
): number {
  if (stored != null && !Number.isNaN(Number(stored))) {
    return Math.max(0, Math.round(Number(stored)));
  }
  return engineer.maxWeeklyHours ?? DEFAULT_MAX_WEEKLY_HOURS;
}
