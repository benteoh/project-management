import { ActivityStatus } from "./types";

export function StatusBadge({ status }: { status: ActivityStatus }) {
  if (status === "Completed")
    return (
      <span className="bg-status-healthy-bg text-status-healthy rounded px-1.5 py-0.5 text-xs font-medium">
        Completed
      </span>
    );
  if (status === "In Progress")
    return (
      <span className="bg-status-info-bg text-status-info rounded px-1.5 py-0.5 text-xs font-medium">
        In Progress
      </span>
    );
  if (status === "Not Started")
    return (
      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs font-medium">
        Not Started
      </span>
    );
  return null;
}
