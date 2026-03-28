import { describe, it, expect } from "vitest";
import { parseProgrammeDate, formatProgrammeDate } from "./dateUtils";

describe("parseProgrammeDate", () => {
  it("parses a valid 2-digit year date", () => {
    const d = parseProgrammeDate("06-Aug-25");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(7); // August = 7 (0-indexed)
    expect(d!.getDate()).toBe(6);
  });

  it("parses a 4-digit year", () => {
    const d = parseProgrammeDate("01-Jan-2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });

  it("is case-insensitive for month", () => {
    expect(parseProgrammeDate("15-mar-26")).not.toBeNull();
    expect(parseProgrammeDate("15-MAR-26")).not.toBeNull();
    expect(parseProgrammeDate("15-Mar-26")).not.toBeNull();
  });

  it("parses all 12 months", () => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    months.forEach((m, i) => {
      const d = parseProgrammeDate(`01-${m}-25`);
      expect(d).not.toBeNull();
      expect(d!.getMonth()).toBe(i);
    });
  });

  it("returns null for empty string", () => {
    expect(parseProgrammeDate("")).toBeNull();
  });

  it("returns null for ISO format (wrong separator)", () => {
    expect(parseProgrammeDate("2025-08-06")).toBeNull();
  });

  it("returns null for completely invalid string", () => {
    expect(parseProgrammeDate("not-a-date")).toBeNull();
  });

  it("returns null for invalid month abbreviation", () => {
    expect(parseProgrammeDate("01-Xyz-25")).toBeNull();
  });

  it("returns null for wrong number of parts", () => {
    expect(parseProgrammeDate("01-Jan")).toBeNull();
    expect(parseProgrammeDate("01-Jan-25-extra")).toBeNull();
  });

  it("handles end of month correctly", () => {
    const d = parseProgrammeDate("31-Dec-25");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(11);
    expect(d!.getDate()).toBe(31);
  });
});

describe("formatProgrammeDate", () => {
  it("formats a date to dd-Mon-yy", () => {
    expect(formatProgrammeDate(new Date(2025, 7, 6))).toBe("06-Aug-25");
  });

  it("zero-pads single-digit days", () => {
    expect(formatProgrammeDate(new Date(2026, 0, 1))).toBe("01-Jan-26");
  });

  it("uses 2-digit year", () => {
    expect(formatProgrammeDate(new Date(2025, 11, 31))).toBe("31-Dec-25");
  });

  it("round-trips with parse for every month", () => {
    const dates = [
      "01-Jan-26", "15-Feb-26", "28-Mar-26", "30-Apr-26",
      "15-May-26", "01-Jun-26", "07-Jul-26", "06-Aug-26",
      "30-Sep-26", "31-Oct-26", "15-Nov-26", "31-Dec-26",
    ];
    dates.forEach(original => {
      const parsed = parseProgrammeDate(original);
      expect(parsed).not.toBeNull();
      expect(formatProgrammeDate(parsed!)).toBe(original);
    });
  });
});
