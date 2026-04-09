import { describe, expect, it } from "vitest";

import type { RowData } from "./forecastGridTypes";

import { scopeBracketCellStyle } from "./scopeBracketCellStyle";

function leadRow(overrides: Partial<RowData> = {}): RowData {
  return {
    _id: "x",
    _no: 1,
    _scopeId: "s1",
    _scope: "Scope",
    _person: "P",
    _hourRate: null,
    _scopeDivider: false,
    _scopeLeadRow: true,
    _scopeStartIso: "2026-01-05",
    _scopeEndIso: "2026-01-07",
    ...overrides,
  };
}

const VERT_PATTERN = "linear-gradient(to bottom, var(--gold) 0%, var(--gold) 50%, transparent 50%)";

describe("scopeBracketCellStyle (top rule + half-height vertical caps)", () => {
  const cols = ["2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"];

  it("returns empty when not a scope lead row", () => {
    const d = leadRow({ _scopeLeadRow: false });
    expect(scopeBracketCellStyle("2026-01-05", d, cols)).toEqual({});
  });

  it("uses inset box-shadow for top line across every day in the visible range", () => {
    const s = scopeBracketCellStyle("2026-01-06", leadRow(), cols);
    expect(s.boxShadow).toContain("inset 0 1px 0 0 var(--gold)");
    expect(s.borderTop).toBeUndefined();
  });

  it("adds left half-height vertical via gradient when real start is on-screen", () => {
    const s = scopeBracketCellStyle("2026-01-05", leadRow(), cols);
    expect(s.backgroundImage).toContain(VERT_PATTERN);
    expect(s.backgroundPosition).toContain("left top");
    expect(s.boxShadow).not.toContain("inset 1px 0 0 0");
  });

  it("adds right half-height vertical when real end is on-screen", () => {
    const s = scopeBracketCellStyle("2026-01-07", leadRow(), cols);
    expect(s.backgroundImage).toContain(VERT_PATTERN);
    expect(s.backgroundPosition).toContain("right top");
    expect(s.boxShadow).not.toContain("inset -1px 0 0 0");
  });

  it("middle days have top inset only", () => {
    const s = scopeBracketCellStyle("2026-01-06", leadRow(), cols);
    expect(s.boxShadow).toBe("inset 0 1px 0 0 var(--gold)");
    expect(s.backgroundImage).toBeUndefined();
  });

  it("when clipped, top inset remains; side caps omitted", () => {
    const d = leadRow({
      _scopeStartIso: "2026-01-01",
      _scopeEndIso: "2026-12-31",
    });
    const first = scopeBracketCellStyle("2026-01-04", d, cols);
    expect(first.boxShadow).toBe("inset 0 1px 0 0 var(--gold)");
    expect(first.backgroundImage).toBeUndefined();
    const last = scopeBracketCellStyle("2026-01-08", d, cols);
    expect(last.boxShadow).toBe("inset 0 1px 0 0 var(--gold)");
    expect(last.backgroundImage).toBeUndefined();
  });

  it("unknown start/end: top inset only across window, no side caps", () => {
    const d = leadRow({ _scopeStartIso: null, _scopeEndIso: null });
    const first = scopeBracketCellStyle("2026-01-04", d, cols);
    expect(first.boxShadow).toBe("inset 0 1px 0 0 var(--gold)");
    expect(first.backgroundImage).toBeUndefined();
    const last = scopeBracketCellStyle("2026-01-08", d, cols);
    expect(last.boxShadow).toBe("inset 0 1px 0 0 var(--gold)");
    expect(last.backgroundImage).toBeUndefined();
  });

  it("returns empty when visible window does not intersect range", () => {
    const d = leadRow({
      _scopeStartIso: "2025-01-01",
      _scopeEndIso: "2025-01-02",
    });
    expect(scopeBracketCellStyle("2026-01-05", d, cols)).toEqual({});
  });

  it("returns empty when start > end", () => {
    const d = leadRow({
      _scopeStartIso: "2026-02-01",
      _scopeEndIso: "2026-01-01",
    });
    expect(scopeBracketCellStyle("2026-01-05", d, cols)).toEqual({});
  });

  it("single-day range can show top + left + right half-height caps", () => {
    const oneDay = ["2026-01-06"];
    const d = leadRow({
      _scopeStartIso: "2026-01-06",
      _scopeEndIso: "2026-01-06",
    });
    const s = scopeBracketCellStyle("2026-01-06", d, oneDay);
    expect(s.boxShadow).toContain("inset 0 1px 0 0 var(--gold)");
    expect((s.backgroundImage?.match(/linear-gradient/g) ?? []).length).toBe(2);
    expect(s.backgroundPosition).toBe("left top, right top");
  });
});
