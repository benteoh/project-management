import { ActivityStatus } from "./types";

export function StatusBadge({ status }: { status: ActivityStatus }) {
  if (status === "Completed")
    return <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-status-healthy-bg text-status-healthy">Completed</span>;
  if (status === "In Progress")
    return <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-status-info-bg text-status-info">In Progress</span>;
  if (status === "Not Started")
    return <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">Not Started</span>;
  return null;
}
