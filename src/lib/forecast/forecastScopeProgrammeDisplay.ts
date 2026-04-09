import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { ForecastHoursByScopeRecord } from "@/types/forecast-scope";

function codeForEngineer(pool: EngineerPoolEntry[], engineerId: string): string {
  return pool.find((p) => p.id === engineerId)?.code ?? engineerId;
}

function breakdownLines(
  rows: { engineerId: string; hours: number }[],
  engineerPool: EngineerPoolEntry[]
): string[] {
  const sorted = [...rows].sort((a, b) =>
    codeForEngineer(engineerPool, a.engineerId).localeCompare(
      codeForEngineer(engineerPool, b.engineerId)
    )
  );
  return sorted.map((r) => {
    const code = codeForEngineer(engineerPool, r.engineerId);
    const h = Math.round(r.hours);
    return `${code}: ${h} h`;
  });
}

/**
 * Programme table: show **whole-number total** only; tooltip lists per-engineer breakdown.
 */
export function forecastScopeProgrammeCell(
  scopeId: string,
  byScope: ForecastHoursByScopeRecord,
  engineerPool: EngineerPoolEntry[]
): { line: string; title: string } {
  const rows = byScope[scopeId];
  if (!rows || rows.length === 0) {
    return { line: "—", title: "No hours in demand forecast grid for this scope" };
  }

  const total = rows.reduce((s, r) => s + r.hours, 0);
  const whole = Math.round(total);
  const lines = breakdownLines(rows, engineerPool);
  const title = `Per engineer (Demand Forecast grid):\n${lines.join("\n")}\n—\nTotal: ${whole} h`;

  return { line: String(whole), title };
}

export function forecastScopeProgrammeTsv(
  scopeId: string,
  byScope: ForecastHoursByScopeRecord
): string {
  const rows = byScope[scopeId];
  if (!rows || rows.length === 0) return "";
  const total = rows.reduce((s, r) => s + r.hours, 0);
  return String(Math.round(total));
}
