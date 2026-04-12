"use client";

import { useEffect, useState } from "react";

import { loadProjectForSettingsAction, updateProjectAction } from "@/app/settings/actions";
import { loadOfficesAction } from "@/app/settings/officeActions";
import { ProjectEngineersPanel } from "@/components/settings/ProjectEngineersPanel";
import type { Office } from "@/types/office";
import type { Project } from "@/types/project";

import { ProjectFormFields } from "./ProjectFormFields";
import type { ProjectCreatePayload } from "./types";

const PROJECT_SETTINGS_SUBTABS = ["Details", "Engineers"] as const;
type ProjectSettingsSubTab = (typeof PROJECT_SETTINGS_SUBTABS)[number];

function projectToPayload(p: Project): ProjectCreatePayload {
  return {
    name: p.name,
    client: p.client,
    officeId: p.officeId,
    projectCode: p.projectCode,
    status: p.status,
    fixedFee: p.fixedFee,
    startDate: p.startDate,
    endDate: p.endDate,
  };
}

export function ProjectSettingsDetail({
  projectId,
  onBackToProjects,
}: {
  projectId: string;
  onBackToProjects: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<ProjectSettingsSubTab>("Details");

  const [editDraft, setEditDraft] = useState<ProjectCreatePayload | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [projectRes, officesRes] = await Promise.all([
        loadProjectForSettingsAction(projectId),
        loadOfficesAction(),
      ]);
      if (cancelled) return;
      if (!projectRes.ok) {
        setError(projectRes.error);
      } else {
        setProject(projectRes.project);
        setEditDraft(projectToPayload(projectRes.project));
        setError(null);
      }
      if (officesRes.ok) setOffices(officesRes.offices);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft || !project) return;
    setIsSaving(true);
    const r = await updateProjectAction({ id: project.id, ...editDraft });
    setIsSaving(false);
    if (r.ok) {
      const updated = r.projects.find((p) => p.id === project.id) ?? null;
      if (updated) {
        setProject(updated);
        setEditDraft(projectToPayload(updated));
      }
      setError(null);
    } else {
      setError(r.error);
    }
  };

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
            {activeSubTab === "Details" && editDraft && (
              <form onSubmit={handleSaveDetails} className="flex flex-col gap-4">
                <ProjectFormFields
                  value={editDraft}
                  offices={offices}
                  disabled={isSaving}
                  onChange={setEditDraft}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {isSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            )}
            {activeSubTab === "Engineers" && <ProjectEngineersPanel projectId={project.id} />}
          </div>
        </>
      )}
    </div>
  );
}
