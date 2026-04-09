"use client";

import { useCallback, useMemo, useState } from "react";

import { ForecastTab } from "@/components/forecast/ForecastTab";
import { TimesheetTab } from "@/components/timesheet/TimesheetTab";
import { ProgrammeTab } from "@/components/programme/ProgrammeTab";
import type { ProgrammeNode } from "@/components/programme/types";
import {
  type ActivityFilterKey,
  ProjectActivityStateWidget,
} from "@/components/project/ProjectActivityStateWidget";
import { useViewportFitsProjectWorkspace } from "@/hooks/useViewportFitsProjectWorkspace";
import { buildActivityStateBuckets } from "@/lib/programme/activityStateSummary";
import { collectScopeNames } from "@/lib/programme/programmeTree";
import { formatDate } from "@/lib/utils";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { Project } from "@/types/project";
import type { TimesheetUpload } from "@/types/timesheet";

import { saveProgrammeAction } from "./actions";

const TABS = ["Timesheet", "Programme", "Forecast"] as const;
type Tab = (typeof TABS)[number];

function formatProjectStatus(status: Project["status"]): string {
  return status.replace(/_/g, " ");
}

export default function ProjectPageClient({
  projectId,
  project,
  projectLoadError,
  initialProgrammeTree,
  initialEngineerPool,
  programmeLoadError,
  bankHolidays,
  initialTimesheetUploads,
}: {
  projectId: string;
  project: Project | null;
  projectLoadError: string | null;
  initialProgrammeTree: ProgrammeNode[];
  initialEngineerPool: EngineerPoolEntry[];
  programmeLoadError: string | null;
  bankHolidays: string[];
  initialTimesheetUploads: TimesheetUpload[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Programme");
  const [programmeTree, setProgrammeTree] = useState<ProgrammeNode[]>(initialProgrammeTree);
  const engineerPool = initialEngineerPool;

  const scopeNames = useMemo(() => collectScopeNames(programmeTree), [programmeTree]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilterKey | null>(null);
  const activityBuckets = useMemo(() => buildActivityStateBuckets(programmeTree), [programmeTree]);
  const activityFilterIds = useMemo(() => {
    if (!activityFilter) return null;
    return new Set(activityBuckets[activityFilter].map((row) => row.id));
  }, [activityBuckets, activityFilter]);
  const activitySummary = useMemo(
    () => ({
      upcoming: activityBuckets.upcoming.length,
      inProgress: activityBuckets.inProgress.length,
      warning: activityBuckets.warning.length,
      late: activityBuckets.late.length,
    }),
    [activityBuckets]
  );

  const saveProgramme = useCallback(
    (tree: ProgrammeNode[]) => saveProgrammeAction(projectId, tree),
    [projectId]
  );

  const viewportFits = useViewportFitsProjectWorkspace();

  if (!viewportFits) {
    return (
      <div className="bg-background text-foreground flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <p className="text-sm font-semibold">This window is too small</p>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          The project workspace needs a larger display. Please widen your browser or use a bigger
          screen to view the programme and forecast.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-0">
        {projectLoadError && (
          <div className="border-border bg-status-critical-bg text-status-critical mb-3 rounded-lg border px-4 py-2 text-sm">
            {projectLoadError}
          </div>
        )}
        {project ? (
          <div className="flex w-full min-w-0 items-start justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-sm">{project.client}</p>
              <h1 className="text-foreground text-2xl font-semibold">{project.name}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {formatDate(project.startDate)} – {formatDate(project.endDate)} · {project.office} ·{" "}
                {formatProjectStatus(project.status)}
              </p>
            </div>

            <div className="flex items-stretch gap-2">
              <ProjectActivityStateWidget
                summary={activitySummary}
                activeFilter={activityFilter}
                onSelectFilter={(filter) => {
                  setActivityFilter((prev) => (prev === filter ? null : filter));
                  setActiveTab("Programme");
                }}
              />
            </div>
          </div>
        ) : (
          !projectLoadError && (
            <>
              <p className="text-muted-foreground text-sm">—</p>
              <h1 className="text-foreground text-2xl font-semibold">Project</h1>
              <p className="text-muted-foreground mt-1 text-sm">No project loaded.</p>
            </>
          )
        )}

        <div className="border-border mt-5 flex w-full items-end justify-start gap-4 border-b">
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 text-sm font-medium transition-colors focus:outline-none ${
                  isActive
                    ? "border-border bg-card text-foreground relative z-10 -mb-px rounded-t-lg border-t border-r border-l"
                    : "text-muted-foreground hover:text-foreground rounded-t-lg"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-border bg-card mx-6 flex min-h-0 flex-1 flex-col overflow-hidden border-x border-b">
        {activeTab === "Programme" && (
          <ProgrammeTab
            key={projectId}
            projectId={projectId}
            initialTree={programmeTree}
            initialEngineerPool={engineerPool}
            loadError={programmeLoadError}
            saveProgramme={saveProgramme}
            onTreeChange={setProgrammeTree}
            activityFilterIds={activityFilterIds}
          />
        )}
        {activeTab === "Forecast" &&
          (project ? (
            <ForecastTab
              projectId={projectId}
              projectStartDate={project.startDate}
              projectEndDate={project.endDate}
              projectIsFinished={project.status === "complete"}
              initialEngineerPool={engineerPool}
              programmeTree={programmeTree}
              bankHolidays={bankHolidays}
            />
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
              Load a project to view the demand forecast.
            </div>
          ))}
        <div className={activeTab === "Timesheet" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <TimesheetTab
            projectId={projectId}
            initialUploads={initialTimesheetUploads}
            engineerPool={engineerPool}
            scopeNames={scopeNames}
          />
        </div>
      </div>
    </div>
  );
}
