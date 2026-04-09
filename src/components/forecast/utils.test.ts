import { describe, it, expect } from "vitest";

import { addMonths, generateDailyDates, startOfWeek, toISODate } from "./utils";

describe("startOfWeek", () => {
  it("returns Monday for a Wednesday in the same week", () => {
    expect(startOfWeek("2026-04-08")).toBe("2026-04-06");
  });

  it("returns same Monday when input is already Monday", () => {
    expect(startOfWeek("2026-04-06")).toBe("2026-04-06");
  });

  it("maps Sunday to the previous Monday", () => {
    expect(startOfWeek("2026-04-12")).toBe("2026-04-06");
  });
});

describe("addMonths", () => {
  it("adds whole months in the middle of the month", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
  });

  it("handles year rollover", () => {
    expect(addMonths("2026-11-01", 2)).toBe("2027-01-01");
  });
});

describe("generateDailyDates", () => {
  it("includes both endpoints", () => {
    const dates = generateDailyDates("2026-04-01", "2026-04-03");
    expect(dates.map((d) => toISODate(d))).toEqual(["2026-04-01", "2026-04-02", "2026-04-03"]);
  });

  it("returns one day when start equals end", () => {
    const dates = generateDailyDates("2026-06-01", "2026-06-01");
    expect(dates.length).toBe(1);
  });
});
