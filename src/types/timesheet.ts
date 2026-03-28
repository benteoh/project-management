export interface TimesheetEntry {
  id: string;
  engineerId: string;
  projectId: string;
  taskId: string;
  weekStarting: string;
  actualHours: number;
  notes: string | null;
  isBillable: boolean;
}

export interface Engineer {
  id: string;
  name: string;
  role: string;
  office: string;
  standardHoursPerWeek: number;
  dayRate: number;
  isActive: boolean;
}
