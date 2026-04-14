/**
 * Timesheet rows used for Allocations roll-ups (all uploads for a project).
 */
export interface TimesheetAllocationRow {
  engineerId: string | null;
  scopeId: string | null;
  /** `programme_nodes.id` for type `activity`. */
  activityNodeId: string | null;
  hours: number;
}
