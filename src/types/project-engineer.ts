/** Five fixed rate slots per project–engineer row (A–E). */
export const PROJECT_ENGINEER_RATE_SLOT_COUNT = 5;

export const PROJECT_ENGINEER_RATE_SLOT_LABELS = ["A", "B", "C", "D", "E"] as const;

/** Rate band A–E. Derived from {@link PROJECT_ENGINEER_RATE_SLOT_LABELS} — single source of truth. */
export type RateSlot = (typeof PROJECT_ENGINEER_RATE_SLOT_LABELS)[number];

export type ProjectEngineerRateSlotIndex = 0 | 1 | 2 | 3 | 4;

export type ProjectEngineerRates = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

/** One engineer’s assignment to a project, including rate slots. */
export interface ProjectEngineerAssignment {
  id: string;
  projectId: string;
  engineerId: string;
  code: string;
  firstName: string;
  lastName: string;
  rates: ProjectEngineerRates;
}

/** Row shape for `public.project_engineers`. */
export interface ProjectEngineerDbRow {
  id: string;
  project_id: string;
  engineer_id: string;
  rate_a: number | null;
  rate_b: number | null;
  rate_c: number | null;
  rate_d: number | null;
  rate_e: number | null;
}
