import { describe, expect, it } from "vitest";

import { parseSeedDisplayDate } from "./parseSeedDisplayDate";

describe("parseSeedDisplayDate", () => {
  it("parses dd-Mmm-yy to ISO", () => {
    expect(parseSeedDisplayDate("25-Nov-25")).toBe("2025-11-25");
    expect(parseSeedDisplayDate("11-Feb-26")).toBe("2026-02-11");
  });
});
