import { normalizeScopeRate } from "@/lib/programme/scopeRateSlots";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import { PROJECT_ENGINEER_RATE_SLOT_LABELS } from "@/types/project-engineer";

/**
 * £/hr for a forecast row: project_engineers slot (A–E) chosen by `scope_engineers.rate`
 * for this engineer on this scope.
 */
export function hourRateForScopeSlot(
  engineer: EngineerPoolEntry,
  slot: string | undefined | null
): number | null {
  const s = normalizeScopeRate(slot);
  const idx = (PROJECT_ENGINEER_RATE_SLOT_LABELS as readonly string[]).indexOf(s);
  if (idx < 0) return null;
  return engineer.rates?.[idx] ?? null;
}
