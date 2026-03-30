"use client";

import { useEffect, useState } from "react";

import { loadProjectForSettingsAction } from "@/app/settings/actions";
import { ProjectEngineersPanel } from "@/components/settings/ProjectEngineersPanel";
import type { Project } from "@/types/project";

const PROJECT_SETTINGS_SUBTABS = ["Engineers"] as const;
type ProjectSettingsSubTab = (typeof PROJECT_SETTINGS_SUBTABS)[number];

export function ProjectSettingsDetail({
  projectId,
  onBackToProjects,
}: {
  projectId: string;
  onBackToProjects: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<ProjectSettingsSubTab>("Engineers");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await loadProjectForSettingsAction(projectId);
      if (cancelled) return;
      if (!r.ok) {
        setError(r.error);
        setProject(null);
      } else {
        setProject(r.project);
        setError(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
      >
        <button
          type="button"
          onClick={onBackToProjects}
          className="text-foreground hover:text-muted-foreground rounded px-1 py-0.5 font-medium underline-offset-2 hover:underline"
        >
          Projects
        </button>
        <span aria-hidden className="text-muted-foreground">
          /
        </span>
        {loading && <span className="text-foreground font-medium">…</span>}
        {!loading && project && <span className="text-foreground font-medium">{project.name}</span>}
        {!loading && !project && error && (
          <span className="text-foreground font-medium">Project</span>
        )}
      </nav>

      {error && (
        <div className="border-border bg-status-critical-bg text-status-critical shrink-0 rounded-lg border px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {project && (
        <>
          <div className="border-border flex shrink-0 items-end gap-0.5 border-b">
            {PROJECT_SETTINGS_SUBTABS.map((tab) => {
              const isActive = tab === activeSubTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveSubTab(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
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

          <div className="min-h-0 flex-1 overflow-auto pt-2">
            {activeSubTab === "Engineers" && <ProjectEngineersPanel projectId={project.id} />}
          </div>
        </>
      )}
    </div>
  );
}
