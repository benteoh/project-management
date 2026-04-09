// Domain type — used throughout UI/business logic
export interface ForecastEntry {
  id: string;
  projectId: string;
  scopeId: string;
  engineerId: string;
  date: string; // ISO YYYY-MM-DD
  hours: number;
}

// DB row type — only used at repository boundary
export interface ForecastEntryDbRow {
  id: string;
  project_id: string;
  scope_id: string;
  engineer_id: string;
  date: string;
  hours: number;
}
