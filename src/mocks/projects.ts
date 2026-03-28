import { Project, Programme, Scope, Activity } from "@/types/project";
import { ProjectCVR, ForecastEntry } from "@/types/api";
import { Engineer } from "@/types/timesheet";

// --- Engineers ---

export const mockEngineers: Engineer[] = [
  { id: "e1", name: "Sarah Chen", role: "Senior Engineer", office: "London", standardHoursPerWeek: 37.5, dayRate: 450, isActive: true },
  { id: "e2", name: "Ali Hassan", role: "Engineer", office: "London", standardHoursPerWeek: 37.5, dayRate: 320, isActive: true },
  { id: "e3", name: "Laurence Green", role: "Graduate Engineer", office: "London", standardHoursPerWeek: 37.5, dayRate: 220, isActive: true },
];

// --- Project ---

export const mockProject: Project = {
  id: "1",
  name: "Euston Underground",
  client: "HS2 Ltd",
  office: "London",
  status: "active",
  fixedFee: 230000,
  startDate: "2025-01-06",
  endDate: "2026-06-30",
};

// --- Programme → Scopes → Activities ---

export const mockActivities: Record<string, Activity[]> = {
  s1: [
    { id: "a1", scopeId: "s1", title: "Understand existing structure", startDate: "2025-01-06", endDate: "2025-02-14", estimatedHours: 30, actualHours: 32, progress: 100, isComplete: true, sortOrder: 1, activityType: "technical_review", complexity: "standard" },
    { id: "a2", scopeId: "s1", title: "Removal of infill panels", startDate: "2025-02-17", endDate: "2025-04-11", estimatedHours: 40, actualHours: 38, progress: 85, isComplete: false, sortOrder: 2, activityType: "detailed_design", complexity: "standard" },
    { id: "a3", scopeId: "s1", title: "Produce engineering outputs", startDate: "2025-04-14", endDate: "2025-05-30", estimatedHours: 50, actualHours: 25, progress: 45, isComplete: false, sortOrder: 3, activityType: "report", complexity: "complex" },
  ],
  s2: [
    { id: "a4", scopeId: "s2", title: "Feasibility assessment", startDate: "2025-03-03", endDate: "2025-05-09", estimatedHours: 60, actualHours: 45, progress: 70, isComplete: false, sortOrder: 1, activityType: "concept_design", complexity: "complex" },
    { id: "a5", scopeId: "s2", title: "Structural modelling", startDate: "2025-05-12", endDate: "2025-07-18", estimatedHours: 80, actualHours: 55, progress: 55, isComplete: false, sortOrder: 2, activityType: "detailed_design", complexity: "complex" },
    { id: "a6", scopeId: "s2", title: "CAD drawings", startDate: "2025-07-21", endDate: "2025-09-12", estimatedHours: 60, actualHours: 45, progress: 60, isComplete: false, sortOrder: 3, activityType: "cad", complexity: "standard" },
  ],
  s3: [
    { id: "a7", scopeId: "s3", title: "Drawing production", startDate: "2025-06-02", endDate: "2025-08-15", estimatedHours: 80, actualHours: 60, progress: 65, isComplete: false, sortOrder: 1, activityType: "cad", complexity: "standard" },
  ],
};

export const mockScopes: Scope[] = [
  { id: "s1", programmeId: "p1", title: "Network Rail Boiler Room", startDate: "2025-01-06", endDate: "2025-05-30", estimatedHours: 120, actualHours: 95, progress: 72, sortOrder: 1, status: "in_progress" },
  { id: "s2", programmeId: "p1", title: "Endwalls Design", startDate: "2025-03-03", endDate: "2025-09-12", estimatedHours: 200, actualHours: 145, progress: 60, sortOrder: 2, status: "in_progress" },
  { id: "s3", programmeId: "p1", title: "CAD Production", startDate: "2025-06-02", endDate: "2025-08-15", estimatedHours: 80, actualHours: 60, progress: 65, sortOrder: 3, status: "in_progress" },
];

export const mockProgramme: Programme = {
  id: "p1",
  projectId: "1",
  name: "Euston Underground Programme",
  description: null,
};

