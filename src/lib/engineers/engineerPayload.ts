import type { Engineer } from "@/types/engineer-pool";

/** Fields edited on the global engineer settings form (names, active, capacity). */
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
  return cloneEngineerEditableFields(engineer);
}
