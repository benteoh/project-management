import type { Engineer } from "@/types/engineer-pool";

/** Fields edited on the engineer settings form (names, active, capacity). Office comes from the active office tab. */
export type EngineerEditableFields = Pick<
  Engineer,
  "firstName" | "lastName" | "isActive" | "maxDailyHours" | "maxWeeklyHours"
>;

function capacityScalarEq(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 1e-9;
}

export function engineerEditableFieldsEqual(
  a: EngineerEditableFields,
  b: EngineerEditableFields
): boolean {
  return (
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.isActive === b.isActive &&
    capacityScalarEq(a.maxDailyHours, b.maxDailyHours) &&
    capacityScalarEq(a.maxWeeklyHours, b.maxWeeklyHours)
  );
}

export function cloneEngineerEditableFields(e: EngineerEditableFields): EngineerEditableFields {
  return { ...e };
}

export function engineerToEditableFields(engineer: Engineer): EngineerEditableFields {
  return {
    firstName: engineer.firstName,
    lastName: engineer.lastName,
    isActive: engineer.isActive,
    maxDailyHours: engineer.maxDailyHours,
    maxWeeklyHours: engineer.maxWeeklyHours,
  };
}
