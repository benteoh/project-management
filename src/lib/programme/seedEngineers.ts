/**
 * Demo engineer roster for `npm run seed` (`engineer_pool`).
 * Weekly hours are split across Mon–Fri in `supabase/seed.ts` via `weeklyHoursToFiveDays`.
 */
export const SEED_ENGINEER_ROWS = [
  { firstName: "Alex", lastName: "Petit", capacityPerWeek: 6 },
  { firstName: "Desirée", lastName: "Molina", capacityPerWeek: 25 },
  { firstName: "Laurence", lastName: "Chaplin", capacityPerWeek: 24 },
  { firstName: "Rufino", lastName: "Olivares", capacityPerWeek: 40 },
  { firstName: "Arthur", lastName: "Nixon", capacityPerWeek: 40 },
  { firstName: "Avantika", lastName: "Raj", capacityPerWeek: 40 },
  { firstName: "Justyna", lastName: "Wroblicka", capacityPerWeek: 40 },
  { firstName: "Meryl", lastName: "Wong", capacityPerWeek: 40 },
  { firstName: "Theofanis", lastName: "Rentzelos", capacityPerWeek: 40 },
  { firstName: "Andreas", lastName: "Feiersinger", capacityPerWeek: 40 },
  { firstName: "Brian", lastName: "Lyons", capacityPerWeek: 40 },
  { firstName: "Alex", lastName: "Moldovan", capacityPerWeek: 40 },
  { firstName: "Ali", lastName: "Nasekhian", capacityPerWeek: 40 },
  { firstName: "Stephen", lastName: "Flynn", capacityPerWeek: 40 },
  { firstName: "Abbas", lastName: "Tajaddini", capacityPerWeek: 40 },
  { firstName: "Alec", lastName: "Marshall", capacityPerWeek: 24 },
  { firstName: "Asil", lastName: "Zaidi", capacityPerWeek: 8 },
  { firstName: "Kenneth", lastName: "Law", capacityPerWeek: 40 },
  { firstName: "Phil", lastName: "Hallinan", capacityPerWeek: 8 },
  { firstName: "Shawn", lastName: "Sismondi", capacityPerWeek: 40 },
] as const;
