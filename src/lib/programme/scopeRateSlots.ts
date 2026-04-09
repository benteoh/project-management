export const SCOPE_RATE_SLOTS = ["A", "B", "C", "D", "E"] as const;

export type ScopeRateSlot = (typeof SCOPE_RATE_SLOTS)[number];

export function normalizeScopeRate(r: string | undefined | null): ScopeRateSlot {
  if (r && (SCOPE_RATE_SLOTS as readonly string[]).includes(r)) return r as ScopeRateSlot;
  return "A";
}

/** First allocation’s rate, or A — used when opening the engineer popup. */
export function deriveScopeRateFromAllocations(engs: { rate: string }[]): ScopeRateSlot {
  if (engs.length === 0) return "A";
  return normalizeScopeRate(engs[0].rate);
}
