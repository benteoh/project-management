import type { RowData } from "./forecastGridTypes";

const GOLD = "var(--gold)";

/** Vertical cap: 1px wide, gold from top to vertical midpoint only (not full cell height). */
const VERT_HALF = `linear-gradient(to bottom, ${GOLD} 0%, ${GOLD} 50%, transparent 50%)`;

function halfHeightVerticalCaps(left: boolean, right: boolean): Record<string, string> {
  if (!left && !right) return {};
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];
  if (left) {
    images.push(VERT_HALF);
    sizes.push("1px 100%");
    positions.push("left top");
    repeats.push("no-repeat");
  }
  if (right) {
    images.push(VERT_HALF);
    sizes.push("1px 100%");
    positions.push("right top");
    repeats.push("no-repeat");
  }
  return {
    backgroundImage: images.join(", "),
    backgroundSize: sizes.join(", "),
    backgroundPosition: positions.join(", "),
    backgroundRepeat: repeats.join(", "),
  };
}

/**
 * **Scope range** — top rule via inset box-shadow; vertical caps via narrow gradients
 * (not cell borders). Verticals run **top → middle** only.
 */
export function scopeBracketCellStyle(
  iso: string,
  data: RowData | undefined,
  dateColFields: readonly string[]
): Record<string, string> {
  if (!data?._scopeLeadRow || dateColFields.length === 0) return {};

  const gridFirst = dateColFields[0]!;
  const gridLast = dateColFields[dateColFields.length - 1]!;
  const rawStart = data._scopeStartIso;
  const rawEnd = data._scopeEndIso;

  const hasRawStart = rawStart != null && rawStart !== "";
  const hasRawEnd = rawEnd != null && rawEnd !== "";

  const rangeStart = hasRawStart ? rawStart : gridFirst;
  const rangeEnd = hasRawEnd ? rawEnd : gridLast;

  if (rangeStart > rangeEnd) return {};

  const visStart = rangeStart > gridFirst ? rangeStart : gridFirst;
  const visEnd = rangeEnd < gridLast ? rangeEnd : gridLast;
  if (visStart > visEnd) return {};

  if (iso < visStart || iso > visEnd) return {};

  const showLeftCap = hasRawStart && rawStart >= gridFirst;
  const showRightCap = hasRawEnd && rawEnd <= gridLast;

  const out: Record<string, string> = {
    boxShadow: `inset 0 1px 0 0 ${GOLD}`,
  };

  Object.assign(
    out,
    halfHeightVerticalCaps(iso === visStart && showLeftCap, iso === visEnd && showRightCap)
  );

  return out;
}
