import { cn } from "@/lib/utils";

import { ActivityStatus } from "./types";

const controlShell = "rounded px-1.5 text-center text-xs font-medium ring-1 ring-transparent";

function shellClass(matchControlWidth: boolean | undefined) {
  return cn(
    controlShell,
    matchControlWidth ? "flex h-7 w-full max-w-full items-center justify-center py-0" : "py-0.5"
  );
}

export function StatusBadge({
  status,
  matchControlWidth,
}: {
  status: ActivityStatus;
  /** Same footprint as the activity status `<select>` (full cell width, centred text). */
  matchControlWidth?: boolean;
}) {
  if (status === "Completed")
    return (
      <span
        className={cn(shellClass(matchControlWidth), "bg-status-healthy-bg text-status-healthy")}
      >
        Completed
      </span>
    );
  if (status === "In Progress")
    return (
      <span className={cn(shellClass(matchControlWidth), "bg-status-info-bg text-status-info")}>
        In Progress
      </span>
    );
  if (status === "Not Started")
    return (
      <span className={cn(shellClass(matchControlWidth), "bg-muted text-muted-foreground")}>
        Not Started
      </span>
    );
  return null;
}
