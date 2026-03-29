// ProgrammeNode is a UI view model for the programme tree.
// It is NOT the same as the domain types in src/types/project.ts (Scope, Activity).
// Domain types are flat; this tree model nests children for the interactive WBS grid.
// Data is loaded and persisted via Supabase (`programme_nodes`, `scope_engineers`, `engineer_pool`).

export type NodeType = "scope" | "task" | "subtask" | "activity";

export type ActivityStatus = "Not Started" | "In Progress" | "Completed" | "";

export interface EngineerAllocation {
  code: string;
  isLead: boolean;
  plannedHrs: number | null;
  forecastHrs: number | null;
}

export interface ProgrammeNode {
  id: string;
  activityId?: string;
  name: string;
  type: NodeType;
  totalHours: number | null;
  start: string;
  finish: string;
  forecastTotalHours: number | null;
  status: ActivityStatus;
  children: ProgrammeNode[];
  /** Scope rows only — persisted in `scope_engineers`. */
  engineers?: EngineerAllocation[];
}

export type EditableField = "name" | "totalHours" | "forecastTotalHours" | "status";

export interface EditingCell {
  nodeId: string;
  field: EditableField;
  value: string;
}

export interface CalendarState {
  nodeId: string;
  field: "start" | "finish";
  value: string;
  rect: { top: number; left: number; width: number; height: number };
}

export interface AddFormState {
  parentId: string;
  type: NodeType;
}

export interface FormValues {
  name: string;
  activityId: string;
  totalHours: string;
  start: string;
  finish: string;
  forecastTotalHours: string;
  status: ActivityStatus;
}

export const defaultForm: FormValues = {
  name: "",
  activityId: "",
  totalHours: "",
  start: "",
  finish: "",
  forecastTotalHours: "",
  status: "Not Started",
};

export interface ContextMenuState {
  nodeId: string;
  nodeType: NodeType;
  x: number;
  y: number;
}
