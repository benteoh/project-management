import type { ProgrammeNode } from "@/components/programme/types";

/**
 * Fixed PM quotation fields for demo scopes (`npm run seed`).
 * Keys are {@link seedProgrammeData} scope node ids. Amounts are GBP.
 */
export const SEED_SCOPE_QUOTATION_GBP: Record<
  string,
  { quotedAmount: number; quotationWarningAmount: number | null }
> = {
  s11: { quotedAmount: 55_500, quotationWarningAmount: null },
  s12: { quotedAmount: 55_000, quotationWarningAmount: 22_000 },
  s13: { quotedAmount: 198_000, quotationWarningAmount: null },
  s14: { quotedAmount: 145_000, quotationWarningAmount: null },
  s15: { quotedAmount: 30_000, quotationWarningAmount: 45_000 },
  s16: { quotedAmount: 50_000, quotationWarningAmount: null },
  s17: { quotedAmount: 156_000, quotationWarningAmount: null },
  s18: { quotedAmount: 100_000, quotationWarningAmount: null },
  s19: { quotedAmount: 10_000, quotationWarningAmount: 18_500 },
};

/** Attach seeded {@link SEED_SCOPE_QUOTATION_GBP} to each scope before persisting. */
export function applySeedScopeQuotations(nodes: ProgrammeNode[]): ProgrammeNode[] {
  function walk(list: ProgrammeNode[]): ProgrammeNode[] {
    return list.map((n) => {
      if (n.type === "scope") {
        const q = SEED_SCOPE_QUOTATION_GBP[n.id];
        return {
          ...n,
          quotedAmount: q?.quotedAmount ?? null,
          quotationWarningAmount: q?.quotationWarningAmount ?? null,
          children: walk(n.children),
        };
      }
      return { ...n, children: walk(n.children) };
    });
  }
  return walk(nodes);
}
