import type { ProgrammeNode } from "@/components/programme/types";
import { hourRateForScopeSlot } from "@/lib/forecast/hourRateForScopeSlot";
import type { EngineerPoolEntry } from "@/types/engineer-pool";

export type ScopeQuotationEstimateResult = {
  subtotalGbp: number;
  warnings: string[];
};

/**
 * Estimated scope quotation from planned hours on {@link scope_engineers} and
 * {@link project_engineers} £/hr slots (same basis as the demand forecast grid).
 */
export function estimateScopeQuotationGbp(
  scope: ProgrammeNode,
  engineerPool: EngineerPoolEntry[]
): ScopeQuotationEstimateResult {
  const warnings: string[] = [];
  if (scope.type !== "scope") {
    return { subtotalGbp: 0, warnings: [] };
  }

  const poolById = new Map(engineerPool.map((e) => [e.id, e]));
  let subtotal = 0;

  for (const eng of scope.engineers ?? []) {
    const hours = eng.plannedHrs ?? 0;
    const pool = poolById.get(eng.engineerId);
    const label = pool?.code ?? eng.engineerId.slice(0, 8);
    if (!pool) {
      warnings.push(`${label}: engineer not in pool — cannot look up rate`);
      continue;
    }
    const rate = hourRateForScopeSlot(pool, eng.rate);
    if (rate == null) {
      warnings.push(`${label}: missing £/hr for rate ${eng.rate?.trim() ? eng.rate : "A"}`);
      continue;
    }
    subtotal += hours * rate;
  }

  return { subtotalGbp: Math.round(subtotal * 100) / 100, warnings };
}
