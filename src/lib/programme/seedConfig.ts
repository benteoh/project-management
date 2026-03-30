import type { ProjectUpsertRow } from "@/types/project";

import { SEED_ENGINEER_ROWS } from "./seedEngineers";
import { buildProgrammeNodesFromSeed, seedProgrammeData } from "./seedProgrammeData";

export { SEED_ENGINEER_ROWS };

/** Primary key for the sample project (`/projects/1`, seed WBS). */
export const SEED_PROJECT_ID = "1" as const;

/** Sample project row for `public.projects`. */
export const seedProjectRow: ProjectUpsertRow = {
  id: SEED_PROJECT_ID,
  name: "Euston Underground",
  client: "HS2 Ltd",
  office: "London",
  status: "active",
  fixed_fee: 230_000,
  start_date: "2025-01-06",
  end_date: "2026-06-30",
};

/** Raw WBS (codes in scope engineers); use {@link buildProgrammeNodesFromSeed} after pool seed. */
export { buildProgrammeNodesFromSeed, seedProgrammeData };
