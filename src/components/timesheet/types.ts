import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { TimesheetUpload } from "@/types/timesheet";

export type SheetData = {
  headers: string[];
  rows: string[][];
  fileName: string;
};

/** null = new upload not yet saved; TimesheetUpload = viewing a saved upload */
export type ViewingUpload = TimesheetUpload | null;

export type SaveState = "idle" | "saving" | "saved" | "error";

export type TimesheetTabProps = {
  projectId: string;
  initialUploads: TimesheetUpload[];
  engineerPool: EngineerPoolEntry[];
  /** Scope names from the project programme — used to validate Task ID (Scope) column. */
  scopeNames: string[];
  /** When set, validates Project / Job column cells against this project. */
  projectForTimesheet: { projectCode: string | null; name: string } | null;
};
