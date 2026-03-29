import type { ProgrammeNode } from "@/components/programme/types";

/**
 * Static WBS for the sample project (`SEED_PROJECT_ID` in `seedConfig.ts`).
 * Used only by `npm run seed` — the app loads the tree from Supabase.
 */
export const seedProgrammeData: ProgrammeNode[] = [
  {
    id: "s9",
    name: "9. Bridge Scope - MVP",
    type: "scope",
    totalHours: 92,
    start: "06-Aug-25",
    finish: "15-Dec-25",
    forecastTotalHours: 92,
    status: "",
    engineers: [],
    children: [
      {
        id: "a3610",
        activityId: "A3610",
        name: "Ongoing MVP Options for the LU works",
        type: "activity",
        totalHours: 92,
        start: "06-Aug-25",
        finish: "15-Dec-25",
        forecastTotalHours: 92,
        status: "Completed",
        children: [],
      },
    ],
  },
  {
    id: "s10",
    name: "10. SSP (Spatial Scope Planning)",
    type: "scope",
    totalHours: 92,
    start: "16-Dec-25",
    finish: "27-Feb-26",
    forecastTotalHours: 92,
    status: "",
    engineers: [
      { code: "BHa", isLead: true, plannedHrs: null, forecastHrs: null },
      { code: "LCh", isLead: false, plannedHrs: null, forecastHrs: null },
    ],
    children: [
      {
        id: "a3620",
        activityId: "A3620",
        name: "Ongoing support",
        type: "activity",
        totalHours: 92,
        start: "16-Dec-25",
        finish: "27-Feb-26",
        forecastTotalHours: 92,
        status: "In Progress",
        children: [],
      },
    ],
  },
];
