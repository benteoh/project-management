import { describe, expect, it } from "vitest";

import { reconcileEngineerCapacityForSave } from "./engineerCapacity";

describe("reconcileEngineerCapacityForSave", () => {
  it("returns nulls when both inputs empty", () => {
    expect(reconcileEngineerCapacityForSave(null, null)).toEqual({
      maxDailyHours: null,
      maxWeeklyHours: null,
    });
  });

  it("does not auto-fill weekly from daily", () => {
    const r = reconcileEngineerCapacityForSave(8, null);
    expect(r.maxDailyHours).toBe(8);
    expect(r.maxWeeklyHours).toBeNull();
  });

  it("caps daily when it exceeds weekly (part-time case)", () => {
    const r = reconcileEngineerCapacityForSave(8, 6);
    expect(r.maxDailyHours).toBe(6);
    expect(r.maxWeeklyHours).toBe(6);
  });

  it("leaves values unchanged when daily <= weekly", () => {
    const r = reconcileEngineerCapacityForSave(6, 30);
    expect(r.maxDailyHours).toBe(6);
    expect(r.maxWeeklyHours).toBe(30);
  });
});
