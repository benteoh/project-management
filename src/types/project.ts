export interface Project {
  id: string;
  name: string;
  client: string;
  office: string;
  status: "active" | "complete" | "bid" | "on_hold";
  fixedFee: number;
  startDate: string;
  endDate: string;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  level: 1 | 2 | 3; // task, subtask, sub-subtask
  estimatedHours: number;
  actualHours: number;
  isComplete: boolean;
  sortOrder: number;
  taskType:
    | "concept_design"
    | "detailed_design"
    | "technical_review"
    | "cad"
    | "workshop"
    | "report"
    | "site_visit"
    | "other";
  complexity: "simple" | "standard" | "complex";
}

export interface ProjectRate {
  id: string;
  projectId: string;
  role: string;
  engineerId: string | null;
  ratePerHour: number;
}
