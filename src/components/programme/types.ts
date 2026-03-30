import type { ActivityStatus, ProgrammeNodeType } from "@/types/programme-node";

export type NodeType = ProgrammeNodeType;

export interface EngineerAllocation {
  code: string;
  isLead: boolean;
  plannedHrs: number | null;
  forecastHrs: number | null;
}

/**
 * Interactive WBS node. Persisted to `programme_nodes`; `project_id` comes from the project route
 * on load/save (not stored on this object).
 */
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
