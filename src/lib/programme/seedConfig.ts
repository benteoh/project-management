import type { ProjectUpsertRow } from "@/types/project";

import { SEED_ENGINEER_ROWS, SEED_PROJECT_ENGINEER_RATE_ROWS } from "./seedEngineers";
import { buildProgrammeNodesFromSeed, seedProgrammeData } from "./seedProgrammeData";

export { SEED_ENGINEER_ROWS, SEED_PROJECT_ENGINEER_RATE_ROWS };

/** Primary key for the sample project (`/projects/1`, seed WBS). */
export const SEED_PROJECT_ID = "1" as const;

/** Copy of the Euston seed project for demos / tests (same WBS shape, prefixed node ids). */
export const SEED_PROJECT_TEST_ID = "2" as const;

/** Prefix for {@link SEED_PROJECT_TEST_ID} programme node ids (avoids clashing with project1). */
export const SEED_PROJECT_TEST_NODE_ID_PREFIX = "p2-" as const;

/** Fixed UUID for the seed London office row in `public.offices`. */
export const SEED_LONDON_OFFICE_ID = "00000000-0000-0000-0000-000000000001" as const;

/** Demo offices upserted by `npm run seed` (stable ids for FKs). */
export const SEED_OFFICES = [
  { id: SEED_LONDON_OFFICE_ID, name: "London", location: "United Kingdom" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Salzburg", location: "Austria" },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Washington D.C.",
    location: "United States",
  },
  { id: "00000000-0000-0000-0000-000000000004", name: "Toronto", location: "Canada" },
  { id: "00000000-0000-0000-0000-000000000005", name: "Tel Aviv", location: "Israel" },
] as const;

/** Sample project row for `public.projects`. */
export const seedProjectRow: ProjectUpsertRow = {
  id: SEED_PROJECT_ID,
  project_code: "489",
  name: "Euston Station",
  client: "HS2 Ltd",
  office_id: SEED_LONDON_OFFICE_ID,
  status: "active",
  fixed_fee: 230_000,
  start_date: "2025-01-06",
  end_date: "2026-06-30",
};

/** Same contract as {@link seedProjectRow}, different id/name for a duplicate seed project. */
export const seedProjectTestRow: ProjectUpsertRow = {
  ...seedProjectRow,
  id: SEED_PROJECT_TEST_ID,
  name: "Euston Station (Test)",
};

/** Raw WBS (codes in scope engineers); use {@link buildProgrammeNodesFromSeed} after pool seed. */
export { buildProgrammeNodesFromSeed, seedProgrammeData };
