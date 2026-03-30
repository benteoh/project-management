import { cloneCapacityDays } from "@/lib/engineers/engineerCapacity";
import type { Engineer, EngineerCapacityDays } from "@/types/engineer-pool";

/** Fields edited on the global engineer settings form (names, active, capacity). */
export type EngineerEditableFields = Pick<
  Engineer,
  "firstName" | "lastName" | "isActive" | "capacityPerWeek" | "capacityDays"
>;

function capacityScalarEq(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 1e-9;
}

function capacityDaysEq(a: EngineerCapacityDays, b: EngineerCapacityDays): boolean {
  for (let i = 0; i < 5; i++) {
    if (!capacityScalarEq(a[i], b[i])) return false;
  }
  return true;
}

export function engineerEditableFieldsEqual(
  a: EngineerEditableFields,
  b: EngineerEditableFields
): boolean {
  return (
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.isActive === b.isActive &&
    capacityScalarEq(a.capacityPerWeek, b.capacityPerWeek) &&
    capacityDaysEq(a.capacityDays, b.capacityDays)
  );
}

export function cloneEngineerEditableFields(e: EngineerEditableFields): EngineerEditableFields {
  return {
    ...e,
    capacityDays: cloneCapacityDays(e.capacityDays),
  };
}

export function engineerToEditableFields(engineer: Engineer): EngineerEditableFields {
  return cloneEngineerEditableFields(engineer);
}
