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
};
