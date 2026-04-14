"use client";

import { useState } from "react";
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
  | { kind: "scope"; scope: ProgrammeNode | null; cellValue: string }
  | {
      kind: "activity";
      activity: ProgrammeNode | null;
      cellValue: string;
      matchedCode: string;
      parentScopeName: string | null;
    };

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

/** Local state resets when `cellValue` changes via parent `key`. */
function UnmappedScopeMappingForm({
  cellValue,
  programmeScopes,
  onAddMapping,
}: {
  cellValue: string;
  programmeScopes: { id: string; name: string }[];
  onAddMapping: (rawText: string, scopeId: string) => Promise<void>;
}) {
  const [selectedScopeId, setSelectedScopeId] = useState("");
  const [mappingState, setMappingState] = useState<"idle" | "saving" | "saved">("idle");

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        No scope on this programme matches this task / scope text. Map it to an existing scope so
        future imports resolve it automatically.
      </p>
      {programmeScopes.length > 0 ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase">
              Map to scope
            </span>
            <select
              value={selectedScopeId}
              onChange={(e) => {
                setSelectedScopeId(e.target.value);
                setMappingState("idle");
              }}
              className="border-border bg-card text-foreground focus:ring-gold w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            >
              <option value="">Select a scope…</option>
              {programmeScopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {mappingState === "saved" ? (
            <p className="text-status-healthy text-xs font-medium">
              Mapping saved. This text will now resolve correctly.
            </p>
          ) : (
            <button
              type="button"
              disabled={!selectedScopeId || mappingState === "saving"}
              onClick={async () => {
                if (!selectedScopeId) return;
                setMappingState("saving");
                await onAddMapping(cellValue, selectedScopeId);
                setMappingState("saved");
              }}
              className="bg-gold text-foreground w-full rounded-md px-3 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
            >
              {mappingState === "saving" ? "Saving…" : "Save mapping"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No scopes defined in the programme yet.</p>
      )}
    </div>
  );
}

export function TimesheetLinkSidebar({
  panel,
  engineerPool,
  programmeScopes,
  onAddMapping,
  onClose,
}: {
  panel: TimesheetSidebarPanel | null;
  engineerPool: EngineerPoolEntry[];
  programmeScopes: { id: string; name: string }[];
  onAddMapping: (rawText: string, scopeId: string) => Promise<void>;
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
    <aside
      className="border-border bg-card text-card-foreground shadow-elevated ring-border fixed top-14 right-0 bottom-0 z-30 flex w-[min(100vw,20rem)] flex-col border-l-2 ring-1"
      aria-label="Linked cell details"
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-foreground text-sm font-semibold">
          {panel.kind === "project" && "Project"}
          {panel.kind === "employee" && "Employee"}
          {panel.kind === "scope" && "Scope"}
          {panel.kind === "activity" && "Activity"}
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
        {panel.kind === "activity" ? (
          <>
            <span className="text-muted-foreground block">Matched code</span>
            <span className="text-foreground mt-0.5 block font-mono break-words">
              {panel.matchedCode || "—"}
            </span>
            <span className="text-muted-foreground mt-2 block">Full cell</span>
            <span className="text-foreground mt-0.5 block break-words">
              {panel.cellValue || "—"}
            </span>
          </>
        ) : (
          <>
            Timesheet value:{" "}
            <span className="text-foreground font-mono break-words">{panel.cellValue || "—"}</span>
          </>
        )}
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
            <UnmappedScopeMappingForm
              key={panel.cellValue}
              cellValue={panel.cellValue}
              programmeScopes={programmeScopes}
              onAddMapping={onAddMapping}
            />
          ))}

        {panel.kind === "activity" &&
          (panel.activity ? (
            <dl className="space-y-3 text-sm">
              {panel.parentScopeName ? (
                <div>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Scope
                  </dt>
                  <dd className="text-foreground mt-0.5 font-medium">{panel.parentScopeName}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Activity name
                </dt>
                <dd className="text-foreground mt-0.5 font-medium">{panel.activity.name}</dd>
              </div>
              {panel.activity.activityId ? (
                <div>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Activity code
                  </dt>
                  <dd className="text-foreground mt-0.5 font-mono">{panel.activity.activityId}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Dates
                </dt>
                <dd className="text-foreground mt-0.5">
                  {panel.activity.start || panel.activity.finish
                    ? `${formatDate(panel.activity.start)} – ${formatDate(panel.activity.finish)}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Hours
                </dt>
                <dd className="text-foreground mt-0.5">
                  {panel.activity.totalHours != null ? panel.activity.totalHours : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Status
                </dt>
                <dd className="text-foreground mt-0.5">{panel.activity.status || "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">
              No activity on this programme matches that code for this row&apos;s task / scope.
              Check the Task ID cell or add the activity under the right scope.
            </p>
          ))}
      </div>
    </aside>
  );
}
