"use client";

import { X } from "lucide-react";

import type { ProgrammeNode } from "@/components/programme/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { Project } from "@/types/project";
import {
  PROJECT_ENGINEER_RATE_SLOT_COUNT,
  PROJECT_ENGINEER_RATE_SLOT_LABELS,
  type ProjectEngineerRateSlotIndex,
} from "@/types/project-engineer";

export type TimesheetSidebarPanel =
  | { kind: "project"; project: Project; cellValue: string }
  | { kind: "employee"; engineer: EngineerPoolEntry | null; cellValue: string }
  | { kind: "scope"; scope: ProgrammeNode | null; cellValue: string };

function formatProjectStatus(status: Project["status"]): string {
  return status.replace(/_/g, " ");
}

function TimesheetEmployeeSidebarDetails({ engineer }: { engineer: EngineerPoolEntry }) {
  const rates = engineer.rates;
  const displayName =
    [engineer.firstName, engineer.lastName].filter(Boolean).join(" ").trim() || "—";

  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Name</dt>
        <dd className="text-foreground mt-0.5 font-medium">{displayName}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Code</dt>
        <dd className="text-foreground mt-0.5 font-mono">{engineer.code}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Rates</dt>
        <dd className="mt-1.5">
          {rates == null ? (
            <p className="text-muted-foreground text-xs">No rate bands stored for this project.</p>
          ) : (
            <ul className="border-border grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-xs tabular-nums">
              {Array.from({ length: PROJECT_ENGINEER_RATE_SLOT_COUNT }, (_, i) => {
                const slot = i as ProjectEngineerRateSlotIndex;
                const label = PROJECT_ENGINEER_RATE_SLOT_LABELS[slot];
                const value = rates[slot];
                return (
                  <li key={label} className="contents">
                    <span className="text-muted-foreground font-medium">Band {label}</span>
                    <span className="text-foreground text-right">
                      {value != null ? `${formatCurrency(value)}/hr` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </dd>
      </div>
    </dl>
  );
}

export function TimesheetLinkSidebar({
  panel,
  engineerPool,
  onClose,
}: {
  panel: TimesheetSidebarPanel | null;
  engineerPool: EngineerPoolEntry[];
  onClose: () => void;
}) {
  if (!panel) return null;

  function engineerLabel(id: string): string {
    const e = engineerPool.find((x) => x.id === id);
    if (!e) return id;
    const name = [e.firstName, e.lastName].filter(Boolean).join(" ").trim();
    return name ? `${name} (${e.code})` : e.code;
  }

  return (
    <aside className="border-border bg-muted/45 flex w-[min(100%,20rem)] shrink-0 flex-col border-l-2 shadow-sm">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-foreground text-sm font-semibold">
          {panel.kind === "project" && "Project"}
          {panel.kind === "employee" && "Employee"}
          {panel.kind === "scope" && "Scope"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-md p-1"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="text-muted-foreground border-border border-b px-4 py-2 text-xs leading-snug">
        Timesheet value:{" "}
        <span className="text-foreground font-mono break-words">{panel.cellValue || "—"}</span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {panel.kind === "project" && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Name
              </dt>
              <dd className="text-foreground mt-0.5 font-medium">
                {panel.project.projectCode
                  ? `${panel.project.projectCode} — ${panel.project.name}`
                  : panel.project.name}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Client
              </dt>
              <dd className="text-foreground mt-0.5">{panel.project.client}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Dates
              </dt>
              <dd className="text-foreground mt-0.5">
                {formatDate(panel.project.startDate)} – {formatDate(panel.project.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Office
              </dt>
              <dd className="text-foreground mt-0.5">{panel.project.officeName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Status
              </dt>
              <dd className="text-foreground mt-0.5">
                {formatProjectStatus(panel.project.status)}
              </dd>
            </div>
          </dl>
        )}

        {panel.kind === "employee" &&
          (panel.engineer ? (
            <TimesheetEmployeeSidebarDetails engineer={panel.engineer} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No engineer in this project&apos;s pool matches this cell. Check spelling or add the
              person in programme settings.
            </p>
          ))}

        {panel.kind === "scope" &&
          (panel.scope ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Scope name
                </dt>
                <dd className="text-foreground mt-0.5 font-medium">{panel.scope.name}</dd>
              </div>
              {panel.scope.activityId ? (
                <div>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Activity ID
                  </dt>
                  <dd className="text-foreground mt-0.5 font-mono">{panel.scope.activityId}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Dates
                </dt>
                <dd className="text-foreground mt-0.5">
                  {panel.scope.start || panel.scope.finish
                    ? `${formatDate(panel.scope.start)} – ${formatDate(panel.scope.finish)}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Scoped hours
                </dt>
                <dd className="text-foreground mt-0.5">
                  {panel.scope.totalHours != null ? panel.scope.totalHours : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Status
                </dt>
                <dd className="text-foreground mt-0.5">{panel.scope.status || "—"}</dd>
              </div>
              {panel.scope.engineers && panel.scope.engineers.length > 0 ? (
                <div>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Assigned engineers
                  </dt>
                  <dd className="text-foreground mt-0.5">
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {panel.scope.engineers.map((eng) => (
                        <li key={eng.engineerId}>{engineerLabel(eng.engineerId)}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">
              No scope on this programme matches this task / scope text strongly enough (same rule
              as the import checker).
            </p>
          ))}
      </div>
    </aside>
  );
}
