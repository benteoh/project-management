import { describe, expect, it } from "vitest";

import type { Engineer } from "@/types/engineer-pool";

import {
  cloneEngineerEditableFields,
  engineerEditableFieldsEqual,
  engineerToEditableFields,
} from "./engineerPayload";

const baseEngineer: Engineer = {
  id: "1",
  code: "JDo",
  firstName: "Jane",
  lastName: "Doe",
  isActive: true,
  maxDailyHours: 8,
  maxWeeklyHours: 40,
};

describe("engineerEditableFieldsEqual", () => {
  it("returns true for identical fields", () => {
    const a = engineerToEditableFields(baseEngineer);
    const b = cloneEngineerEditableFields(a);
    expect(engineerEditableFieldsEqual(a, b)).toBe(true);
  });

  it("returns false when daily max differs", () => {
    const a = engineerToEditableFields(baseEngineer);
    const b = cloneEngineerEditableFields(a);
    b.maxDailyHours = 7;
    expect(engineerEditableFieldsEqual(a, b)).toBe(false);
  });

  it("treats null capacities as equal", () => {
    const left: Engineer = {
      ...baseEngineer,
      maxDailyHours: null,
      maxWeeklyHours: null,
    };
    const right: Engineer = {
      ...baseEngineer,
      maxDailyHours: null,
      maxWeeklyHours: null,
    };
    expect(
      engineerEditableFieldsEqual(engineerToEditableFields(left), engineerToEditableFields(right))
    ).toBe(true);
  });
});

describe("cloneEngineerEditableFields", () => {
  it("copies primitives so mutations do not alias shared refs for numbers", () => {
    const a = engineerToEditableFields(baseEngineer);
    const b = cloneEngineerEditableFields(a);
    b.maxDailyHours = 0;
    expect(a.maxDailyHours).toBe(8);
  });
});
