"use client";

import { useCallback, useMemo, useState } from "react";

import { ProgrammeTab } from "@/components/programme/ProgrammeTab";
import {
  type ActivityFilterKey,
  ProjectActivityStateWidget,
} from "@/components/project/ProjectActivityStateWidget";
import type { ProgrammeNode } from "@/components/programme/types";
import { buildActivityStateBuckets } from "@/lib/programme/activityStateSummary";
import { formatDate } from "@/lib/utils";
import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { Project } from "@/types/project";

import { ForecastTab } from "@/components/forecast/ForecastTab";

import { addEngineerToPoolAction, saveProgrammeAction } from "./actions";

const TABS = ["Programme", "Forecast"] as const;
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
}: {
  projectId: string;
  project: Project | null;
  projectLoadError: string | null;
  initialProgrammeTree: ProgrammeNode[];
  initialEngineerPool: EngineerPoolEntry[];
  programmeLoadError: string | null;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Programme");
  const [programmeTree, setProgrammeTree] = useState<ProgrammeNode[]>(initialProgrammeTree);
  const [engineerPool, setEngineerPool] = useState<EngineerPoolEntry[]>(initialEngineerPool);
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

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <div className="px-6 pt-6 pb-0">
        {projectLoadError && (
          <div className="border-border bg-status-critical-bg text-status-critical mb-3 rounded-lg border px-4 py-2 text-sm">
            {projectLoadError}
          </div>
        )}
        {project ? (
          <div className="flex items-start justify-between gap-4">
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

        <div className="border-border mt-5 flex items-end gap-0.5 border-b">
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

      <div className="border-border bg-card mx-6 flex flex-1 flex-col overflow-hidden border-x border-b">
        {activeTab === "Programme" && (
          <ProgrammeTab
            initialTree={programmeTree}
            initialEngineerPool={engineerPool}
            loadError={programmeLoadError}
            saveProgramme={saveProgramme}
            addEngineerToPool={addEngineerToPoolAction}
            onTreeChange={setProgrammeTree}
            onEngineerPoolChange={setEngineerPool}
            activityFilterIds={activityFilterIds}
          />
        )}
        {activeTab === "Forecast" && (
          <ForecastTab
            projectId={projectId}
            initialEngineerPool={engineerPool}
            programmeTree={programmeTree}
          />
        )}
      </div>
    </div>
  );
}
