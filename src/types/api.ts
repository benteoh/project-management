import { Project, Task } from "./project";

// GET /api/projects/:id/cvr
export interface ProjectCVR {
  projectId: string;
  progressPercent: number;
  budgetConsumedPercent: number;
  totalSpent: number;
  fixedFee: number;
  profit: number;
  profitPercent: number;
  eac: number;
  costToComplete: number;
  weeklyTrend: WeeklyTrendPoint[];
}

export interface WeeklyTrendPoint {
  week: string;
  progressPercent: number;
  budgetConsumedPercent: number;
  cumulativeSpent: number;
}

// GET /api/projects/:id
export type ProjectDetail = Project & {
  tasks: Task[];
  cvr: ProjectCVR;
};
