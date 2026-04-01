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

const SEED_ENGINEER_BASE = [
  { firstName: "Alex", lastName: "Petit", maxWeeklyHours: 6 },
  { firstName: "Desirée", lastName: "Molina", maxWeeklyHours: 25 },
  { firstName: "Laurence", lastName: "Chaplin", maxWeeklyHours: 24 },
  { firstName: "Rufino", lastName: "Olivares", maxWeeklyHours: 40 },
  { firstName: "Arthur", lastName: "Nixon", maxWeeklyHours: 40 },
  { firstName: "Avantika", lastName: "Raj", maxWeeklyHours: 40 },
  { firstName: "Justyna", lastName: "Wroblicka", maxWeeklyHours: 40 },
  { firstName: "Meryl", lastName: "Wong", maxWeeklyHours: 40 },
  { firstName: "Theofanis", lastName: "Rentzelos", maxWeeklyHours: 40 },
  { firstName: "Andreas", lastName: "Feiersinger", maxWeeklyHours: 40 },
  { firstName: "Brian", lastName: "Lyons", maxWeeklyHours: 40 },
  { firstName: "Alex", lastName: "Moldovan", maxWeeklyHours: 40 },
  { firstName: "Ali", lastName: "Nasekhian", maxWeeklyHours: 40 },
  { firstName: "Stephen", lastName: "Flynn", maxWeeklyHours: 40 },
  { firstName: "Abbas", lastName: "Tajaddini", maxWeeklyHours: 40 },
  { firstName: "Alec", lastName: "Marshall", maxWeeklyHours: 24 },
  { firstName: "Asil", lastName: "Zaidi", maxWeeklyHours: 8 },
  { firstName: "Kenneth", lastName: "Law", maxWeeklyHours: 40 },
  { firstName: "Phil", lastName: "Hallinan", maxWeeklyHours: 8 },
  { firstName: "Shawn", lastName: "Sismondi", maxWeeklyHours: 40 },
] as const;

/** Demo engineer roster for `npm run seed` (`engineer_pool`). */
export const SEED_ENGINEER_ROWS = SEED_ENGINEER_BASE.map((r) => ({
  firstName: r.firstName,
  lastName: r.lastName,
  maxWeeklyHours: r.maxWeeklyHours,
  maxDailyHours: seedMaxDailyFromWeekly(r.maxWeeklyHours),
}));

export type SeedEngineerRow = (typeof SEED_ENGINEER_ROWS)[number];
