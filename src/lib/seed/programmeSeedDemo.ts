import { deriveEngineerCodeBase } from "@/lib/engineers/engineerCode";
import { SEED_ENGINEER_ROWS, seedProjectRow } from "@/lib/programme/seedConfig";

import type { SeedScopeAllocation } from "./seedProgrammeScopeMetadata";

export const PROGRAMME_DEMO_PROJECT_ID = seedProjectRow.id;
export const PROGRAMME_DEMO_PROJECT_LABEL = `${seedProjectRow.project_code} — ${seedProjectRow.name}`;
export const PROGRAMME_DEMO_PROJECT_CODE = seedProjectRow.project_code ?? "";

/**
 * s11 has an empty `engineers` array in static seed — use this roster for demo forecast/timesheet.
 * (Matches the former hand-authored s11 CSV.)
 */
export const SEED_SCOPE_ENGINEER_FALLBACK: readonly SeedScopeAllocation[] = [
  { code: "LCh", isLead: true, plannedHrs: 120 },
  { code: "ANi", isLead: false, plannedHrs: 95 },
  { code: "AFe", isLead: false, plannedHrs: 110 },
  { code: "MWo", isLead: false, plannedHrs: 85 },
  { code: "EBa", isLead: false, plannedHrs: 70 },
];

export function maxWeeklyHoursBySeedCode(): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of SEED_ENGINEER_ROWS) {
    m.set(deriveEngineerCodeBase(r.firstName, r.lastName), r.maxWeeklyHours);
  }
  return m;
}
