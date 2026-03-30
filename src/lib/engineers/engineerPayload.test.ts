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
  capacityPerWeek: 40,
  capacityDays: [8, 8, 8, 8, 8],
};

describe("engineerEditableFieldsEqual", () => {
  it("returns true for identical fields", () => {
    const a = engineerToEditableFields(baseEngineer);
    const b = cloneEngineerEditableFields(a);
    expect(engineerEditableFieldsEqual(a, b)).toBe(true);
  });

  it("returns false when a capacity day differs", () => {
    const a = engineerToEditableFields(baseEngineer);
    const b = cloneEngineerEditableFields(a);
    b.capacityDays = [7, 8, 8, 8, 8];
    expect(engineerEditableFieldsEqual(a, b)).toBe(false);
  });

  it("treats null week capacities as equal", () => {
    const left: Engineer = {
      ...baseEngineer,
      capacityPerWeek: null,
      capacityDays: [null, null, null, null, null],
    };
    const right: Engineer = {
      ...baseEngineer,
      capacityPerWeek: null,
      capacityDays: [null, null, null, null, null],
    };
    expect(
      engineerEditableFieldsEqual(engineerToEditableFields(left), engineerToEditableFields(right))
    ).toBe(true);
  });
});

describe("cloneEngineerEditableFields", () => {
  it("copies capacity days so mutations do not alias", () => {
    const a = engineerToEditableFields(baseEngineer);
    const b = cloneEngineerEditableFields(a);
    b.capacityDays[0] = 0;
    expect(a.capacityDays[0]).toBe(8);
  });
});
