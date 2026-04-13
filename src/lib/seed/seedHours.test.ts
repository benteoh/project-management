import { describe, expect, it } from "vitest";

import { splitWholeHoursIntoMaxPerDay } from "./seedHours";

describe("splitWholeHoursIntoMaxPerDay", () => {
  it("splits into chunks capped at maxPerDay", () => {
    expect(splitWholeHoursIntoMaxPerDay(16, 8)).toEqual([8, 8]);
    expect(splitWholeHoursIntoMaxPerDay(10, 8)).toEqual([8, 2]);
    expect(splitWholeHoursIntoMaxPerDay(8, 8)).toEqual([8]);
    expect(splitWholeHoursIntoMaxPerDay(3, 8)).toEqual([3]);
  });
});
