"use client";

import { useState } from "react";

import { ProgrammeTab } from "@/components/programme/ProgrammeTab";
import type { ProgrammeNode } from "@/components/programme/types";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types/project";

const TABS = ["Programme", "Forecast"] as const;
type Tab = (typeof TABS)[number];

function formatProjectStatus(status: Project["status"]): string {
  return status.replace(/_/g, " ");
}

export default function ProjectPageClient({
  project,
  projectLoadError,
  initialProgrammeTree,
  initialEngineerPool,
  programmeLoadError,
  saveProgramme,
  addEngineerToPool,
}: {
  project: Project | null;
  projectLoadError: string | null;
  initialProgrammeTree: ProgrammeNode[];
  initialEngineerPool: string[];
  programmeLoadError: string | null;
  saveProgramme: (tree: ProgrammeNode[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  addEngineerToPool: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Programme");

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <div className="px-6 pt-6 pb-0">
        {projectLoadError && (
          <div className="border-border bg-status-critical-bg text-status-critical mb-3 rounded-lg border px-4 py-2 text-sm">
            {projectLoadError}
          </div>
        )}
        {project ? (
          <>
            <p className="text-muted-foreground text-sm">{project.client}</p>
            <h1 className="text-foreground text-2xl font-semibold">{project.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {formatDate(project.startDate)} – {formatDate(project.endDate)} · {project.office} ·{" "}
              {formatProjectStatus(project.status)}
            </p>
          </>
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
            initialTree={initialProgrammeTree}
            initialEngineerPool={initialEngineerPool}
            loadError={programmeLoadError}
            saveProgramme={saveProgramme}
            addEngineerToPool={addEngineerToPool}
          />
        )}
        {activeTab === "Forecast" && <div className="flex-1" />}
      </div>
    </div>
  );
}
