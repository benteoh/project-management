import type { ProjectUpsertRow } from "@/types/project";

import { seedProgrammeData } from "./seedProgrammeData";

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

/** Engineer codes inserted into `public.engineer_pool` by `npm run seed`. */
export const SEED_ENGINEER_CODES = [
  "AFe",
  "AGa",
  "AMa",
  "AMo",
  "ANa",
  "ANi",
  "ARa",
  "ATa",
  "BHa",
  "BLy",
  "DMo",
  "EBa",
  "JCh",
  "JWr",
  "KLa",
  "KOl",
  "LCh",
  "MDe",
  "MWo",
  "PHa",
  "ROl",
  "SFl",
  "SSi",
  "TRe",
  "TSc",
].sort() as readonly string[];

/** WBS tree for {@link SEED_PROJECT_ID} — persisted to `programme_nodes` with that `project_id`. */
export { seedProgrammeData };
