import { deriveEngineerCodeBase } from "@/lib/engineers/engineerCode";
import { CAPACITY_MAX_DAY, roundCapacityStep } from "@/lib/engineers/engineerCapacity";

/**
 * Seed rule for pairing daily vs weekly max hours:
 * - If weekly &lt; 8 → daily cap equals weekly (part-time / short week).
 * - If weekly ≥ 8 → daily cap ≈ weekly ÷ 5 (spread across a full week), 0.5h steps, capped at {@link CAPACITY_MAX_DAY}.
 */
export function seedMaxDailyFromWeekly(weekly: number): number {
  if (weekly <= 8) {
    return roundCapacityStep(Math.min(CAPACITY_MAX_DAY, weekly));
  }
  return roundCapacityStep(Math.min(CAPACITY_MAX_DAY, weekly / 5));
}

/** Optional default A/B rates for the seed project (`project_engineers`). */
export type SeedProjectRates = {
  rateA: number | null;
  rateB: number | null;
};

/** Single roster row: identity + capacity + optional seed project rates (no duplicated names elsewhere). */
export type SeedEngineerDef = {
  firstName: string;
  lastName: string;
  maxWeeklyHours: number;
  seedProjectRates?: SeedProjectRates;
};

/**
 * Demo engineer roster for `npm run seed` (`engineer_pool`).
 *
 * **Rates:** `seedProjectRates` maps to `rate_a` / `rate_b` (Concept Stage) on `project_engineers` for
 * the seed project id in `seedConfig`. Omit when the person has no default project rates (e.g. Alex Petit).
 *
 * **Sheet notes:** “Ola K.” stored as Ola Kowalski (confirm surname). Rate A only (no Concept B): Zaidi
 * (`rate_b` null). No Rate A in sheet: Ola, Schwind (`rate_a` null). New vs original pool: Haig, Kowalski,
 * Barnes, Chan, Schwind.
 */
const SEED_ENGINEERS: readonly SeedEngineerDef[] = [
  { firstName: "Alex", lastName: "Petit", maxWeeklyHours: 6 },
  {
    firstName: "Desirée",
    lastName: "Molina",
    maxWeeklyHours: 25,
    seedProjectRates: { rateA: 104.375, rateB: 116.52 },
  },
  {
    firstName: "Laurence",
    lastName: "Chaplin",
    maxWeeklyHours: 24,
    seedProjectRates: { rateA: 131.875, rateB: 147.22 },
  },
  {
    firstName: "Rufino",
    lastName: "Olivares",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 104.375, rateB: 147.22 },
  },
  {
    firstName: "Arthur",
    lastName: "Nixon",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 104.375, rateB: 116.52 },
  },
  {
    firstName: "Avantika",
    lastName: "Raj",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 104.375, rateB: 116.52 },
  },
  {
    firstName: "Justyna",
    lastName: "Wroblicka",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 104.375, rateB: 116.52 },
  },
  {
    firstName: "Meryl",
    lastName: "Wong",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 82.31, rateB: 91.89 },
  },
  {
    firstName: "Theofanis",
    lastName: "Rentzelos",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 104.375, rateB: 116.52 },
  },
  {
    firstName: "Andreas",
    lastName: "Feiersinger",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 171.56, rateB: 191.53 },
  },
  {
    firstName: "Brian",
    lastName: "Lyons",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 171.56, rateB: 191.53 },
  },
  {
    firstName: "Alex",
    lastName: "Moldovan",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 131.875, rateB: 147.22 },
  },
  {
    firstName: "Ali",
    lastName: "Nasekhian",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 131.875, rateB: 191.53 },
  },
  {
    firstName: "Stephen",
    lastName: "Flynn",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 131.875, rateB: 147.22 },
  },
  {
    firstName: "Abbas",
    lastName: "Tajaddini",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 131.875, rateB: 147.22 },
  },
  {
    firstName: "Alec",
    lastName: "Marshall",
    maxWeeklyHours: 24,
    seedProjectRates: { rateA: 131.875, rateB: 147.22 },
  },
  {
    firstName: "Asil",
    lastName: "Zaidi",
    maxWeeklyHours: 8,
    seedProjectRates: { rateA: 131.875, rateB: null },
  },
  {
    firstName: "Kenneth",
    lastName: "Law",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 104.375, rateB: 116.52 },
  },
  {
    firstName: "Phil",
    lastName: "Hallinan",
    maxWeeklyHours: 8,
    seedProjectRates: { rateA: 131.875, rateB: 147.22 },
  },
  {
    firstName: "Shawn",
    lastName: "Sismondi",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 131.875, rateB: 147.22 },
  },
  {
    firstName: "Bethan",
    lastName: "Haig",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 131.875, rateB: 191.53 },
  },
  {
    firstName: "K",
    lastName: "Ola",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: null, rateB: 147.22 },
  },
  {
    firstName: "Emma",
    lastName: "Barnes",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 60, rateB: 66.98 },
  },
  {
    firstName: "Junwin",
    lastName: "Chan",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: 82.31, rateB: 91.89 },
  },
  {
    firstName: "Thomas",
    lastName: "Schwind",
    maxWeeklyHours: 40,
    seedProjectRates: { rateA: null, rateB: 191.53 },
  },
];

/** Demo engineer roster for `npm run seed` (`engineer_pool`). */
export const SEED_ENGINEER_ROWS = SEED_ENGINEERS.map((r) => ({
  firstName: r.firstName,
  lastName: r.lastName,
  maxWeeklyHours: r.maxWeeklyHours,
  maxDailyHours: seedMaxDailyFromWeekly(r.maxWeeklyHours),
}));

export type SeedEngineerRow = (typeof SEED_ENGINEER_ROWS)[number];

/** Rows for `project_engineers` on the seed project — derived from {@link SEED_ENGINEERS}, no duplicate names. */
export const SEED_PROJECT_ENGINEER_RATE_ROWS = SEED_ENGINEERS.filter(
  (e): e is SeedEngineerDef & { seedProjectRates: SeedProjectRates } => e.seedProjectRates != null
).map((e) => ({
  code: deriveEngineerCodeBase(e.firstName, e.lastName),
  rateA: e.seedProjectRates.rateA,
  rateB: e.seedProjectRates.rateB,
}));
