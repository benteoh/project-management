"use client";

import { useEffect, useState } from "react";

import {
  deleteProjectAction,
  duplicateProjectAction,
  loadProjectForSettingsAction,
  updateProjectAction,
} from "@/app/settings/actions";
import { ProjectEngineersPanel } from "@/components/settings/ProjectEngineersPanel";
import type { Project } from "@/types/project";

import { ProjectFormFields } from "./ProjectFormFields";
import type { ProjectCreatePayload } from "./types";

const PROJECT_SETTINGS_SUBTABS = ["Details", "Engineers"] as const;
type ProjectSettingsSubTab = (typeof PROJECT_SETTINGS_SUBTABS)[number];

function projectBreadcrumbTitle(p: Project): string {
  return p.projectCode ? `${p.projectCode} - ${p.name}` : p.name;
}

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
  onDuplicated,
  onDeleted,
}: {
  projectId: string;
  onBackToProjects: () => void;
  /** When set, called with the new project id after a successful duplicate. */
  onDuplicated?: (newProjectId: string) => void;
  /** Called after the project is successfully deleted. */
  onDeleted?: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<ProjectSettingsSubTab>("Details");

  const [editDraft, setEditDraft] = useState<ProjectCreatePayload | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const projectRes = await loadProjectForSettingsAction(projectId);
      if (cancelled) return;
      if (!projectRes.ok) {
        setError(projectRes.error);
      } else {
        setProject(projectRes.project);
        setEditDraft(projectToPayload(projectRes.project));
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleDuplicateProject = async () => {
    if (!project) return;
    setIsDuplicating(true);
    setError(null);
    const r = await duplicateProjectAction(project.id);
    setIsDuplicating(false);
    if (r.ok) {
      onDuplicated?.(r.newProjectId);
    } else {
      setError(r.error);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setIsDeleting(true);
    setError(null);
    const r = await deleteProjectAction(project.id);
    setIsDeleting(false);
    if (r.ok) {
      onDeleted?.();
    } else {
      setError(r.error);
      setConfirmDelete(false);
    }
  };

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
        <span className="text-foreground font-medium">{project ? project.officeName : "…"}</span>
        <span aria-hidden className="text-muted-foreground">
          /
        </span>
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
        <span className="text-foreground font-medium">
          {project ? projectBreadcrumbTitle(project) : loading ? "…" : error ? "Project" : "…"}
        </span>
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
                  disabled={isSaving || isDuplicating}
                  onChange={setEditDraft}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDuplicateProject()}
                    disabled={isSaving || isDuplicating || isDeleting}
                    className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {isDuplicating ? "Duplicating…" : "Duplicate project"}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isDuplicating || isDeleting}
                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {isSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>

                <div className="border-border border-t pt-4">
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={isSaving || isDuplicating || isDeleting}
                      className="text-status-critical hover:bg-status-critical-bg rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      Delete project
                    </button>
                  ) : (
                    <div className="bg-status-critical-bg border-status-critical rounded-lg border p-4">
                      <p className="text-status-critical mb-3 text-sm font-medium">
                        Delete &ldquo;{project.name}&rdquo;? This cannot be undone — all programme,
                        forecast, and timesheet data for this project will be permanently removed.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDeleteProject()}
                          disabled={isDeleting}
                          className="bg-status-critical rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                        >
                          {isDeleting ? "Deleting…" : "Yes, delete permanently"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          disabled={isDeleting}
                          className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
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