// --- Demand Forecast ---

export const mockForecasts: ForecastEntry[] = [
  // Sarah on "Understand existing structure" — complete
  { id: "f1", activityId: "a1", engineerId: "e1", weekStarting: "2025-01-06", forecastedHours: 8 },
  { id: "f2", activityId: "a1", engineerId: "e1", weekStarting: "2025-01-13", forecastedHours: 8 },
  { id: "f3", activityId: "a1", engineerId: "e1", weekStarting: "2025-01-20", forecastedHours: 8 },
  { id: "f4", activityId: "a1", engineerId: "e1", weekStarting: "2025-01-27", forecastedHours: 6 },

  // Ali on "Removal of infill panels"
  { id: "f5", activityId: "a2", engineerId: "e2", weekStarting: "2025-02-17", forecastedHours: 8 },
  { id: "f6", activityId: "a2", engineerId: "e2", weekStarting: "2025-02-24", forecastedHours: 8 },
  { id: "f7", activityId: "a2", engineerId: "e2", weekStarting: "2025-03-03", forecastedHours: 8 },
  { id: "f8", activityId: "a2", engineerId: "e2", weekStarting: "2025-03-10", forecastedHours: 8 },
  { id: "f9", activityId: "a2", engineerId: "e2", weekStarting: "2025-03-17", forecastedHours: 8 },

  // Laurence on "Feasibility assessment"
  { id: "f10", activityId: "a4", engineerId: "e3", weekStarting: "2025-03-03", forecastedHours: 8 },
  { id: "f11", activityId: "a4", engineerId: "e3", weekStarting: "2025-03-10", forecastedHours: 8 },
  { id: "f12", activityId: "a4", engineerId: "e3", weekStarting: "2025-03-17", forecastedHours: 8 },
  { id: "f13", activityId: "a4", engineerId: "e3", weekStarting: "2025-03-24", forecastedHours: 8 },
  { id: "f14", activityId: "a4", engineerId: "e3", weekStarting: "2025-03-31", forecastedHours: 8 },
  { id: "f15", activityId: "a4", engineerId: "e3", weekStarting: "2025-04-07", forecastedHours: 8 },
  { id: "f16", activityId: "a4", engineerId: "e3", weekStarting: "2025-04-14", forecastedHours: 6 },
  { id: "f17", activityId: "a4", engineerId: "e3", weekStarting: "2025-04-21", forecastedHours: 6 },
];

// --- CVR ---

export const mockCVR: ProjectCVR = {
  projectId: "1",
  progressPercent: 68,
  budgetConsumedPercent: 62,
  totalSpent: 142600,
  fixedFee: 230000,
  profit: 87400,
  profitPercent: 38,
  eac: 195000,
  costToComplete: 52400,
  weeklyTrend: [
    { week: "2025-01-06", progressPercent: 5, budgetConsumedPercent: 4, cumulativeSpent: 9200 },
    { week: "2025-02-03", progressPercent: 12, budgetConsumedPercent: 10, cumulativeSpent: 23000 },
    { week: "2025-03-03", progressPercent: 20, budgetConsumedPercent: 18, cumulativeSpent: 41400 },
    { week: "2025-04-07", progressPercent: 30, budgetConsumedPercent: 27, cumulativeSpent: 62100 },
    { week: "2025-05-05", progressPercent: 38, budgetConsumedPercent: 35, cumulativeSpent: 80500 },
    { week: "2025-06-02", progressPercent: 45, budgetConsumedPercent: 42, cumulativeSpent: 96600 },
    { week: "2025-07-07", progressPercent: 52, budgetConsumedPercent: 48, cumulativeSpent: 110400 },
    { week: "2025-08-04", progressPercent: 58, budgetConsumedPercent: 53, cumulativeSpent: 121900 },
    { week: "2025-09-01", progressPercent: 63, budgetConsumedPercent: 57, cumulativeSpent: 131100 },
    { week: "2025-10-06", progressPercent: 68, budgetConsumedPercent: 62, cumulativeSpent: 142600 },
  ],
};
