/** Engineer id is a UUID; row id is `${scopeId}-${engineerId}`. */
const UUID_SUFFIX_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Parse grid row id into scope and engineer UUID.
 * Assumes `engineerId` is always a standard UUID (last 36 chars after final `-`).
 */
export function parseForecastRowId(rowId: string): { scopeId: string; engineerId: string } | null {
  if (rowId.length < 38) return null;
  const engineerId = rowId.slice(-36);
  if (!UUID_SUFFIX_RE.test(engineerId)) return null;
  const scopeId = rowId.slice(0, -37);
  if (!scopeId) return null;
  return { scopeId, engineerId };
}

export function forecastRowId(scopeId: string, engineerId: string): string {
  return `${scopeId}-${engineerId}`;
}
