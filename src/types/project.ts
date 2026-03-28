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

/**
 * Programme: the entire scoping of a project.
 * Contains scopes, which contain activities.
 *
 * Hierarchy: Programme → Scope → Activity
 *
 * A Programme belongs to a Project (1:1).
 */
export interface Programme {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
}

/**
 * Scope: a high-level breakdown item within a programme.
 * e.g. "Network Rail Boiler Room", "Endwalls Design"
 *
 * Has a total duration split across engineers.
 */
export interface Scope {
  id: string;
  programmeId: string;
  title: string;
  startDate: string;
  endDate: string;
  estimatedHours: number;
  actualHours: number;
  progress: number; // 0-100
  sortOrder: number;
  status: "not_started" | "in_progress" | "complete";
}

/**
 * Activity: a task or piece of work within a scope.
 * e.g. "Removal of infill panels", "Understand existing structure"
 *
 * The lowest level of breakdown. Engineers log time against activities.
 */
export interface Activity {
  id: string;
  scopeId: string;
  title: string;
  startDate: string;
  endDate: string;
  estimatedHours: number;
  actualHours: number;
  progress: number; // 0-100
  isComplete: boolean;
  sortOrder: number;
  activityType:
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
