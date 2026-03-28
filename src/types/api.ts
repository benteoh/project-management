import { Project, Programme, Scope, Activity } from "./project";

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
  programme: Programme & {
    scopes: (Scope & {
      activities: Activity[];
    })[];
  };
  cvr: ProjectCVR;
};

// Demand forecast: hours allocated per engineer per activity per week
export interface ForecastEntry {
  id: string;
  activityId: string;
  engineerId: string;
  weekStarting: string;
  forecastedHours: number;
}
